from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.instrument_status import InstrumentStatus
from app.core.time import turkey_today, utc_now
from app.core.time import BistBusinessCalendar, parse_holiday_list
from app.models.bist_ingestion import (
    BenchmarkObservation,
    BootstrapRun,
    ImportDiagnostic,
    ImportRun,
    Instrument,
    InstrumentTermRule,
    InstrumentVersion,
    SourceFile,
)
from app.models.user import User
from app.models.kap_ingestion import (
    KapBackfillRequest,
    KapCouponEvent,
    KapDerivedTerm,
    KapDisclosure,
    KapIngestionState,
)
from app.models.valuation import (
    InstrumentUserNote,
    PriceObservation,
    UserFavoriteInstrument,
    ValuationRequestRecord,
    ValuationResultRecord,
)
from app.schemas.valuation_v2 import (
    ImportTrigger,
    InstrumentListResponse,
    InstrumentNoteUpdate,
    ValuationCreate,
    ValuationResponse,
)
from app.services.bist_ingestion.import_service import VerifiedBistImportService
from app.services.bist_ingestion.bootstrap import (
    BootstrapAlreadyRunning,
    VerifiedBistBootstrapService,
)
from app.services.kap_ingestion.spread_derivation import (
    is_current_spread_derivation,
)
from app.services.valuation.engine import (
    BenchmarkInput,
    InstrumentTerms,
    PriceInput,
    QuoteType,
    RateType,
    ValuationEngine,
)
from app.services.valuation.calendar import coupon_schedule, current_coupon_period
from app.services.valuation.coupon_rates import (
    CouponRateMetrics,
    from_annual_simple_coupon,
    from_index_change,
    from_periodic_coupon,
)
from app.services.valuation.day_count import parse_day_count, year_fraction
from app.services.valuation.errors import ValuationError, ValuationFailureCode
from app.services.metrics_service import MetricsService


router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


def _require_read_enabled() -> None:
    if not settings.VALUATION_V2_READ_ENABLED:
        raise HTTPException(status_code=503, detail="Verified v2 read path is disabled")


def _decimal(value: Any) -> Decimal | None:
    if value in (None, "", "-"):
        return None
    try:
        return Decimal(str(value).replace(",", "."))
    except InvalidOperation:
        return None


def _date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _rate_type(
    isin: str,
    ast: dict[str, Any],
    fields: dict[str, Any] | None = None,
) -> RateType:
    if _is_single_payment_instrument(fields or {}):
        return RateType.FIXED
    names = {item.get("name") for item in ast.get("benchmarks", [])}
    if isin.startswith("TRD") or names & {"TLREFK_RATE", "BIST_TLREFK_INDEX"}:
        return RateType.TLREFK
    if names & {"TLREF_RATE", "BIST_TLREF_INDEX"}:
        return RateType.TLREF
    if "CPI_REFERENCE_INDEX" in names:
        return RateType.CPI
    yield_type = str((fields or {}).get("yield_type_raw") or "").casefold()
    if "değişken" in yield_type or "variable" in yield_type:
        return RateType.FLOATING
    return RateType.FIXED


def _is_single_payment_instrument(fields: dict[str, Any]) -> bool:
    if fields.get("related_security_raw"):
        return True
    yield_type = str(fields.get("yield_type_raw") or "").casefold()
    if "iskontolu" in yield_type or "discounted" in yield_type:
        return True
    return (
        not fields.get("coupon_frequency_per_year")
        and not fields.get("next_coupon_date")
    )


def _coupon_frequency(fields: dict[str, Any]) -> int | None:
    raw = fields.get("coupon_frequency_per_year")
    if raw:
        return int(raw)
    if _is_single_payment_instrument(fields):
        return 1
    return None


def _formula_code(rate_type: RateType) -> str:
    return {
        RateType.FIXED: "BAP_FIXED_RATE",
        RateType.FLOATING: "BAP_FLOATING_RATE",
        RateType.TLREF: "BAP_TLREF",
        RateType.TLREFK: "BAP_TLREFK",
        RateType.CPI: "BAP_CPI_LINKED",
    }[rate_type]


def _default_quote_type(fields: dict[str, Any]) -> QuoteType:
    quotation_method = str(fields.get("quotation_method") or "")
    if (
        "kirli" in quotation_method.casefold()
        or "dirty" in quotation_method.casefold()
    ):
        return QuoteType.DIRTY_PRICE
    return QuoteType.CLEAN_PRICE


def _spread(ast: dict[str, Any]) -> Decimal:
    explicit = [
        _decimal(item.get("decimal"))
        for item in ast.get("spreads", [])
        if item.get("decimal") is not None
    ]
    return next((item for item in explicit if item is not None), Decimal("0"))


async def _resolved_contract_spread(
    db: AsyncSession,
    *,
    isin: str,
    ast: dict[str, Any],
) -> tuple[Decimal, str, int | None, str, tuple[str, ...]]:
    """Resolve spread without hiding missing or conflicting source evidence."""

    expected_lag = _observation_lag(ast)
    kap_term = await db.scalar(
        select(KapDerivedTerm)
        .where(
            KapDerivedTerm.isin == isin,
            KapDerivedTerm.term_type == "ANNUAL_SIMPLE_SPREAD",
            KapDerivedTerm.is_active.is_(True),
        )
        .order_by(KapDerivedTerm.id.desc())
        .limit(1)
    )
    if (
        kap_term is not None
        and kap_term.value_decimal is not None
        and kap_term.confidence
        in {
            "KAP_EXPLICIT",
            "KAP_MULTI_COUPON_VERIFIED",
            "KAP_SINGLE_COUPON_DERIVED",
        }
        and is_current_spread_derivation(
            confidence=kap_term.confidence,
            observation_lag_business_days=kap_term.observation_lag_business_days,
            evidence=kap_term.evidence,
            expected_lag=expected_lag,
        )
    ):
        assumptions = (
            (kap_term.confidence,)
            if kap_term.confidence == "KAP_SINGLE_COUPON_DERIVED"
            else ()
        )
        return (
            kap_term.value_decimal,
            kap_term.annuality or "ANNUAL_SIMPLE",
            (
                expected_lag
                if kap_term.confidence == "KAP_EXPLICIT"
                else kap_term.observation_lag_business_days
            ),
            kap_term.confidence,
            assumptions,
        )

    explicit = _spread(ast)
    if ast.get("spreads"):
        return (
            explicit,
            str(ast.get("spread_annuality") or "UNKNOWN"),
            expected_lag,
            "BIST_EXPLICIT",
            (),
        )
    if kap_term is not None and (
        kap_term.confidence == "KAP_CONFLICT"
        or (
            kap_term.value_decimal is not None
            and kap_term.confidence != "KAP_EXPLICIT"
        )
    ):
        return Decimal("0"), "ANNUAL_SIMPLE", None, "KAP_CONFLICT", ("KAP_CONFLICT",)
    return (
        Decimal("0"),
        "ANNUAL_SIMPLE",
        None,
        "SPREAD_UNKNOWN",
        ("CONTRACTUAL_SPREAD_NOT_VERIFIED",),
    )


