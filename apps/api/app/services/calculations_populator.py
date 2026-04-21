"""
Hesaplamalar (calculations) doldurma servisi.
"""
from datetime import date
import logging

from app.core.database import async_session_factory
from app.services.market_data_service import MarketDataService

logger = logging.getLogger(__name__)

async def populate_calculations(calc_date: date, dry_run: bool = False, stale_limit: int = 5):
    """
    Belirtilen tarih için market_data olan tüm tahvillerde hesaplama yapar ve calculations tablosuna yazar.
    """
    logger.info(f"Hesaplamalar Servisi (Date: {calc_date}) Started")
    async with async_session_factory() as session:
        if dry_run:
            return
        service = MarketDataService(session)
        results = await service.run_daily_calculations(calc_date, stale_limit=stale_limit)
        await session.commit()
        logger.info(f"Tamamlandı: {len(results)} tahvil için hesaplama calculations tablosuna yazıldı.")
        return {"status": "success", "date": str(calc_date), "processed": len(results)}
