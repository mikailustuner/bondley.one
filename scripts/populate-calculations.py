#!/usr/bin/env python3
"""
Hesaplamalar (calculations) tablosunu manuel doldurma script'i.
Belirtilen tarih için market_data olan tüm tahvillerde YTM, dirty price, duration vb. hesaplar ve calculations tablosuna yazar.
"""

import asyncio
import sys
from datetime import date
from pathlib import Path

# Add apps/api to path
project_root = Path(__file__).parent.parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))
elif Path("/app").exists():
    sys.path.insert(0, "/app")

from app.core.database import async_session_factory
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.services.market_data_service import MarketDataService
from sqlalchemy import select

logger = None
try:
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    logger = logging.getLogger(__name__)
except Exception:
    pass


def log(msg):
    if logger:
        logger.info(msg)
    else:
        print(msg)


async def populate_calculations(calc_date: date, dry_run: bool = False, stale_limit: int = 5):
    """
    Belirtilen tarih için market_data olan tüm tahvillerde hesaplama yapar ve calculations tablosuna yazar.
    """
    log("=" * 60)
    log("Hesaplamalar (calculations) Doldurma Script'i")
    log("=" * 60)
    log(f"Tarih: {calc_date}")
    log(f"Dry Run: {dry_run}")
    log("=" * 60)

    async with async_session_factory() as session:
        if dry_run:
            # Kaç tahvilin market_data'sı var say
            md_count_result = await session.execute(
                select(MarketData.bond_id)
                .where(MarketData.trade_date == calc_date)
                .distinct()
            )
            bond_ids_with_md = {row[0] for row in md_count_result.all()}
            bonds_result = await session.execute(
                select(Bond).where(
                    Bond.is_active == True,
                    Bond.maturity_date > calc_date,
                    Bond.id.in_(bond_ids_with_md),
                )
            )
            bonds_to_calc = bonds_result.scalars().all()
            log(f"\n📊 {calc_date} tarihi için market_data olan tahvil sayısı: {len(bond_ids_with_md)}")
            log(f"📊 Hesaplanacak tahvil sayısı (aktif + vade sonrası): {len(bonds_to_calc)}")
            log("\n🔍 DRY RUN MODU - Veritabanına yazılmayacak")
            return

        service = MarketDataService(session)
        results = await service.run_daily_calculations(calc_date, stale_limit=stale_limit)
        await session.commit()

        log(f"\n✅ {len(results)} tahvil için hesaplama tamamlandı ve calculations tablosuna yazıldı.")
        log(f"📅 Tarih: {calc_date}")


async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Belirtilen tarih için market_data olan tahvillerde hesaplama yapar, calculations tablosuna yazar."
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Hesaplama tarihi (YYYY-MM-DD, varsayılan: bugün)",
        default=None,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Sadece önizleme, veritabanına yazma",
    )
    parser.add_argument(
        "--stale-limit",
        type=int,
        default=5,
        help="Geçmiş getiri oranının kullanılacağı gün limiti (varsayılan: 5)",
    )
    args = parser.parse_args()

    if args.date:
        try:
            calc_date = date.fromisoformat(args.date)
        except ValueError:
            print(f"❌ Geçersiz tarih: {args.date}. Format: YYYY-MM-DD")
            sys.exit(1)
    else:
        calc_date = date.today()
        log(f"⚠️ Tarih belirtilmedi, bugün kullanılıyor: {calc_date}")

    try:
        await populate_calculations(calc_date, dry_run=args.dry_run, stale_limit=args.stale_limit)
    except Exception as e:
        log(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
