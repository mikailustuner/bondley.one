"""
Celery tasks for automated TLREF and bond data fetching.

Daily schedule (weekdays):
- 18:30 Istanbul time: Fetch TLREF index from BIST
- 19:00 Istanbul time: Fetch bond list from BIST
"""

import asyncio
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.tasks.celery_app import celery_app
from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
sync_engine = create_engine(settings.DATABASE_URL_SYNC)
SyncSession = sessionmaker(bind=sync_engine)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.data_tasks.fetch_daily_tlref", bind=True, max_retries=3)
def fetch_daily_tlref(self):
    """Gunluk TLREF endeks degerini BIST'ten cek ve DB'ye yaz."""
    logger.info("Task: Fetching daily TLREF index...")

    async def _fetch():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.tlref_fetcher import TLREFFetcher

        eng = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            fetcher = TLREFFetcher(db)
            return await fetcher.fetch_daily()

    try:
        result = _run_async(_fetch())
        logger.info(f"Daily TLREF fetch result: {result}")
        return result
    except Exception as exc:
        logger.error(f"Daily TLREF fetch failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.tasks.data_tasks.fetch_historical_tlref")
def fetch_historical_tlref():
    """Tarihsel TLREF endeks verilerini BIST'ten cek."""
    logger.info("Task: Fetching historical TLREF index data...")

    async def _fetch():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.tlref_fetcher import TLREFFetcher

        eng = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            fetcher = TLREFFetcher(db)
            return await fetcher.fetch_historical()

    result = _run_async(_fetch())
    logger.info(f"Historical TLREF fetch result: {result}")
    return result


@celery_app.task(name="app.tasks.data_tasks.fetch_bond_list", bind=True, max_retries=3)
def fetch_bond_list(self):
    """BIST tbliste.zip tahvil listesini indir, parse et, DB'ye yaz."""
    logger.info("Task: Fetching bond list from BIST...")

    async def _fetch():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.bond_fetcher import BondFetcher

        eng = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            fetcher = BondFetcher(db)
            return await fetcher.fetch_and_sync()

    try:
        result = _run_async(_fetch())
        logger.info(f"Bond list fetch result: {result}")
        return result
    except Exception as exc:
        logger.error(f"Bond list fetch failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)
