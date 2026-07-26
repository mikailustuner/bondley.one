from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import Settings
from app.core.time import (
    BistBusinessCalendar,
    TURKEY_TIMEZONE_NAME,
    parse_holiday_list,
    parse_local_time,
    utc_now,
)
from app.models.bist_ingestion import (
    BenchmarkObservation,
    BootstrapRun,
    InstrumentVersion,
)
from app.services.bist_ingestion.benchmark_parser import BenchmarkParser
from app.services.bist_ingestion.import_service import VerifiedBistImportService
from app.services.bist_ingestion.tbliste_parser import TblisteParser


logger = logging.getLogger(__name__)
BOOTSTRAP_LOCK_KEY = 8_650_171_009


class BootstrapAlreadyRunning(RuntimeError):
    pass


@dataclass(frozen=True)
class BootstrapResult:
    run_id: int | None
    status: str
    requested_business_date: str
    skipped: bool
    steps: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "status": self.status,
            "requested_business_date": self.requested_business_date,
            "skipped": self.skipped,
            "steps": self.steps,
        }


class VerifiedBistBootstrapService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.calendar = BistBusinessCalendar(
            extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS),
            publication_ready_time=parse_local_time(
                settings.BIST_EXPECTED_READY_TIME
            ),
        )
        self.importer = VerifiedBistImportService(
            db,
            archive_root=settings.BIST_RAW_ARCHIVE_DIR,
        )

    async def run(
        self,
        *,
        force: bool = False,
        now: datetime | None = None,
    ) -> BootstrapResult:
        resolution = self.calendar.resolve_expected_source_date(now)
        requested_date = resolution.requested_business_date
        lock_engine = create_async_engine(self.settings.DATABASE_URL)
        lock_connection = await lock_engine.connect()
        locked = await lock_connection.scalar(
            text("SELECT pg_try_advisory_lock(:key)").bindparams(
                key=BOOTSTRAP_LOCK_KEY
            )
        )
        if not locked:
            await lock_connection.close()
            await lock_engine.dispose()
            raise BootstrapAlreadyRunning("Another BIST bootstrap is active")

        try:
            if (
                not force
                and self.settings.BIST_BOOTSTRAP_IF_EMPTY
                and await self._has_usable_data()
            ):
                return BootstrapResult(
                    run_id=None,
                    status="READY",
                    requested_business_date=requested_date.isoformat(),
                    skipped=True,
                    steps={"reason": "VERIFIED_DATA_ALREADY_PRESENT"},
                )

            run = BootstrapRun(
                status="PENDING",
                current_step="INITIALIZING",
                attempt=1,
                requested_business_date=requested_date,
                timezone_name=TURKEY_TIMEZONE_NAME,
                app_version="verified-v2",
                parser_versions={
                    "tbliste": TblisteParser.VERSION,
                    "benchmark": BenchmarkParser.VERSION,
                },
            )
            self.db.add(run)
            await self.db.commit()
            await self.db.refresh(run)

            steps: dict[str, Any] = {}
            try:
                steps["tlref_historical"] = await self._run_step(
                    run,
                    "TLREF_HISTORICAL",
                    self.importer.import_benchmark_pair(
                        "TLREF",
                        rate_url=self.settings.BIST_TLREF_RATE_HISTORICAL_URL,
                        index_url=self.settings.BIST_TLREF_HISTORICAL_URL,
                        historical=True,
                        requested_business_date=requested_date,
                    ),
                )
                steps["tlrefk_historical"] = await self._run_step(
                    run,
                    "TLREFK_HISTORICAL",
                    self.importer.import_benchmark_pair(
                        "TLREFK",
                        rate_url=self.settings.BIST_TLREFK_RATE_HISTORICAL_URL,
                        index_url=self.settings.BIST_TLREFK_INDEX_HISTORICAL_URL,
                        historical=True,
                        requested_business_date=requested_date,
                    ),
                )
                steps["tlref_daily"] = await self._run_step(
                    run,
                    "TLREF_DAILY",
                    self.importer.import_benchmark_pair(
                        "TLREF",
                        rate_url=self.settings.BIST_TLREF_RATE_DAILY_URL,
                        index_url=self.settings.BIST_TLREF_INDEX_DAILY_URL,
                        historical=False,
                        requested_business_date=requested_date,
                    ),
                )
                steps["tlrefk_daily"] = await self._run_step(
                    run,
                    "TLREFK_DAILY",
                    self.importer.import_benchmark_pair(
                        "TLREFK",
                        rate_url=self.settings.BIST_TLREFK_RATE_URL,
                        index_url=self.settings.BIST_TLREFK_INDEX_URL,
                        historical=False,
                        requested_business_date=requested_date,
                    ),
                )
                steps["tbliste"] = await self._run_step(
                    run,
                    "TBLISTE",
                    self.importer.import_tbliste(
                        self.settings.BIST_BOND_LIST_URL,
                        requested_business_date=requested_date,
                    ),
                )

                freshnesses = {
                    str(step.get("freshness_status"))
                    for step in steps.values()
                    if isinstance(step, dict) and step.get("freshness_status")
                }
                status = "DEGRADED" if "STALE" in freshnesses else "READY"
                run.status = status
                run.current_step = "COMPLETE"
                run.source_file_ids = self._source_ids(steps)
                run.published_effective_dates = {
                    key: value["effective_date"]
                    for key, value in steps.items()
                    if isinstance(value, dict) and value.get("effective_date")
                }
                run.completed_at = utc_now()
                await self.db.commit()
                return BootstrapResult(
                    run_id=run.id,
                    status=status,
                    requested_business_date=requested_date.isoformat(),
                    skipped=False,
                    steps=steps,
                )
            except Exception as exc:
                await self.db.rollback()
                failed = await self.db.get(BootstrapRun, run.id)
                if failed is not None:
                    failed.status = "FAILED"
                    failed.failure_code = type(exc).__name__
                    failed.failure_message = str(exc)[:4000]
                    failed.error_count += 1
                    failed.completed_at = utc_now()
                    await self.db.commit()
                raise
        finally:
            await lock_connection.execute(
                text("SELECT pg_advisory_unlock(:key)").bindparams(
                    key=BOOTSTRAP_LOCK_KEY
                )
            )
            await lock_connection.close()
            await lock_engine.dispose()

    async def _run_step(
        self,
        run: BootstrapRun,
        step: str,
        operation: Any,
    ) -> dict[str, Any]:
        run.status = "DOWNLOADING"
        run.current_step = step
        await self.db.commit()
        result = await operation
        run.status = "VALIDATING"
        await self.db.commit()
        return result

    async def _has_usable_data(self) -> bool:
        instrument_count = await self.db.scalar(
            select(func.count(InstrumentVersion.id)).where(
                InstrumentVersion.is_published.is_(True)
            )
        )
        tlref_count = await self.db.scalar(
            select(func.count(BenchmarkObservation.id)).where(
                BenchmarkObservation.benchmark == "TLREF"
            )
        )
        tlrefk_count = await self.db.scalar(
            select(func.count(BenchmarkObservation.id)).where(
                BenchmarkObservation.benchmark == "TLREFK"
            )
        )
        successful_run_id = await self.db.scalar(
            select(BootstrapRun.id)
            .where(BootstrapRun.status.in_(["READY", "DEGRADED"]))
            .order_by(BootstrapRun.id.desc())
            .limit(1)
        )
        return bool(
            instrument_count
            and tlref_count
            and tlrefk_count
            and successful_run_id
        )

    @staticmethod
    def _source_ids(steps: dict[str, Any]) -> list[int]:
        source_ids: set[int] = set()
        for payload in steps.values():
            if not isinstance(payload, dict):
                continue
            for key in (
                "source_file_id",
                "rate_source_file_id",
                "index_source_file_id",
            ):
                value = payload.get(key)
                if isinstance(value, int):
                    source_ids.add(value)
        return sorted(source_ids)


