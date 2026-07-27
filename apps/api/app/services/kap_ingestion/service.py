from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
import unicodedata
from typing import Any

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.time import turkey_now
from app.models.bist_ingestion import (
    BenchmarkObservation,
    Instrument,
    InstrumentTermRule,
    InstrumentVersion,
)
from app.models.kap_ingestion import (
    KapCouponEvent,
    KapDerivedTerm,
    KapDisclosure,
    KapIngestionState,
)

from .client import KapHttpClient, disclosure_links
from .parser import KapDisclosureParser
from .proxy_pool import parse_public_proxy_list
from .spread_derivation import derive_annual_simple_spread


class KapEnrichmentService:
    """Incremental KAP ingestion which never participates in API readiness."""

    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings
        self.client = KapHttpClient(
            archive_root=settings.KAP_RAW_ARCHIVE_DIR,
            proxy_urls=settings.kap_proxy_url_list,
            request_interval_seconds=settings.KAP_REQUEST_INTERVAL_SECONDS,
            jitter_min_ms=settings.KAP_REQUEST_JITTER_MIN_MS,
            jitter_max_ms=settings.KAP_REQUEST_JITTER_MAX_MS,
            timeout_seconds=settings.KAP_HTTP_TIMEOUT_SECONDS,
            user_agent=settings.KAP_USER_AGENT,
        )
        self.parser = KapDisclosureParser()

    async def poll(self, *, force: bool = False) -> dict[str, Any]:
        if not self.settings.KAP_INGESTION_ENABLED:
            return {"status": "DISABLED", "fetched": 0}
        bind = self.db.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            acquired = await self.db.scalar(
                text("SELECT pg_try_advisory_xact_lock(726539021)")
            )
            if not acquired:
                return {"status": "ALREADY_RUNNING", "fetched": 0}
        if not force and not await self._poll_due():
            return {"status": "NOT_DUE", "fetched": 0}
        await self.refresh_proxy_pool()

        today = turkey_now().date()
        first_day = today - timedelta(days=2) if force else today
        artifact = await self.client.post_json(
            self.settings.KAP_PUBLIC_LIST_URL,
            self._list_payload(first_day, today),
        )
        links, list_metadata = self._list_entries(
            artifact.body,
            self.settings.KAP_PUBLIC_LIST_URL,
        )
        existing = set(
            (
                await self.db.execute(
                    select(KapDisclosure.disclosure_id).where(
                        KapDisclosure.disclosure_id.in_([item[0] for item in links] or [""])
                    )
                )
            ).scalars()
        )
        fetched = 0
        failures: list[dict[str, str]] = []
        for disclosure_id, discovered_url in links:
            if disclosure_id in existing or fetched >= self.settings.KAP_MAX_DETAILS_PER_RUN:
                continue
            detail_url = self.settings.KAP_PUBLIC_DETAIL_URL_TEMPLATE.format(
                disclosure_id=disclosure_id
            )
            try:
                await self._fetch_detail(
                    disclosure_id,
                    detail_url or discovered_url,
                    discovery_metadata=list_metadata.get(disclosure_id),
                )
                fetched += 1
            except Exception as exc:
                failures.append({"disclosure_id": disclosure_id, "error": type(exc).__name__})
        await self._set_state(
            "incremental_poll",
            {
                "last_poll_at": datetime.now(timezone.utc).isoformat(),
                "list_sha256": artifact.sha256,
                "discovered": len(links),
                "fetched": fetched,
                "failures": failures[-20:],
            },
        )
        await self.db.commit()
        derived = await self.derive_terms()
        return {
            "status": "COMPLETED" if not failures else "PARTIAL",
            "discovered": len(links),
            "fetched": fetched,
            "failures": failures,
            "derived": derived,
        }

    async def fetch_disclosure(self, disclosure_id: str) -> dict[str, Any]:
        if not self.settings.KAP_INGESTION_ENABLED:
            return {"status": "DISABLED"}
        existing = await self.db.scalar(
            select(KapDisclosure).where(KapDisclosure.disclosure_id == disclosure_id)
        )
        if existing is not None:
            return {"status": "CACHED", "disclosure_id": disclosure_id}
        await self.refresh_proxy_pool()
        await self._fetch_detail(
            disclosure_id,
            self.settings.KAP_PUBLIC_DETAIL_URL_TEMPLATE.format(disclosure_id=disclosure_id),
        )
        await self.db.commit()
        return {"status": "FETCHED", "disclosure_id": disclosure_id}

    async def refresh_proxy_pool(self, *, force: bool = False) -> dict[str, Any]:
        static_routes = self.settings.kap_proxy_url_list
        if not self.settings.KAP_PROXY_AUTO_REFRESH_ENABLED:
            if self.settings.KAP_PROXY_REQUIRE_PROXY and not static_routes:
                raise RuntimeError("KAP_PROXY_REQUIRED_BUT_NOT_CONFIGURED")
            self.client.routes = static_routes or [None]
            return {"status": "STATIC", "proxy_count": len(static_routes)}

        state = await self.db.get(KapIngestionState, "proxy_pool")
        now = datetime.now(timezone.utc)
        cached_routes: list[str] = []
        last_refresh: datetime | None = None
        if state is not None:
            cached_routes = [
                str(item)
                for item in state.value_json.get("proxy_urls", [])
                if isinstance(item, str)
            ]
            raw_refresh = state.value_json.get("refreshed_at")
            if raw_refresh:
                try:
                    last_refresh = datetime.fromisoformat(str(raw_refresh))
                except ValueError:
                    last_refresh = None
        due = (
            force
            or last_refresh is None
            or now - last_refresh
            >= timedelta(hours=max(1, self.settings.KAP_PROXY_REFRESH_HOURS))
        )
        refresh_error: str | None = None
        if due:
            try:
                async with httpx.AsyncClient(
                    timeout=min(self.settings.KAP_HTTP_TIMEOUT_SECONDS, 30.0),
                    follow_redirects=True,
                    headers={"User-Agent": self.settings.KAP_USER_AGENT},
                ) as client:
                    response = await client.get(self.settings.KAP_PROXY_SOURCE_URL)
                    response.raise_for_status()
                refreshed = parse_public_proxy_list(
                    response.content,
                    max_pool_size=self.settings.KAP_PROXY_MAX_POOL_SIZE,
                )
                if refreshed:
                    cached_routes = refreshed
                    value = {
                        "refreshed_at": now.isoformat(),
                        "proxy_urls": refreshed,
                        "source": "PROXYSCRAPE_PUBLIC_API",
                        "source_count": len(response.text.splitlines()),
                    }
                    if state is None:
                        self.db.add(KapIngestionState(key="proxy_pool", value_json=value))
                    else:
                        state.value_json = value
                        state.updated_at = now
                    await self.db.flush()
                else:
                    refresh_error = "NO_ACCEPTABLE_PUBLIC_PROXY"
            except (httpx.HTTPError, ValueError) as exc:
                refresh_error = type(exc).__name__

        routes = [*static_routes, *cached_routes]
        routes = list(dict.fromkeys(routes))
        if not routes and self.settings.KAP_PROXY_REQUIRE_PROXY:
            raise RuntimeError(
                f"KAP_PROXY_POOL_UNAVAILABLE:{refresh_error or 'EMPTY_POOL'}"
            )
        self.client.routes = routes or [None]
        return {
            "status": "REFRESHED" if due and not refresh_error else "CACHED",
            "proxy_count": len(routes),
            "refresh_error": refresh_error,
        }

    async def _fetch_detail(
        self,
        disclosure_id: str,
        url: str,
        discovery_metadata: dict[str, Any] | None = None,
    ) -> None:
        artifact = await self.client.get(url)
        parsed = self.parser.parse(artifact.body, artifact.content_type)
        disclosure = KapDisclosure(
            disclosure_id=disclosure_id,
            isin=parsed.isin,
            title=parsed.title,
            published_at=parsed.published_at,
            source_url=artifact.url,
            storage_key=artifact.storage_key,
            sha256=artifact.sha256,
            content_type=artifact.content_type,
            byte_size=len(artifact.body),
            fetch_status="FETCHED",
            parse_status="PARSED" if parsed.events else "PARTIAL",
            raw_metadata={
                "parser_version": self.parser.VERSION,
                "warnings": list(parsed.warnings),
                "discovery": discovery_metadata,
            },
            fetched_at=artifact.fetched_at,
            parsed_at=datetime.now(timezone.utc),
        )
        self.db.add(disclosure)
        await self.db.flush()
        for event in parsed.events:
            self.db.add(
                KapCouponEvent(
                    disclosure_id=disclosure.id,
                    isin=event.isin,
                    coupon_sequence=event.coupon_sequence,
                    payment_date=event.payment_date,
                    record_date=event.record_date,
                    investor_payment_date=event.investor_payment_date,
                    periodic_rate_decimal=event.periodic_rate_decimal,
                    annual_simple_decimal=event.annual_simple_decimal,
                    annual_compound_decimal=event.annual_compound_decimal,
                    payment_amount=event.payment_amount,
                    currency_rate=event.currency_rate,
                    paid=event.paid,
                    raw_row=event.raw_row,
                )
            )
        if parsed.isin and parsed.explicit_annual_simple_spread is not None:
            await self._publish_term(
                isin=parsed.isin,
                value=parsed.explicit_annual_simple_spread,
                benchmark="TLREFK" if parsed.isin.startswith("TRD") else "TLREF",
                lag=None,
                confidence="KAP_EXPLICIT",
                disclosure_ids=[disclosure_id],
                evidence={
                    "disclosure_id": disclosure_id,
                    "parser_version": self.parser.VERSION,
                    "source": "KAP_EXPLICIT_ANNUAL_SIMPLE_EXTRA_YIELD",
                },
            )

    @staticmethod
    def _list_payload(from_date: date, to_date: date) -> dict[str, Any]:
        return {
            "fromDate": from_date.isoformat(),
            "toDate": to_date.isoformat(),
            "memberType": "",
            "mkkMemberOidList": [],
            "inactiveMkkMemberOidList": [],
            "disclosureClass": "",
            "subjectList": [],
            "isLate": "",
            "mainSector": "",
            "sector": "",
            "subSector": "",
            "marketOid": "",
            "index": "",
            "bdkReview": "",
            "bdkMemberOidList": [],
            "year": "",
            "term": "",
            "ruleType": "",
            "period": "",
            "fromSrc": False,
            "srcCategory": "",
            "disclosureIndexList": [],
        }

    @staticmethod
    def _list_entries(
        body: bytes,
        base_url: str,
    ) -> tuple[list[tuple[str, str]], dict[str, dict[str, Any]]]:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return disclosure_links(body, base_url), {}
        if not isinstance(payload, list):
            return [], {}
        links: list[tuple[str, str]] = []
        metadata: dict[str, dict[str, Any]] = {}
        relevant_phrases = tuple(
            "".join(
                character
                for character in unicodedata.normalize("NFKD", phrase.casefold())
                if not unicodedata.combining(character)
            )
            for phrase in (
                "pay dışında sermaye piyasası aracı",
                "borçlanma araçları, yatırım fonları ve varant itfa",
                "kira sertifikası",
                "kupon/getiri",
            )
        )
        for raw in payload:
            if not isinstance(raw, dict) or raw.get("disclosureIndex") is None:
                continue
            searchable_raw = " ".join(
                str(raw.get(key) or "")
                for key in ("subject", "summary", "stockCodes", "relatedStocks")
            )
            searchable = "".join(
                character
                for character in unicodedata.normalize("NFKD", searchable_raw.casefold())
                if not unicodedata.combining(character)
            )
            if not any(phrase in searchable for phrase in relevant_phrases):
                continue
            disclosure_id = str(raw["disclosureIndex"])
            links.append(
                (disclosure_id, f"https://www.kap.org.tr/tr/Bildirim/{disclosure_id}")
            )
            metadata[disclosure_id] = raw
        return links, metadata

    async def derive_terms(self) -> dict[str, int]:
        """Build verified active terms from parsed KAP coupon evidence."""

        events = (
            await self.db.execute(
                select(KapCouponEvent)
                .where(KapCouponEvent.periodic_rate_decimal.is_not(None))
                .order_by(KapCouponEvent.isin, KapCouponEvent.payment_date)
            )
        ).scalars().all()
        created = 0
        conflicts = 0
        for event in events:
            instrument_row = (
                await self.db.execute(
                    select(Instrument, InstrumentVersion, InstrumentTermRule)
                    .join(InstrumentVersion, InstrumentVersion.instrument_id == Instrument.id)
                    .outerjoin(
                        InstrumentTermRule,
                        InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
                    )
                    .where(
                        Instrument.isin == event.isin,
                        InstrumentVersion.is_published.is_(True),
                    )
                    .order_by(InstrumentVersion.id.desc())
                    .limit(1)
                )
            ).first()
            if instrument_row is None:
                continue
            instrument, version, rule = instrument_row
            fields = version.canonical_fields_json
            ast = rule.ast_json if rule else {}
            period_start = await self._period_start(event, fields)
            if period_start is None:
                continue
            benchmark = self._benchmark(instrument.isin, ast)
            if benchmark is None:
                continue
            observations = (
                await self.db.execute(
                    select(BenchmarkObservation).where(
                        BenchmarkObservation.benchmark == benchmark,
                        BenchmarkObservation.observation_date
                        >= period_start - timedelta(days=10),
                        BenchmarkObservation.observation_date <= event.payment_date,
                        BenchmarkObservation.index_value.is_not(None),
                    )
                )
            ).scalars().all()
            evidence = derive_annual_simple_spread(
                published_periodic_rate=event.periodic_rate_decimal,
                period_start=period_start,
                period_end=event.payment_date,
                index_observations={
                    item.observation_date: item.index_value for item in observations
                },
                source_rounding_decimal_places=self._rate_precision(event),
            )
            if evidence is None:
                conflicts += 1
                await self._publish_term(
                    isin=event.isin,
                    value=None,
                    benchmark=benchmark,
                    lag=None,
                    confidence="KAP_CONFLICT",
                    disclosure_ids=await self._disclosure_ids(event.isin),
                    evidence={"coupon_event_id": event.id, "reason": "NO_VERIFIED_SPREAD_CANDIDATE"},
                )
                continue
            supporting = await self._matching_evidence_count(
                event.isin,
                benchmark,
                evidence.spread_decimal,
                current_event_id=event.id,
            )
            confidence = (
                "KAP_MULTI_COUPON_VERIFIED"
                if supporting >= 2
                else "KAP_SINGLE_COUPON_DERIVED"
            )
            await self._publish_term(
                isin=event.isin,
                value=evidence.spread_decimal,
                benchmark=benchmark,
                lag=evidence.lag_business_days,
                confidence=confidence,
                disclosure_ids=await self._disclosure_ids(event.isin),
                evidence={
                    "coupon_event_id": event.id,
                    "published_periodic_rate": str(event.periodic_rate_decimal),
                    "reconstructed_periodic_rate": str(evidence.reconstructed_periodic_rate),
                    "absolute_error": str(evidence.error_decimal),
                    "period_start": period_start.isoformat(),
                    "period_end": event.payment_date.isoformat(),
                    "period_days": evidence.period_days,
                    "start_index_date": evidence.start_observation_date.isoformat(),
                    "end_index_date": evidence.end_observation_date.isoformat(),
                    "start_index": str(evidence.start_index),
                    "end_index": str(evidence.end_index),
                },
            )
            created += 1
        await self.db.commit()
        return {"created_or_updated": created, "conflicts": conflicts}

    async def _period_start(
        self,
        event: KapCouponEvent,
        fields: dict[str, Any],
    ) -> date | None:
        if event.coupon_sequence and event.coupon_sequence > 1:
            prior = await self.db.scalar(
                select(KapCouponEvent)
                .where(
                    KapCouponEvent.disclosure_id == event.disclosure_id,
                    KapCouponEvent.isin == event.isin,
                    KapCouponEvent.coupon_sequence == event.coupon_sequence - 1,
                )
                .limit(1)
            )
            if prior is not None:
                return prior.payment_date
        raw = fields.get("first_issue_date")
        try:
            return date.fromisoformat(str(raw)) if raw else None
        except ValueError:
            return None

    @staticmethod
    def _benchmark(isin: str, ast: dict[str, Any]) -> str | None:
        names = {item.get("name") for item in ast.get("benchmarks", [])}
        if isin.startswith("TRD") or names & {"TLREFK_RATE", "BIST_TLREFK_INDEX"}:
            return "TLREFK"
        if names & {"TLREF_RATE", "BIST_TLREF_INDEX"}:
            return "TLREF"
        return None

    @staticmethod
    def _rate_precision(event: KapCouponEvent) -> int:
        cells = event.raw_row.get("cells", [])
        value = cells[4] if len(cells) > 4 else ""
        fraction = str(value).replace(".", ",").partition(",")[2]
        # Source shows a percentage; after division by 100 the decimal rate
        # has two additional decimal places.
        return max(3, len(fraction) + 2)

    async def _matching_evidence_count(
        self,
        isin: str,
        benchmark: str,
        spread: Decimal,
        *,
        current_event_id: int,
    ) -> int:
        prior = (
            await self.db.execute(
                select(KapDerivedTerm).where(
                    KapDerivedTerm.isin == isin,
                    KapDerivedTerm.term_type == "ANNUAL_SIMPLE_SPREAD",
                    KapDerivedTerm.benchmark == benchmark,
                    KapDerivedTerm.value_decimal == spread,
                    KapDerivedTerm.confidence.in_(
                        ["KAP_SINGLE_COUPON_DERIVED", "KAP_MULTI_COUPON_VERIFIED"]
                    ),
                )
            )
        ).scalars().all()
        event_ids = {current_event_id}
        for item in prior:
            evidence_id = item.evidence.get("coupon_event_id")
            if isinstance(evidence_id, int):
                event_ids.add(evidence_id)
        return len(event_ids)

    async def _disclosure_ids(self, isin: str) -> list[str]:
        return list(
            (
                await self.db.execute(
                    select(KapDisclosure.disclosure_id)
                    .where(KapDisclosure.isin == isin)
                    .order_by(KapDisclosure.published_at.desc(), KapDisclosure.id.desc())
                )
            ).scalars()
        )

    async def _publish_term(
        self,
        *,
        isin: str,
        value: Decimal | None,
        benchmark: str,
        lag: int | None,
        confidence: str,
        disclosure_ids: list[str],
        evidence: dict[str, Any],
    ) -> None:
        current = await self.db.scalar(
            select(KapDerivedTerm)
            .where(
                KapDerivedTerm.isin == isin,
                KapDerivedTerm.term_type == "ANNUAL_SIMPLE_SPREAD",
                KapDerivedTerm.is_active.is_(True),
            )
            .order_by(KapDerivedTerm.id.desc())
            .limit(1)
        )
        derived_confidences = {
            "KAP_SINGLE_COUPON_DERIVED",
            "KAP_MULTI_COUPON_VERIFIED",
        }
        derived_conflict = (
            current is not None
            and current.confidence in derived_confidences
            and confidence in derived_confidences
            and current.value_decimal != value
        )
        if derived_conflict:
            evidence = {
                **evidence,
                "reason": "INCONSISTENT_MULTI_COUPON_SPREAD",
                "previous_value_decimal": str(current.value_decimal),
                "candidate_value_decimal": str(value),
                "previous_evidence": current.evidence,
            }
            value = None
            lag = None
            confidence = "KAP_CONFLICT"
        identity = (value, benchmark, lag, confidence)
        if current is not None and (
            current.value_decimal,
            current.benchmark,
            current.observation_lag_business_days,
            current.confidence,
        ) == identity:
            return
        rank = {
            "KAP_CONFLICT": 0,
            "SPREAD_UNKNOWN": 0,
            "KAP_SINGLE_COUPON_DERIVED": 1,
            "KAP_MULTI_COUPON_VERIFIED": 2,
            "KAP_EXPLICIT": 3,
        }
        if (
            current is not None
            and not derived_conflict
            and rank.get(current.confidence, 0) > rank.get(confidence, 0)
        ):
            return
        if current is not None:
            current.is_active = False
            current.valid_to = date.today()
            current.superseded_at = datetime.now(timezone.utc)
        self.db.add(
            KapDerivedTerm(
                isin=isin,
                term_type="ANNUAL_SIMPLE_SPREAD",
                value_decimal=value,
                benchmark=benchmark,
                annuality="ANNUAL_SIMPLE",
                observation_lag_business_days=lag,
                confidence=confidence,
                valid_from=date.today(),
                is_active=True,
                supporting_disclosure_ids=disclosure_ids,
                evidence=evidence,
            )
        )

    async def _poll_due(self) -> bool:
        state = await self.db.get(KapIngestionState, "incremental_poll")
        if state is None:
            return True
        raw = state.value_json.get("last_poll_at")
        if not raw:
            return True
        try:
            last = datetime.fromisoformat(raw)
        except ValueError:
            return True
        local = turkey_now()
        active = 8 <= local.hour < 23
        minutes = (
            self.settings.KAP_ACTIVE_POLL_MINUTES
            if active
            else self.settings.KAP_NIGHT_POLL_MINUTES
        )
        return datetime.now(timezone.utc) - last >= timedelta(minutes=minutes)

    async def _set_state(self, key: str, value: dict[str, Any]) -> None:
        state = await self.db.get(KapIngestionState, key)
        if state is None:
            self.db.add(KapIngestionState(key=key, value_json=value))
        else:
            state.value_json = value
            state.updated_at = datetime.now(timezone.utc)