def _coupon_period(
    *,
    issue_date: date,
    maturity_date: date,
    coupon_frequency: int,
    next_coupon_date: date | None,
    settlement_date: date,
    day_count: str | None,
    explicit_coupon_dates: tuple[date, ...],
) -> tuple[date, date, Decimal]:
    dates = coupon_schedule(
        issue_date=issue_date,
        maturity_date=maturity_date,
        frequency=coupon_frequency,
        next_coupon_date=next_coupon_date,
        explicit_coupon_dates=explicit_coupon_dates,
    )
    period_start, period_end = current_coupon_period(
        issue_date=issue_date,
        settlement_date=settlement_date,
        payment_dates=dates,
        frequency=coupon_frequency,
        next_coupon_date=next_coupon_date,
    )
    factor = year_fraction(period_start, period_end, parse_day_count(day_count))
    return period_start, period_end, factor


def _observation_lag(ast: dict[str, Any]) -> int:
    lags = {
        int(item["lag_business_days"])
        for item in ast.get("observation_lags", [])
        if item.get("lag_business_days") is not None
    }
    if len(lags) == 1:
        return next(iter(lags))
    # BIST TLREF/TLREFK endeks-değişimi kuponlarında sınır endeksleri
    # kupon başlangıç/bitiş tarihinin bir önceki iş günüdür (T-1).
    # Açık metin farklı bir lag verirse yukarıdaki dal her zaman önceliklidir.
    if ast.get("benchmark_mode") == "INDEX_CHANGE":
        return 1
    return 0


def _lagged_business_date(boundary: date, lag: int) -> date:
    if lag <= 0:
        return boundary
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary
    for _ in range(lag):
        target = calendar.previous_business_day(target)
    return target


def _next_business_day(boundary: date) -> date:
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary + timedelta(days=1)
    while not calendar.is_business_day(target):
        target += timedelta(days=1)
    return target


def _on_or_previous_business_day(boundary: date) -> date:
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary
    while not calendar.is_business_day(target):
        target -= timedelta(days=1)
    return target


async def _index_observation(
    db: AsyncSession,
    benchmark: str,
    target_date: date,
) -> BenchmarkObservation | None:
    return await db.scalar(
        select(BenchmarkObservation)
        .where(
            BenchmarkObservation.benchmark == benchmark,
            BenchmarkObservation.observation_date == target_date,
            BenchmarkObservation.index_value.is_not(None),
        )
        .limit(1)
    )


async def _resolve_coupon_rate_metrics(
    db: AsyncSession,
    *,
    isin: str = "",
    fields: dict[str, Any],
    ast: dict[str, Any],
    rate_type: RateType,
    issue_date: date,
    maturity_date: date,
    coupon_frequency: int,
    settlement_date: date,
    explicit_coupon_dates: tuple[date, ...],
    benchmark_input: BenchmarkInput | None,
    contractual_spread: Decimal | None = None,
    contractual_spread_annuality: str | None = None,
    contractual_observation_lag: int | None = None,
) -> CouponRateMetrics | None:
    if contractual_spread is None:
        contractual_spread = _spread(ast)
    if contractual_spread_annuality is None:
        contractual_spread_annuality = str(ast.get("spread_annuality") or "UNKNOWN")
    next_coupon_date = _date(fields.get("next_coupon_date"))
    # BIST/KAP yıllık basit ve bileşik kupon eşdeğerleri dönemsel oranı
    # gerçek dönem gün sayısı / 365 üzerinden yıllıklaştırır.
    coupon_day_count = "ACT/365F"
    try:
        period_start, period_end, full_factor = _coupon_period(
            issue_date=issue_date,
            maturity_date=maturity_date,
            coupon_frequency=coupon_frequency,
            next_coupon_date=next_coupon_date,
            settlement_date=settlement_date,
            day_count=coupon_day_count,
            explicit_coupon_dates=explicit_coupon_dates,
        )
    except ValuationError:
        # Coupon-rate enrichment must not mask the engine's typed schedule
        # failure or prevent valuation records from being persisted.
        return None
    kap_coupon = None
    if isin:
        kap_coupon = await db.scalar(
            select(KapCouponEvent)
            .join(KapDisclosure, KapDisclosure.id == KapCouponEvent.disclosure_id)
            .where(
                KapCouponEvent.isin == isin,
                KapCouponEvent.payment_date == period_end,
                KapCouponEvent.periodic_rate_decimal.is_not(None),
            )
            .order_by(KapDisclosure.published_at.desc(), KapDisclosure.id.desc())
            .limit(1)
        )
    if kap_coupon is not None:
        metrics = from_periodic_coupon(
            periodic_coupon_rate=kap_coupon.periodic_rate_decimal,
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            calculation_as_of=settlement_date,
        )
        return replace(
            metrics,
            status="PUBLISHED",
            confidence="SOURCE_PUBLISHED",
            is_final=True,
            assumptions=("KAP_PUBLISHED_COUPON_RATE",),
        )
    published_coupon_pct = _decimal(fields.get("next_coupon_rate_pct"))
    if published_coupon_pct is not None and (
        published_coupon_pct > 0 or rate_type == RateType.FIXED
    ):
        return from_periodic_coupon(
            periodic_coupon_rate=published_coupon_pct / Decimal("100"),
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            calculation_as_of=settlement_date,
        )

    if rate_type == RateType.CPI:
        return None

    if ast.get("benchmark_mode") == "INDEX_CHANGE" and rate_type in {
        RateType.TLREF,
        RateType.TLREFK,
    }:
        benchmark_name = rate_type.value
        lag = (
            contractual_observation_lag
            if contractual_observation_lag is not None
            else _observation_lag(ast)
        )
        start_target = _lagged_business_date(period_start, lag)
        required_end_target = _lagged_business_date(period_end, lag)
        start_observation = await _index_observation(db, benchmark_name, start_target)
        is_final = required_end_target <= settlement_date
        end_target = (
            required_end_target
            if is_final
            else _lagged_business_date(min(settlement_date, period_end), lag)
        )
        end_observation = await _index_observation(db, benchmark_name, end_target)
        if start_observation is None or end_observation is None:
            raise ValuationError(
                ValuationFailureCode.MISSING_BENCHMARK,
                "Sözleşmesel T-1 endeks gözlemi bulunamadı.",
                context={
                    "benchmark": benchmark_name,
                    "start_target": start_target.isoformat(),
                    "end_target": end_target.isoformat(),
                    "observation_lag_business_days": lag,
                },
            )
        if (
            start_observation.index_value is None
            or end_observation.index_value is None
        ):
            raise ValuationError(
                ValuationFailureCode.MISSING_BENCHMARK,
                "Sözleşmesel T-1 endeks gözleminin değeri eksik.",
                context={
                    "benchmark": benchmark_name,
                    "start_target": start_target.isoformat(),
                    "end_target": end_target.isoformat(),
                },
            )
        if end_observation.observation_date <= start_observation.observation_date:
            # At the start of a coupon period the T-1 boundary observation and
            # the latest available observation can be identical.  No index
            # return exists yet; continue to the explicit TLREF-rate proxy
            # below instead of suppressing theoretical valuation.
            if end_target != start_target:
                raise ValuationError(
                    ValuationFailureCode.MISSING_BENCHMARK,
                    "Endeks gözlem aralığı pozitif değil.",
                    context={
                        "benchmark": benchmark_name,
                        "start_target": start_target.isoformat(),
                        "end_target": end_target.isoformat(),
                    },
                )
        else:
            if (
                is_final
                and end_observation.observation_date
                != _on_or_previous_business_day(required_end_target)
            ):
                is_final = False
            elapsed_projection_days = (
                _next_business_day(end_observation.observation_date)
                - _next_business_day(start_observation.observation_date)
            ).days
            if elapsed_projection_days > 0:
                annuality = contractual_spread_annuality
                if annuality not in {"ANNUAL_SIMPLE", "PERIODIC"}:
                    annuality = "UNKNOWN"
                return from_index_change(
                    start_index_value=start_observation.index_value,
                    end_index_value=end_observation.index_value,
                    start_index_date=start_observation.observation_date,
                    end_index_date=end_observation.observation_date,
                    period_start=period_start,
                    period_end=period_end,
                    coupon_frequency=coupon_frequency,
                    full_period_year_fraction=full_factor,
                    full_period_days=(period_end - period_start).days,
                    elapsed_projection_days=elapsed_projection_days,
                    spread_decimal=contractual_spread,
                    spread_annuality=annuality,
                    calculation_as_of=end_observation.observation_date,
                    is_final=is_final,
                    observation_lag_business_days=lag,
                )

    if rate_type in {RateType.TLREF, RateType.TLREFK} and benchmark_input is not None:
        spread = contractual_spread
        annuality = contractual_spread_annuality
        assumptions: tuple[str, ...] = ()
        if ast.get("benchmark_mode") == "INDEX_CHANGE":
            assumptions += ("INDEX_CHANGE_UNAVAILABLE_TLREF_RATE_PROXY",)
        if annuality == "PERIODIC":
            annual_spread = spread / full_factor
        else:
            annual_spread = spread
            if annuality == "UNKNOWN" and spread:
                assumptions += (
                    "UNQUALIFIED_SPREAD_TREATED_AS_ANNUAL_SIMPLE",
                )
        return from_annual_simple_coupon(
            annual_simple_rate=benchmark_input.annual_rate_decimal + annual_spread,
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            calculation_as_of=benchmark_input.observation_date,
            status="INDICATIVE",
            confidence="ASSUMPTION_REQUIRED" if assumptions else "EXACT_CONTRACT",
            is_final=False,
            assumptions=assumptions,
        )
    return None


