"""Celery tasks for the verified BIST ingestion pipeline.

Legacy parsing, synthetic market prices and legacy calculations are
intentionally absent from this module.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.time import BistBusinessCalendar, parse_holiday_list, parse_local_time
from app.tasks.celery_app import celery_app


logger = logging.getLogger(__name__)
settings = get_settings()


def _requested_business_date():
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS),
        publication_ready_time=parse_local_time(settings.BIST_EXPECTED_READY_TIME),
    )
    return calendar.resolve_expected_source_date().requested_business_date


def _run_async(coroutine):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()
        asyncio.set_event_loop(None)


async def _service_context():
    from app.services.bist_ingestion.import_service import VerifiedBistImportService

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return engine, session_factory, VerifiedBistImportService


async def _kap_context():
    from app.services.kap_ingestion import KapEnrichmentService

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return engine, session_factory, KapEnrichmentService


@celery_app.task(
    name="app.tasks.data_tasks.fetch_verified_bist_snapshot",
    bind=True,
    max_retries=3,
)
def fetch_verified_bist_snapshot(self):
    async def _fetch():
        engine, session_factory, service_type = await _service_context()
        try:
            async with session_factory() as db:
                service = service_type(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
                return await service.import_tbliste(
                    settings.BIST_BOND_LIST_URL,
                    requested_business_date=_requested_business_date(),
                )
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception as exc:
        logger.exception("Verified tbliste import failed")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(
    name="app.tasks.data_tasks.fetch_verified_daily_benchmarks",
    bind=True,
    max_retries=3,
)
def fetch_verified_daily_benchmarks(self):
    async def _fetch():
        engine, session_factory, service_type = await _service_context()
        try:
            async with session_factory() as db:
                service = service_type(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
                tlref = await service.import_benchmark_pair(
                    "TLREF",
                    rate_url=settings.BIST_TLREF_RATE_DAILY_URL,
                    index_url=settings.BIST_TLREF_INDEX_DAILY_URL,
                    historical=False,
                    requested_business_date=_requested_business_date(),
                )
                tlrefk = await service.import_benchmark_pair(
                    "TLREFK",
                    rate_url=settings.BIST_TLREFK_RATE_URL,
                    index_url=settings.BIST_TLREFK_INDEX_URL,
                    historical=False,
                    requested_business_date=_requested_business_date(),
                )
                return {"TLREF": tlref, "TLREFK": tlrefk}
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception as exc:
        logger.exception("Verified daily benchmark import failed")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(
    name="app.tasks.data_tasks.fetch_verified_historical_benchmarks",
    bind=True,
    max_retries=3,
)
def fetch_verified_historical_benchmarks(self):
    async def _fetch():
        engine, session_factory, service_type = await _service_context()
        try:
            async with session_factory() as db:
                service = service_type(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
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
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception as exc:
        logger.exception("Verified historical benchmark import failed")
        raise self.retry(exc=exc, countdown=60 * 10)


@celery_app.task(
    name="app.tasks.data_tasks.poll_kap_enrichment",
    bind=True,
    max_retries=0,
)
def poll_kap_enrichment(self):
    async def _fetch():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                return await service_type(db, settings).poll()
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception:
        # KAP is enrichment: an outage must not create an aggressive retry
        # storm or affect the verified BIST path.
        logger.exception("KAP incremental enrichment failed")
        return {"status": "FAILED_NON_BLOCKING"}


@celery_app.task(
    name="app.tasks.data_tasks.reconcile_kap_enrichment",
    bind=True,
    max_retries=0,
)
def reconcile_kap_enrichment(self):
    async def _fetch():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                return await service_type(db, settings).poll(force=True)
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception:
        logger.exception("KAP reconciliation failed")
        return {"status": "FAILED_NON_BLOCKING"}


@celery_app.task(
    name="app.tasks.data_tasks.derive_kap_terms",
    bind=True,
    max_retries=0,
)
def derive_kap_terms(self):
    async def _derive():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                if not settings.KAP_INGESTION_ENABLED:
                    return {"status": "DISABLED"}
                return await service_type(db, settings).derive_terms()
        finally:
            await engine.dispose()

    try:
        return _run_async(_derive())
    except Exception:
        logger.exception("KAP term derivation failed")
        return {"status": "FAILED_NON_BLOCKING"}


@celery_app.task(
    name="app.tasks.data_tasks.process_kap_backfill_queue",
    bind=True,
    max_retries=0,
)
def process_kap_backfill_queue(self):
    """Process one serialized, ISIN-targeted historical KAP request."""

    async def _process():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                return await service_type(db, settings).process_backfill_queue()
        finally:
            await engine.dispose()

    try:
        return _run_async(_process())
    except Exception:
        logger.exception("KAP targeted backfill failed")
        return {"status": "FAILED_NON_BLOCKING"}


@celery_app.task(
    name="app.tasks.data_tasks.enqueue_kap_missing_spreads",
    bind=True,
    max_retries=0,
)
def enqueue_kap_missing_spreads(self):
    """Prefill active floating-rate instruments before a user opens them."""

    async def _enqueue():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                if not settings.KAP_INGESTION_ENABLED:
                    return {"status": "DISABLED"}
                return await service_type(db, settings).enqueue_missing_spreads()
        finally:
            await engine.dispose()

    try:
        result = _run_async(_enqueue())
        if result.get("queued", 0):
            process_kap_backfill_queue.delay()
        return result
    except Exception:
        logger.exception("KAP missing-spread prefill failed")
        return {"status": "FAILED_NON_BLOCKING"}


@celery_app.task(
    name="app.tasks.data_tasks.fetch_kap_disclosure",
    bind=True,
    max_retries=0,
)
def fetch_kap_disclosure(self, disclosure_id: str):
    if not str(disclosure_id).isdigit():
        return {"status": "REJECTED", "reason": "INVALID_DISCLOSURE_ID"}

    async def _fetch():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                service = service_type(db, settings)
                result = await service.fetch_disclosure(str(disclosure_id))
                if result.get("status") != "DISABLED":
                    result["derived"] = await service.derive_terms()
                return result
        finally:
            await engine.dispose()

    try:
        return _run_async(_fetch())
    except Exception:
        logger.exception("Controlled KAP disclosure fetch failed")
        return {"status": "FAILED_NON_BLOCKING", "disclosure_id": disclosure_id}


@celery_app.task(
    name="app.tasks.data_tasks.refresh_kap_proxy_pool",
    bind=True,
    max_retries=0,
)
def refresh_kap_proxy_pool(self):
    async def _refresh():
        engine, session_factory, service_type = await _kap_context()
        try:
            async with session_factory() as db:
                result = await service_type(db, settings).refresh_proxy_pool(force=True)
                await db.commit()
                return result
        finally:
            await engine.dispose()

    try:
        return _run_async(_refresh())
    except Exception:
        logger.exception("KAP public proxy pool refresh failed")
        return {"status": "FAILED_NON_BLOCKING"}
