"""Celery tasks for the verified BIST ingestion pipeline.

KAP, legacy bond parsing, synthetic market prices and legacy calculations are
intentionally absent from this module.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.tasks.celery_app import celery_app


logger = logging.getLogger(__name__)
settings = get_settings()


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
                return await service.import_tbliste(settings.BIST_BOND_LIST_URL)
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
                )
                tlrefk = await service.import_benchmark_pair(
                    "TLREFK",
                    rate_url=settings.BIST_TLREFK_RATE_URL,
                    index_url=settings.BIST_TLREFK_INDEX_URL,
                    historical=False,
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