def _instrument_payload(
    instrument: Instrument,
    version: InstrumentVersion,
    rule: InstrumentTermRule | None,
) -> dict[str, Any]:
    fields = version.canonical_fields_json
    ast = rule.ast_json if rule else {}
    maturity = version.maturity_date
    today = turkey_today()
    days_to_maturity = (maturity - today).days if maturity else None
    default_quote_type = _default_quote_type(fields)
    return {
        "id": instrument.id,
        "version_id": version.id,
        "isin": instrument.isin,
        "isin_code": instrument.isin,
        "instrument_family": instrument.instrument_family,
        "issuer": version.issuer_name,
        "issuer_name": version.issuer_name,
        "maturity_date": maturity.isoformat() if maturity else None,
        "days_to_maturity": days_to_maturity,
        "currency": fields.get("currency_or_unit") or "TRY",
        "security_type": version.security_type_raw,
        "yield_type": version.yield_type_raw,
        "coupon_frequency": _coupon_frequency(fields),
        "first_issue_date": fields.get("first_issue_date"),
        "next_coupon_date": fields.get("next_coupon_date"),
        "next_coupon_rate_pct": fields.get("next_coupon_rate_pct"),
        "next_coupon_rate": fields.get("next_coupon_rate_pct"),
        "group_code": version.group_code,
        "remarks_raw": fields.get("remarks_raw"),
        "remarks": fields.get("remarks_raw"),
        "issuance_type": fields.get("issuance_type_raw"),
        "quotation_method": fields.get("quotation_method"),
        "default_quote_type": default_quote_type.value,
        "day_count_convention": fields.get("day_count_convention"),
        "total_issue_amount": fields.get("total_issue_amount_thousands"),
        "last_issue_price": None,
        "last_issue_yield": None,
        "first_issue_price": fields.get("first_issue_price"),
        "first_issue_yield": fields.get("first_issue_yield_annual_simple_pct"),
        "spread": None,
        "contractual_spread_decimal": str(_spread(ast)),
        "is_active": bool(maturity is None or maturity >= today),
        "calculated_metrics": None,
        "term_rule_ast": ast,
        "quality": {
            "parse_status": version.parse_status,
            "valuation_eligible": version.valuation_eligible,
            "diagnostics": ast.get("diagnostics", []),
        },
        "price_status": "SYSTEM_NOMINAL_100",
        "source": {
            "source_file_id": version.source_file_id,
            "source_row": version.source_row_number,
            "parser_version": rule.parser_version if rule else None,
            "ast_schema_version": rule.ast_schema_version if rule else None,
        },
        "fields": fields,
    }


async def _instrument_version(
    db: AsyncSession,
    isin: str,
) -> tuple[Instrument, InstrumentVersion, InstrumentTermRule | None] | None:
    result = await db.execute(
        select(Instrument, InstrumentVersion, InstrumentTermRule)
        .join(InstrumentVersion, InstrumentVersion.instrument_id == Instrument.id)
        .outerjoin(
            InstrumentTermRule,
            InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
        )
        .where(
            Instrument.isin == isin.upper(),
            InstrumentVersion.is_published.is_(True),
        )
        .order_by(
            InstrumentVersion.valuation_eligible.desc(),
            InstrumentVersion.id.desc(),
        )
        .limit(1)
    )
    return result.one_or_none()