async def readiness_payload(
    db: AsyncSession,
    *,
    require_bootstrap: bool,
) -> tuple[bool, dict[str, Any]]:
    published_instruments = (
        await db.scalar(
            select(func.count(InstrumentVersion.id)).where(
                InstrumentVersion.is_published.is_(True)
            )
        )
        or 0
    )
    tlref_observations = (
        await db.scalar(
            select(func.count(BenchmarkObservation.id)).where(
                BenchmarkObservation.benchmark == "TLREF"
            )
        )
        or 0
    )
    tlrefk_observations = (
        await db.scalar(
            select(func.count(BenchmarkObservation.id)).where(
                BenchmarkObservation.benchmark == "TLREFK"
            )
        )
        or 0
    )
    benchmark_observations = tlref_observations + tlrefk_observations
    latest_run = (
        await db.execute(
            select(BootstrapRun).order_by(BootstrapRun.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    bootstrap_status = latest_run.status if latest_run else "NOT_RUN"
    data_ready = (
        published_instruments > 0
        and tlref_observations > 0
        and tlrefk_observations > 0
    )
    ready = data_ready and bootstrap_status in {"READY", "DEGRADED"}
    if not require_bootstrap:
        ready = True
    return ready, {
        "status": "ready" if ready else "not_ready",
        "bootstrap_status": bootstrap_status,
        "published_instruments": published_instruments,
        "benchmark_observations": benchmark_observations,
        "tlref_observations": tlref_observations,
        "tlrefk_observations": tlrefk_observations,
        "requested_business_date": (
            latest_run.requested_business_date.isoformat() if latest_run else None
        ),
        "completed_at": (
            latest_run.completed_at.isoformat()
            if latest_run and latest_run.completed_at
            else None
        ),
    }
