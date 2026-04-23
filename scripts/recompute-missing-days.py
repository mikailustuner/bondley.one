#!/usr/bin/env python3
"""
Geçmişe dönük eksik hesaplamaları (Market Data ve Calculations) tamamlama script'i.
Belirtilen tarih aralığında veritabanını tarar ve eksik günleri doldurur.
"""

import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

# Add apps/api to path
project_root = Path(__file__).parent.parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))
elif Path("/app").exists():
    sys.path.insert(0, "/app")

from app.core.database import async_session_factory, engine
from app.services.market_data_populator import populate_market_data
from app.services.calculations_populator import populate_calculations
from app.models.calculation import Calculation
from sqlalchemy import select, func, text

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def get_missing_days(start_date: date, end_date: date):
    """Hesaplama (Calculation) kaydı olmayan günleri bulur."""
    async with async_session_factory() as session:
        stmt = select(Calculation.calc_date).where(
            Calculation.calc_date >= start_date,
            Calculation.calc_date <= end_date
        ).distinct()
        result = await session.execute(stmt)
        existing_days = {row[0] for row in result.all()}
        
        missing_days = []
        current = start_date
        while current <= end_date:
            # Sadece hafta içi günleri kontrol et (BIST takvimi)
            if current.weekday() < 5:
                if current not in existing_days:
                    missing_days.append(current)
            current += timedelta(days=1)
        
        return missing_days

async def run_backfill(start_date: date, end_date: date, force: bool = False):
    logger.info("=" * 60)
    logger.info(f"Backfill Başlatılıyor: {start_date} -> {end_date}")
    logger.info("=" * 60)

    missing_days = await get_missing_days(start_date, end_date)
    
    if force:
        # Force modunda tüm hafta içi günleri al
        missing_days = []
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:
                missing_days.append(current)
            current += timedelta(days=1)

    if not missing_days:
        logger.info("✅ Belirtilen aralıkta eksik gün bulunamadı.")
        return

    logger.info(f"🔍 Toplam {len(missing_days)} gün için işlem yapılacak.")

    for d in missing_days:
        logger.info(f"\n--- İşleniyor: {d} ---")
        async with async_session_factory() as session:
            try:
                # 1. Market Data Hazırla
                logger.info(f"[{d}] Piyasa verileri parse ediliyor...")
                await populate_market_data(d, dry_run=False)
                
                # 2. Hesaplamaları Yap
                logger.info(f"[{d}] Finansal metrikler hesaplanıyor...")
                await populate_calculations(d, dry_run=False)
                
                logger.info(f"✅ {d} başarıyla tamamlandı.")
            except Exception as e:
                logger.error(f"❌ {d} işlenirken hata oluştu: {e}")
                await session.rollback()
                # Transaction'ı temizlemek için basit bir sorgu atalım
                try:
                    await session.execute(text("SELECT 1"))
                except:
                    pass
                continue

    logger.info("\n" + "=" * 60)
    logger.info("Backfill işlemi tamamlandı.")
    logger.info("=" * 60)

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Eksik günlerin hesaplamalarını tamamlar.")
    parser.add_argument("--days", type=int, default=7, help="Son kaç gün kontrol edilsin? (Varsayılan: 7)")
    parser.add_argument("--start-date", type=str, help="Başlangıç tarihi (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="Bitiş tarihi (YYYY-MM-DD, varsayılan: bugün)")
    parser.add_argument("--force", action="store_true", help="Eksik olmasa bile tüm günleri tekrar hesapla")
    
    args = parser.parse_args()

    end_dt = date.today()
    if args.end_date:
        end_dt = date.fromisoformat(args.end_date)
        
    if args.start_date:
        start_dt = date.fromisoformat(args.start_date)
    else:
        start_dt = end_dt - timedelta(days=args.days)

    try:
        await run_backfill(start_dt, end_dt, force=args.force)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