@router.get("/instruments", response_model=InstrumentListResponse)
async def list_instruments(
    search: str | None = None,
    parse_status: str | None = None,
    valuation_eligible: bool | None = None,
    security_type: str | None = None,
    yield_type: str | None = None,
    currency: str | None = None,
    active_only: bool = True,
    instrument_status: InstrumentStatus | None = Query(default=None, alias="status"),
    maturity_within_days: int | None = Query(None, ge=1, le=36500),
    order_by: str = Query("isin", pattern="^(isin|issuer|maturity)$"),
    order_direction: str = Query("asc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=3000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    query = (
        select(Instrument, InstrumentVersion, InstrumentTermRule)
        .join(InstrumentVersion, InstrumentVersion.instrument_id == Instrument.id)
        .outerjoin(
            InstrumentTermRule,
            InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
        )
        .where(InstrumentVersion.is_published.is_(True))
    )
    if search:
        candidate = f"%{search.strip()}%"
        query = query.where(
            Instrument.isin.ilike(candidate) | InstrumentVersion.issuer_name.ilike(candidate)
        )
    if parse_status:
        query = query.where(InstrumentVersion.parse_status == parse_status.upper())
    if valuation_eligible is not None:
        query = query.where(InstrumentVersion.valuation_eligible.is_(valuation_eligible))
    if security_type:
        query = query.where(InstrumentVersion.security_type_raw == security_type)
    if yield_type:
        query = query.where(InstrumentVersion.yield_type_raw == yield_type)
    if currency:
        query = query.where(
            InstrumentVersion.canonical_fields_json["currency_or_unit"].as_string()
            == currency
        )
    today = turkey_today()
    effective_status: InstrumentStatus = (
        instrument_status
        if instrument_status is not None
        else ("active" if active_only else "all")
    )
    if effective_status == "active":
        query = query.where(
            (InstrumentVersion.maturity_date.is_(None))
            | (InstrumentVersion.maturity_date >= today)
        )
    elif effective_status == "matured":
        query = query.where(
            InstrumentVersion.maturity_date.is_not(None),
            InstrumentVersion.maturity_date < today,
        )
    if maturity_within_days is not None:
        query = query.where(
            InstrumentVersion.maturity_date.between(
                today,
                today + timedelta(days=maturity_within_days),
            )
        )
    order_column = {
        "isin": Instrument.isin,
        "issuer": InstrumentVersion.issuer_name,
        "maturity": InstrumentVersion.maturity_date,
    }[order_by]
    direction = order_column.desc() if order_direction == "desc" else order_column.asc()
    rows = (
        await db.execute(query.order_by(direction, InstrumentVersion.id.desc()))
    ).all()
    unique: dict[int, tuple[Instrument, InstrumentVersion, InstrumentTermRule | None]] = {}
    for row in rows:
        unique.setdefault(row[0].id, row)
    selected = list(unique.values())
    return InstrumentListResponse(
        items=[
            _instrument_payload(instrument, version, rule)
            for instrument, version, rule in selected[skip : skip + limit]
        ],
        total=len(selected),
    )


@router.get("/instruments/{isin}")
async def get_instrument(
    isin: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    row = await _instrument_version(db, isin)
    if row is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    instrument, version, rule = row
    payload = _instrument_payload(instrument, version, rule)
    source = await db.get(SourceFile, version.source_file_id)
    if source is not None:
        payload["source"].update(
            {
                "filename": source.filename,
                "effective_date": (
                    source.effective_date.isoformat()
                    if source.effective_date
                    else None
                ),
                "requested_business_date": (
                    source.requested_business_date.isoformat()
                    if source.requested_business_date
                    else None
                ),
                "date_origin": source.date_origin,
                "freshness_status": source.freshness_status,
                "sha256": source.sha256,
            }
        )
    favorite = await db.scalar(
        select(UserFavoriteInstrument.id).where(
            UserFavoriteInstrument.user_id == user.id,
            UserFavoriteInstrument.instrument_id == instrument.id,
        )
    )
    note = await db.scalar(
        select(InstrumentUserNote.note_text).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument.id,
        )
    )
    kap_term = await db.scalar(
        select(KapDerivedTerm)
        .where(
            KapDerivedTerm.isin == instrument.isin,
            KapDerivedTerm.is_active.is_(True),
        )
        .order_by(KapDerivedTerm.id.desc())
        .limit(1)
    )
    latest_kap = await db.scalar(
        select(KapDisclosure)
        .where(KapDisclosure.isin == instrument.isin)
        .order_by(KapDisclosure.fetched_at.desc())
        .limit(1)
    )
    fields = version.canonical_fields_json
    ast = rule.ast_json if rule else {}
    rate_type = _rate_type(instrument.isin, ast, fields)
    has_bist_spread = any(
        item.get("decimal") is not None for item in ast.get("spreads", [])
    )
    expected_observation_lag = _observation_lag(ast)
    kap_lag_is_current = kap_term is not None and is_current_spread_derivation(
        confidence=kap_term.confidence,
        observation_lag_business_days=kap_term.observation_lag_business_days,
        evidence=kap_term.evidence,
        expected_lag=expected_observation_lag,
    )
    has_verified_kap_spread = (
        kap_term is not None
        and kap_term.value_decimal is not None
        and kap_lag_is_current
        and kap_term.confidence
        in {
            "KAP_EXPLICIT",
            "KAP_MULTI_COUPON_VERIFIED",
            "KAP_SINGLE_COUPON_DERIVED",
        }
    )
    backfill_request = await db.scalar(
        select(KapBackfillRequest).where(
            KapBackfillRequest.isin == instrument.isin
        )
    )
    should_backfill = (
        settings.KAP_INGESTION_ENABLED
        and rate_type in {RateType.TLREF, RateType.TLREFK}
        and not has_bist_spread
        and not has_verified_kap_spread
    )
    backfill_queued = False
    if should_backfill:
        from app.services.kap_ingestion import KapEnrichmentService

        should_dispatch = (
            backfill_request is None
            or backfill_request.status not in {"QUEUED", "RUNNING", "RETRY"}
        )
        queued_request = await KapEnrichmentService(db, settings).enqueue_backfill(
            instrument.isin,
            reason="USER_INSTRUMENT_VIEW",
            priority=0,
        )
        if queued_request is not None:
            backfill_request = queued_request
            backfill_queued = should_dispatch and queued_request.status == "QUEUED"
            # The worker must see the queue row before the task is published.
            await db.commit()

    active_backfill_status = (
        backfill_request.status
        if backfill_request is not None
        and backfill_request.status in {"QUEUED", "RUNNING", "RETRY"}
        else None
    )
    if has_verified_kap_spread:
        kap_status = kap_term.confidence
    elif has_bist_spread:
        kap_status = "BIST_EXPLICIT"
    elif active_backfill_status:
        kap_status = active_backfill_status
    elif kap_term is not None:
        kap_status = kap_term.confidence
    elif backfill_request is not None:
        kap_status = backfill_request.status
    elif settings.KAP_INGESTION_ENABLED:
        kap_status = "PENDING"
    else:
        kap_status = "DISABLED"
    payload["kap_enrichment"] = {
        "status": kap_status,
        "spread_decimal": (
            str(kap_term.value_decimal)
            if has_verified_kap_spread and kap_term.value_decimal is not None
            else None
        ),
        "annuality": kap_term.annuality if kap_term else None,
        "benchmark": kap_term.benchmark if kap_term else None,
        "supporting_disclosure_ids": kap_term.supporting_disclosure_ids if kap_term else [],
        "last_fetched_at": latest_kap.fetched_at if latest_kap else None,
        "backfill": (
            {
                "status": backfill_request.status,
                "attempt_count": backfill_request.attempt_count,
                "requested_at": backfill_request.requested_at,
                "started_at": backfill_request.started_at,
                "completed_at": backfill_request.completed_at,
                "last_error": backfill_request.last_error,
            }
            if backfill_request is not None
            else None
        ),
    }
    if backfill_queued:
        try:
            from app.tasks.data_tasks import process_kap_backfill_queue

            process_kap_backfill_queue.delay()
        except Exception:
            logger.warning("Could not queue targeted KAP backfill", exc_info=True)
    payload["is_favorite"] = favorite is not None
    payload["note_text"] = note
    await MetricsService.track_instrument_view(
        db,
        instrument_id=instrument.id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return payload


@router.get("/benchmarks")
async def list_benchmarks(
    benchmark: str | None = None,
    limit: int = Query(100, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    query = select(BenchmarkObservation)
    if benchmark:
        query = query.where(BenchmarkObservation.benchmark == benchmark.upper())
    rows = (
        await db.execute(
            query.order_by(BenchmarkObservation.observation_date.desc()).limit(limit)
        )
    ).scalars()
    return {
        "items": [
            {
                "benchmark": item.benchmark,
                "observation_date": item.observation_date.isoformat(),
                "published_annual_rate_pct": (
                    str(item.published_annual_rate_pct)
                    if item.published_annual_rate_pct is not None
                    else None
                ),
                "annual_rate_decimal": (
                    str(item.annual_rate_decimal)
                    if item.annual_rate_decimal is not None
                    else None
                ),
                "index_value": str(item.index_value) if item.index_value is not None else None,
                "source_file_ids": [
                    value
                    for value in (item.rate_source_file_id, item.index_source_file_id)
                    if value is not None
                ],
            }
            for item in rows
        ]
    }


@router.get("/instrument-stats")
async def instrument_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    rows = (
        await db.execute(
            select(InstrumentVersion)
            .where(InstrumentVersion.is_published.is_(True))
            .order_by(InstrumentVersion.instrument_id, InstrumentVersion.id.desc())
        )
    ).scalars()
    unique: dict[int, InstrumentVersion] = {}
    for row in rows:
        unique.setdefault(row.instrument_id, row)
    versions = list(unique.values())

    def counts(field: str) -> dict[str, int]:
        result: dict[str, int] = {}
        for version in versions:
            value = version.canonical_fields_json.get(field)
            if value:
                result[str(value)] = result.get(str(value), 0) + 1
        return result

    maturity_days = [
        (item.maturity_date - turkey_today()).days
        for item in versions
        if item.maturity_date is not None
    ]
    return {
        "total_bonds": len(versions),
        "by_security_type": counts("security_type_raw"),
        "by_currency": counts("currency_or_unit"),
        "by_yield_type": counts("yield_type_raw"),
        "avg_days_to_maturity": (
            sum(maturity_days) / len(maturity_days) if maturity_days else None
        ),
        "price_policy": "SYSTEM_NOMINAL_100",
    }


@router.get("/instruments/{isin}/price-history")
async def instrument_price_history(
    isin: str,
    days: int = Query(90, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    rows = (
        await db.execute(
            select(PriceObservation)
            .where(
                PriceObservation.instrument_id == instrument_id,
                PriceObservation.user_id == user.id,
            )
            .order_by(PriceObservation.quote_date.desc())
            .limit(days)
        )
    ).scalars()
    return {
        "items": [
            {
                "date": item.quote_date.isoformat(),
                "clean_price": (
                    str(item.quote_value)
                    if item.quote_type == QuoteType.CLEAN_PRICE.value
                    else None
                ),
                "ytm": (
                    str(item.quote_value)
                    if item.quote_type == QuoteType.ANNUAL_YIELD.value
                    else None
                ),
                "quote_type": item.quote_type,
                "source": item.source_type,
            }
            for item in rows
        ]
    }


@router.get("/yield-curve")
async def verified_yield_curve(
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    return {
        "items": [],
        "status": "PRICE_REQUIRED",
        "message": "Açık kullanıcı fiyatı olmadan piyasa getiri eğrisi üretilmez.",
    }


@router.post("/valuations", response_model=ValuationResponse)
async def create_valuation(
    payload: ValuationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not settings.VALUATION_V2_WRITE_ENABLED:
        raise HTTPException(status_code=503, detail="Verified v2 write path is disabled")
    row = await _instrument_version(db, payload.isin)
    if row is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    instrument, version, rule = row
    fields = version.canonical_fields_json
    ast = rule.ast_json if rule else {}
    issue_date = _date(fields.get("first_issue_date"))
    maturity_date = version.maturity_date
    frequency = _coupon_frequency(fields)
    if issue_date is None or maturity_date is None or not frequency:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Instrument schedule fields are incomplete",
        )
    rate_type = _rate_type(instrument.isin, ast, fields)
    published_coupon_pct = _decimal(fields.get("next_coupon_rate_pct"))
    annual_coupon_rate = (
        published_coupon_pct / Decimal("100")
        if published_coupon_pct is not None
        and (
            published_coupon_pct > 0
            or rate_type == RateType.FIXED
        )
        else Decimal("0") if _is_single_payment_instrument(fields) else None
    )
    benchmark_input = None
    valuation_assumptions: tuple[str, ...] = ()
    if (
        not fields.get("coupon_frequency_per_year")
        and not fields.get("next_coupon_date")
        and not fields.get("related_security_raw")
        and "iskontolu" not in str(fields.get("yield_type_raw") or "").casefold()
        and "discounted" not in str(fields.get("yield_type_raw") or "").casefold()
    ):
        valuation_assumptions = (
            "MISSING_COUPON_STRUCTURE_SINGLE_PAYMENT_SCENARIO",
        )
    if rate_type in {RateType.TLREF, RateType.TLREFK}:
        benchmark_target = _lagged_business_date(
            payload.settlement_date,
            _observation_lag(ast),
        )
        benchmark_row = await db.scalar(
            select(BenchmarkObservation)
            .where(
                BenchmarkObservation.benchmark == rate_type.value,
                BenchmarkObservation.observation_date == benchmark_target,
                BenchmarkObservation.annual_rate_decimal.is_not(None),
            )
            .limit(1)
        )
        if benchmark_row is not None:
            benchmark_input = BenchmarkInput(
                name=benchmark_row.benchmark,
                observation_date=benchmark_row.observation_date,
                annual_rate_decimal=benchmark_row.annual_rate_decimal,
                source_file_id=benchmark_row.rate_source_file_id,
                source_row=benchmark_row.rate_source_row,
            )
    effective_cpi_ratio = payload.cpi_ratio
    if rate_type == RateType.CPI and effective_cpi_ratio is None:
        effective_cpi_ratio = Decimal("1")
        valuation_assumptions = ("CPI_RATIO_1_REAL_TERMS_SCENARIO",)

    if rate_type in {RateType.TLREF, RateType.TLREFK, RateType.FLOATING}:
        (
            contractual_spread,
            contractual_spread_annuality,
            contractual_observation_lag,
            contractual_spread_confidence,
            spread_assumptions,
        ) = await _resolved_contract_spread(db, isin=instrument.isin, ast=ast)
    else:
        contractual_spread = Decimal("0")
        contractual_spread_annuality = "ANNUAL_SIMPLE"
        contractual_observation_lag = None
        contractual_spread_confidence = "NOT_APPLICABLE"
        spread_assumptions = ()
    valuation_assumptions += spread_assumptions
    if contractual_spread_confidence in {"KAP_CONFLICT", "SPREAD_UNKNOWN"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CONTRACTUAL_SPREAD_NOT_VERIFIED",
                "message": (
                    "Sözleşmesel spread T-1 geçmişiyle doğrulanmadan "
                    "değerleme üretilemez."
                ),
                "confidence": contractual_spread_confidence,
            },
        )
    if contractual_spread_confidence.startswith("KAP_") and not spread_assumptions:
        valuation_assumptions += (
            f"CONTRACTUAL_SPREAD_SOURCE_{contractual_spread_confidence}",
        )
    coupon_rate_metrics = await _resolve_coupon_rate_metrics(
        db,
        isin=instrument.isin,
        fields=fields,
        ast=ast,
        rate_type=rate_type,
        issue_date=issue_date,
        maturity_date=maturity_date,
        coupon_frequency=int(frequency),
        settlement_date=payload.settlement_date,
        explicit_coupon_dates=tuple(payload.explicit_coupon_dates),
        benchmark_input=benchmark_input,
        contractual_spread=contractual_spread,
        contractual_spread_annuality=contractual_spread_annuality,
        contractual_observation_lag=contractual_observation_lag,
    )
    if coupon_rate_metrics is not None:
        annual_coupon_rate = coupon_rate_metrics.annual_simple_rate
        valuation_assumptions += coupon_rate_metrics.assumptions
    if rate_type == RateType.FLOATING and annual_coupon_rate is None:
        issue_scenario_pct = (
            _decimal(fields.get("last_issue_yield_annual_simple_pct"))
            or _decimal(fields.get("first_issue_yield_annual_simple_pct"))
        )
        if issue_scenario_pct is not None and issue_scenario_pct > 0:
            annual_coupon_rate = issue_scenario_pct / Decimal("100")
            valuation_assumptions += (
                "ISSUE_YIELD_USED_AS_FLAT_COUPON_SCENARIO",
            )
        else:
            annual_coupon_rate = Decimal("0")
            valuation_assumptions += (
                "UNPUBLISHED_VARIABLE_COUPON_ZERO_SCENARIO",
            )

    price = PriceObservation(
        instrument_id=instrument.id,
        instrument_version_id=version.id,
        user_id=user.id,
        quote_type=payload.quote_type,
        quote_value=payload.quote_value,
        quote_date=payload.quote_date or turkey_today(),
        settlement_date=payload.settlement_date,
        currency=fields.get("currency_or_unit") or "TRY",
        source_type=payload.quote_source,
        confidence=(
            "SYSTEM_ASSUMPTION"
            if payload.quote_source == "SYSTEM_NOMINAL_100"
            else "USER_PROVIDED"
        ),
        raw_payload={
            "quote_type": payload.quote_type,
            "quote_value": str(payload.quote_value),
            "quote_source": payload.quote_source,
            "quote_date": (payload.quote_date or turkey_today()).isoformat(),
            "settlement_date": payload.settlement_date.isoformat(),
        },
    )
    db.add(price)
    await db.flush()
    request_record = ValuationRequestRecord(
        instrument_version_id=version.id,
        user_id=user.id,
        price_observation_id=price.id,
        engine_version=ValuationEngine.VERSION,
        request_payload=payload.model_dump(mode="json"),
        status="RUNNING",
    )
    db.add(request_record)
    await db.flush()

    terms = InstrumentTerms(
        isin=instrument.isin,
        issue_date=issue_date,
        maturity_date=maturity_date,
        coupon_frequency=int(frequency),
        annual_coupon_rate=annual_coupon_rate,
        rate_type=rate_type,
        benchmark_spread_decimal=contractual_spread,
        nominal=Decimal("100"),
        day_count=fields.get("day_count_convention") or "ACT/365F",
        next_coupon_date=_date(fields.get("next_coupon_date")),
        explicit_coupon_dates=tuple(payload.explicit_coupon_dates),
        parse_status=version.parse_status,
        formula_code=_formula_code(rate_type),
        source_file_id=version.source_file_id,
        source_row=version.source_row_number,
        parser_version=rule.parser_version if rule else None,
        coupon_rate_metrics=coupon_rate_metrics,
        valuation_assumptions=valuation_assumptions,
    )
    try:
        result = ValuationEngine().value(
            terms,
            settlement_date=payload.settlement_date,
            price_input=PriceInput(
                QuoteType(payload.quote_type),
                payload.quote_value,
                source=payload.quote_source,
            ),
            benchmark=benchmark_input,
            cpi_ratio=effective_cpi_ratio,
        )
        result_payload = result.to_dict()
        request_record.status = "COMPLETED"
        request_record.completed_at = utc_now()
        db.add(
            ValuationResultRecord(
                request_id=request_record.id,
                success=True,
                result_payload=result_payload,
                intermediates=result.intermediates,
                provenance=result.provenance,
            )
        )
        await db.commit()
        return ValuationResponse(
            request_id=request_record.id,
            success=True,
            result=result_payload,
        )
    except ValuationError as exc:
        request_record.status = "FAILED"
        request_record.completed_at = utc_now()
        failure = exc.to_dict()
        db.add(
            ValuationResultRecord(
                request_id=request_record.id,
                success=False,
                failure_code=exc.code.value,
                failure_message=str(exc),
                provenance={
                    "instrument_source_file_id": version.source_file_id,
                    "instrument_source_row": version.source_row_number,
                    "parser_version": rule.parser_version if rule else None,
                    "engine_version": ValuationEngine.VERSION,
                },
            )
        )
        await db.commit()
        return ValuationResponse(
            request_id=request_record.id,
            success=False,
            failure=failure,
        )


@router.get("/valuations/{request_id}", response_model=ValuationResponse)
async def get_valuation(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    row = (
        await db.execute(
            select(ValuationRequestRecord, ValuationResultRecord)
            .join(
                ValuationResultRecord,
                ValuationResultRecord.request_id == ValuationRequestRecord.id,
            )
            .where(
                ValuationRequestRecord.id == request_id,
                ValuationRequestRecord.user_id == user.id,
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Valuation not found")
    request_record, result = row
    return ValuationResponse(
        request_id=request_record.id,
        success=result.success,
        result=result.result_payload,
        failure=(
            {
                "code": result.failure_code,
                "message": result.failure_message,
                "context": {},
            }
            if not result.success
            else None
        ),
    )


@router.get("/favorites")
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    rows = (
        await db.execute(
            select(Instrument, InstrumentVersion, InstrumentTermRule)
            .join(
                UserFavoriteInstrument,
                UserFavoriteInstrument.instrument_id == Instrument.id,
            )
            .join(
                InstrumentVersion,
                InstrumentVersion.instrument_id == Instrument.id,
            )
            .outerjoin(
                InstrumentTermRule,
                InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
            )
            .where(
                UserFavoriteInstrument.user_id == user.id,
                InstrumentVersion.is_published.is_(True),
            )
            .order_by(Instrument.isin, InstrumentVersion.id.desc())
        )
    ).all()
    unique: dict[int, tuple[Instrument, InstrumentVersion, InstrumentTermRule | None]] = {}
    for row in rows:
        unique.setdefault(row[0].id, row)
    details = [
        _instrument_payload(instrument, version, rule)
        for instrument, version, rule in unique.values()
    ]
    return {
        "items": [item["isin"] for item in details],
        "details": details,
        "total": len(details),
    }


@router.get("/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    today = turkey_today()
    version_rows = (
        await db.execute(
            select(InstrumentVersion)
            .where(InstrumentVersion.is_published.is_(True))
            .order_by(InstrumentVersion.instrument_id, InstrumentVersion.id.desc())
        )
    ).scalars()
    latest_versions: dict[int, InstrumentVersion] = {}
    for version in version_rows:
        latest_versions.setdefault(version.instrument_id, version)
    versions = list(latest_versions.values())
    isin_by_id = dict(
        (
            await db.execute(
                select(Instrument.id, Instrument.isin).where(
                    Instrument.id.in_([version.instrument_id for version in versions])
                )
            )
        ).all()
    ) if versions else {}
    favorite_count = (
        await db.scalar(
            select(func.count(UserFavoriteInstrument.id)).where(
                UserFavoriteInstrument.user_id == user.id
            )
        )
        or 0
    )
    benchmarks: dict[str, Any] = {}
    for name in ("TLREF", "TLREFK"):
        observation = await db.scalar(
            select(BenchmarkObservation)
            .where(BenchmarkObservation.benchmark == name)
            .order_by(BenchmarkObservation.observation_date.desc())
            .limit(1)
        )
        benchmarks[name] = (
            {
                "observation_date": observation.observation_date.isoformat(),
                "published_annual_rate_pct": (
                    str(observation.published_annual_rate_pct)
                    if observation.published_annual_rate_pct is not None
                    else None
                ),
                "index_value": (
                    str(observation.index_value)
                    if observation.index_value is not None
                    else None
                ),
            }
            if observation
            else None
        )
    latest_source = await db.scalar(
        select(SourceFile)
        .where(SourceFile.source_kind == "TBLISTE", SourceFile.status == "PUBLISHED")
        .order_by(SourceFile.effective_date.desc(), SourceFile.id.desc())
        .limit(1)
    )
    due = sorted(
        (
            version
            for version in versions
            if version.maturity_date is not None
            and today <= version.maturity_date <= today + timedelta(days=90)
        ),
        key=lambda version: version.maturity_date,
    )
    return {
        "as_of_date": today.isoformat(),
        "total_instruments": len(versions),
        "active_instruments": sum(
            version.maturity_date is None or version.maturity_date >= today
            for version in versions
        ),
        "valuation_eligible": sum(version.valuation_eligible for version in versions),
        "favorite_count": favorite_count,
        "benchmarks": benchmarks,
        "source": (
            {
                "filename": latest_source.filename,
                "effective_date": (
                    latest_source.effective_date.isoformat()
                    if latest_source.effective_date
                    else None
                ),
                "requested_business_date": (
                    latest_source.requested_business_date.isoformat()
                    if latest_source.requested_business_date
                    else None
                ),
                "freshness_status": latest_source.freshness_status,
                "date_origin": latest_source.date_origin,
            }
            if latest_source
            else None
        ),
        "maturing_soon": [
            {
                "isin": isin_by_id.get(version.instrument_id),
                "issuer": version.issuer_name,
                "maturity_date": version.maturity_date.isoformat(),
                "days_to_maturity": (version.maturity_date - today).days,
            }
            for version in due[:10]
        ],
    }


@router.post("/favorites/{isin}", status_code=201)
async def add_favorite(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument = await db.scalar(select(Instrument).where(Instrument.isin == isin.upper()))
    if instrument is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    existing = await db.scalar(
        select(UserFavoriteInstrument.id).where(
            UserFavoriteInstrument.user_id == user.id,
            UserFavoriteInstrument.instrument_id == instrument.id,
        )
    )
    if existing is None:
        db.add(UserFavoriteInstrument(user_id=user.id, instrument_id=instrument.id))
        await db.commit()
    return {"status": "favorite", "isin": instrument.isin}


@router.delete("/favorites/{isin}", status_code=204)
async def remove_favorite(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is not None:
        await db.execute(
            delete(UserFavoriteInstrument).where(
                UserFavoriteInstrument.user_id == user.id,
                UserFavoriteInstrument.instrument_id == instrument_id,
            )
        )
        await db.commit()


@router.put("/instruments/{isin}/note")
async def upsert_note(
    isin: str,
    payload: InstrumentNoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument = await db.scalar(select(Instrument).where(Instrument.isin == isin.upper()))
    if instrument is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    note = await db.scalar(
        select(InstrumentUserNote).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument.id,
        )
    )
    if note is None:
        note = InstrumentUserNote(
            user_id=user.id,
            instrument_id=instrument.id,
            note_text=payload.note_text,
        )
        db.add(note)
    else:
        note.note_text = payload.note_text
    await db.commit()
    return {"isin": instrument.isin, "note_text": note.note_text}


@router.get("/instruments/{isin}/note")
async def get_note(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    note = await db.scalar(
        select(InstrumentUserNote).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument_id,
        )
    )
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return {
        "isin_code": isin.upper(),
        "note_text": note.note_text,
        "updated_at": note.updated_at,
    }


@router.delete("/instruments/{isin}/note", status_code=204)
async def delete_note(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is not None:
        await db.execute(
            delete(InstrumentUserNote).where(
                InstrumentUserNote.user_id == user.id,
                InstrumentUserNote.instrument_id == instrument_id,
            )
        )
        await db.commit()


@router.get("/quality")
async def get_quality(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    published = await db.scalar(
        select(func.count(InstrumentVersion.id)).where(
            InstrumentVersion.is_published.is_(True)
        )
    )
    eligible = await db.scalar(
        select(func.count(InstrumentVersion.id)).where(
            InstrumentVersion.is_published.is_(True),
            InstrumentVersion.valuation_eligible.is_(True),
        )
    )
    latest = await db.scalar(
        select(ImportRun).where(ImportRun.status == "PUBLISHED").order_by(
            ImportRun.finished_at.desc()
        )
    )
    latest_source = await db.scalar(
        select(SourceFile)
        .where(SourceFile.status == "PUBLISHED")
        .order_by(SourceFile.effective_date.desc(), SourceFile.id.desc())
        .limit(1)
    )
    latest_bootstrap = await db.scalar(
        select(BootstrapRun).order_by(BootstrapRun.id.desc()).limit(1)
    )
    kap_disclosures = await db.scalar(select(func.count(KapDisclosure.id)))
    kap_coupon_events = await db.scalar(select(func.count(KapCouponEvent.id)))
    kap_active_terms = await db.scalar(
        select(func.count(KapDerivedTerm.id)).where(KapDerivedTerm.is_active.is_(True))
    )
    kap_conflicts = await db.scalar(
        select(func.count(KapDerivedTerm.id)).where(
            KapDerivedTerm.is_active.is_(True),
            KapDerivedTerm.confidence == "KAP_CONFLICT",
        )
    )
    kap_backfills_pending = await db.scalar(
        select(func.count(KapBackfillRequest.id)).where(
            KapBackfillRequest.status.in_(["QUEUED", "RUNNING", "RETRY"])
        )
    )
    kap_backfills_failed = await db.scalar(
        select(func.count(KapBackfillRequest.id)).where(
            KapBackfillRequest.status.in_(["NOT_FOUND", "FAILED"])
        )
    )
    kap_poll_state = await db.get(KapIngestionState, "incremental_poll")
    return {
        "published_versions": published or 0,
        "valuation_eligible_versions": eligible or 0,
        "latest_import": (
            {
                "id": latest.id,
                "parser": latest.parser_name,
                "parser_version": latest.parser_version,
                "finished_at": latest.finished_at,
                "quality_report": latest.quality_report,
            }
            if latest
            else None
        ),
        "latest_source": (
            {
                "kind": latest_source.source_kind,
                "filename": latest_source.filename,
                "effective_date": (
                    latest_source.effective_date.isoformat()
                    if latest_source.effective_date
                    else None
                ),
                "freshness_status": latest_source.freshness_status,
            }
            if latest_source
            else None
        ),
        "bootstrap": (
            {
                "id": latest_bootstrap.id,
                "status": latest_bootstrap.status,
                "current_step": latest_bootstrap.current_step,
                "requested_business_date": latest_bootstrap.requested_business_date.isoformat(),
                "failure_code": latest_bootstrap.failure_code,
                "failure_message": latest_bootstrap.failure_message,
                "started_at": latest_bootstrap.started_at,
                "completed_at": latest_bootstrap.completed_at,
            }
            if latest_bootstrap
            else None
        ),
        "price_policy": "SYSTEM_NOMINAL_100",
        "kap_enrichment": {
            "enabled": settings.KAP_INGESTION_ENABLED,
            "readiness_blocking": False,
            "disclosures": kap_disclosures or 0,
            "coupon_events": kap_coupon_events or 0,
            "active_terms": kap_active_terms or 0,
            "conflicts": kap_conflicts or 0,
            "backfills_pending": kap_backfills_pending or 0,
            "backfills_failed": kap_backfills_failed or 0,
            "last_poll": kap_poll_state.value_json if kap_poll_state else None,
        },
    }


@router.get("/operations/imports")
async def import_operations(
    limit: int = Query(50, ge=1, le=250),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    runs = (
        await db.execute(
            select(ImportRun, SourceFile)
            .join(SourceFile, SourceFile.id == ImportRun.source_file_id)
            .order_by(ImportRun.id.desc())
            .limit(limit)
        )
    ).all()
    bootstraps = (
        await db.execute(
            select(BootstrapRun).order_by(BootstrapRun.id.desc()).limit(10)
        )
    ).scalars()
    return {
        "imports": [
            {
                "id": run.id,
                "status": run.status,
                "parser": run.parser_name,
                "parser_version": run.parser_version,
                "row_count": run.row_count,
                "instrument_count": run.instrument_count,
                "warning_count": run.warning_count,
                "error_count": run.error_count,
                "failure_message": run.failure_message,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "source": {
                    "id": source.id,
                    "kind": source.source_kind,
                    "filename": source.filename,
                    "effective_date": (
                        source.effective_date.isoformat()
                        if source.effective_date
                        else None
                    ),
                    "requested_business_date": (
                        source.requested_business_date.isoformat()
                        if source.requested_business_date
                        else None
                    ),
                    "freshness_status": source.freshness_status,
                    "sha256": source.sha256,
                },
            }
            for run, source in runs
        ],
        "bootstraps": [
            {
                "id": run.id,
                "status": run.status,
                "current_step": run.current_step,
                "attempt": run.attempt,
                "requested_business_date": run.requested_business_date.isoformat(),
                "source_file_ids": run.source_file_ids,
                "published_effective_dates": run.published_effective_dates,
                "failure_code": run.failure_code,
                "failure_message": run.failure_message,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
            }
            for run in bootstraps
        ],
    }


@router.post("/operations/bootstrap")
async def run_bootstrap(
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    try:
        result = await VerifiedBistBootstrapService(db, settings).run(force=force)
        return result.to_dict()
    except BootstrapAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/operations/kap/poll", status_code=202)
async def queue_kap_poll(
    _admin: User = Depends(get_admin_user),
):
    from app.tasks.data_tasks import reconcile_kap_enrichment

    task = reconcile_kap_enrichment.delay()
    return {"status": "QUEUED", "task_id": task.id, "readiness_blocking": False}


@router.post("/operations/kap/disclosures/{disclosure_id}", status_code=202)
async def queue_kap_disclosure(
    disclosure_id: str,
    _admin: User = Depends(get_admin_user),
):
    if not disclosure_id.isdigit():
        raise HTTPException(status_code=422, detail="KAP disclosure id must be numeric")
    from app.tasks.data_tasks import fetch_kap_disclosure

    task = fetch_kap_disclosure.delay(disclosure_id)
    return {
        "status": "QUEUED",
        "task_id": task.id,
        "disclosure_id": disclosure_id,
        "readiness_blocking": False,
    }


@router.get("/imports/review")
async def import_review(
    severity: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    _require_read_enabled()
    query = select(ImportDiagnostic).order_by(ImportDiagnostic.id.desc()).limit(limit)
    if severity:
        query = query.where(ImportDiagnostic.severity == severity.upper())
    rows = (await db.execute(query)).scalars()
    return {
        "items": [
            {
                "id": item.id,
                "import_run_id": item.import_run_id,
                "severity": item.severity,
                "code": item.code,
                "message": item.message,
                "sheet_name": item.sheet_name,
                "row_number": item.row_number,
                "column_number": item.column_number,
                "raw_fragment": item.raw_fragment,
                "context": item.context_json,
                "resolution_status": item.resolution_status,
            }
            for item in rows
        ]
    }


@router.post("/imports/tbliste")
async def import_tbliste(
    payload: ImportTrigger,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    service = VerifiedBistImportService(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
    calendar = VerifiedBistBootstrapService(db, settings).calendar
    requested_date = calendar.resolve_expected_source_date().requested_business_date
    return await service.import_tbliste(
        payload.source_url or settings.BIST_BOND_LIST_URL,
        requested_business_date=requested_date,
    )


@router.post("/imports/benchmarks/historical")
async def import_historical_benchmarks(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    service = VerifiedBistImportService(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
    tlref = await service.import_benchmark_pair(
        "TLREF",
        rate_url=settings.BIST_TLREF_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREF_HISTORICAL_URL,
        historical=True,
    )
    tlrefk = await service.import_benchmark_pair(
        "TLREFK",
        rate_url=settings.BIST_TLREFK_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREFK_INDEX_HISTORICAL_URL,
        historical=True,
    )
    return {"TLREF": tlref, "TLREFK": tlrefk}
