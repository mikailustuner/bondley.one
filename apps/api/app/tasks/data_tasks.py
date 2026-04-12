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


@celery_app.task(name="app.tasks.data_tasks.populate_daily_market_data", bind=True, max_retries=3)
def populate_daily_market_data(self):
    """Bonds tablosundaki clean_price_text degerlerini parse edip bugunun market_data'sini olustur."""
    logger.info("Task: Populating daily market data...")
    from datetime import date
    import sys
    from pathlib import Path

    # Scripts klasorundeki logic'i kullanmak icin path'e ekle
    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    
    try:
        from scripts.populate_market_data import populate_market_data
    except ImportError:
        # Try with hyphenated name
        import importlib.util
        script_path = project_root / "scripts" / "populate-market-data.py"
        spec = importlib.util.spec_from_file_location("populate_market_data", str(script_path))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        populate_market_data = module.populate_market_data

    try:
        _run_async(populate_market_data(date.today(), dry_run=False, debug=False))
        logger.info("Daily market data populated successfully")
        return {"status": "success", "date": str(date.today())}
    except Exception as exc:
        logger.error(f"Daily market data population failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.tasks.data_tasks.run_daily_calculations", bind=True, max_retries=3)
def run_daily_calculations(self):
    """Bugunun market_data'si olan tahviller icin hesaplamalari yap ve DB'ye yaz."""
    logger.info("Task: Running daily calculations...")
    from datetime import date
    import sys
    from pathlib import Path

    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    
    try:
        from scripts.populate_calculations import populate_calculations
    except ImportError:
        # Try with hyphenated name
        import importlib.util
        script_path = project_root / "scripts" / "populate-calculations.py"
        spec = importlib.util.spec_from_file_location("populate_calculations", str(script_path))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        populate_calculations = module.populate_calculations

    try:
        _run_async(populate_calculations(date.today(), dry_run=False))
        logger.info("Daily calculations completed successfully")
        return {"status": "success", "date": str(date.today())}
    except Exception as exc:
        logger.error(f"Daily calculations failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)
