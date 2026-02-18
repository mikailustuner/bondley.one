"""
Celery tasks for automated data fetching and calculations.

Daily schedule (weekdays):
- 18:30 Istanbul time: Fetch TLREF from BIST
- 18:45 Istanbul time: Run calculations for all active bonds
"""

import asyncio
import logging
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.tasks.celery_app import celery_app
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# #region agent log
try:
    import json
    log_path = "/app/debug-f7faef.log"
    with open(log_path, "a") as f:
        f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "data_tasks.py:20", "message": "data_tasks module importing, loading settings", "data": {}, "timestamp": __import__("time").time() * 1000}) + "\n")
except: pass
# #endregion

try:
    settings = get_settings()
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "data_tasks.py:28", "message": "Settings loaded, creating sync_engine", "data": {"db_url": settings.DATABASE_URL_SYNC[:30] + "..." if len(settings.DATABASE_URL_SYNC) > 30 else settings.DATABASE_URL_SYNC}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "C", "location": "data_tasks.py:31", "message": "Settings loading failed in data_tasks", "data": {"error": str(e), "error_type": type(e).__name__}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    log_path = "/app/debug-f7faef.log"
    with open(log_path, "a") as f:
        f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "data_tasks.py:35", "message": "About to create sync_engine", "data": {}, "timestamp": __import__("time").time() * 1000}) + "\n")
except: pass
# #endregion

try:
    sync_engine = create_engine(settings.DATABASE_URL_SYNC)
    SyncSession = sessionmaker(bind=sync_engine)
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "data_tasks.py:42", "message": "sync_engine created successfully", "data": {}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "data_tasks.py:45", "message": "sync_engine creation failed", "data": {"error": str(e), "error_type": type(e).__name__}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
    raise


def _run_async(coro):
    """Helper to run async code from sync Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.data_tasks.fetch_daily_tlref", bind=True, max_retries=3)
def fetch_daily_tlref(self):
    """Gunluk TLREF oranini BIST'ten cek ve DB'ye yaz."""
    logger.info("Task: Fetching daily TLREF rate...")

    async def _fetch():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.tlref_fetcher import TLREFFetcher

        engine = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            fetcher = TLREFFetcher(db)
            result = await fetcher.fetch_daily()
            return result

    try:
        result = _run_async(_fetch())
        logger.info(f"Daily TLREF fetch result: {result}")
        return result
    except Exception as exc:
        logger.error(f"Daily TLREF fetch failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.tasks.data_tasks.run_daily_calculations", bind=True, max_retries=2)
def run_daily_calculations(self):
    """Tum aktif tahviller icin gunluk hesaplamalari calistir."""
    logger.info("Task: Running daily calculations...")

    async def _calculate():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.market_data_service import MarketDataService

        engine = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            service = MarketDataService(db)
            results = await service.run_daily_calculations(date.today())
            return {"calculated": len(results), "date": str(date.today())}

    try:
        result = _run_async(_calculate())
        logger.info(f"Daily calculations result: {result}")
        return result
    except Exception as exc:
        logger.error(f"Daily calculations failed: {exc}")
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.tasks.data_tasks.fetch_historical_tlref")
def fetch_historical_tlref():
    """Tarihsel TLREF verilerini BIST'ten cek (ilk kurulumda bir kez calistirilir)."""
    logger.info("Task: Fetching historical TLREF data...")

    async def _fetch():
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.services.tlref_fetcher import TLREFFetcher

        engine = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as db:
            fetcher = TLREFFetcher(db)
            result = await fetcher.fetch_historical()
            return result

    result = _run_async(_fetch())
    logger.info(f"Historical TLREF fetch result: {result}")
    return result
