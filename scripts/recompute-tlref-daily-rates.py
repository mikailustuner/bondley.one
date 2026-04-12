#!/usr/bin/env python3
"""
TLREF günlük oranlarını (daily_rate) mevcut endeks verisi üzerinden yeniden hesaplar.
tlref_rates tablosunda index_value dolu olan tüm kayıtlar için:
  daily_rate = (bugünkü endeks - dünkü endeks) / dünkü endeks
formülü uygulanır ve sonuç ilgili satıra yazılır.
Veri çekmeden sadece mevcut kayıtları günceller.
"""

import asyncio
import sys
from pathlib import Path

# Add apps/api to path
project_root = Path(__file__).parent.parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))
elif Path("/app").exists():
    sys.path.insert(0, "/app")

from app.core.database import async_session_factory
from app.services.tlref_fetcher import TLREFFetcher


def log(msg: str) -> None:
    print(msg)


async def recompute_daily_rates(dry_run: bool = False) -> int:
    """
    Mevcut tlref_rates kayıtları üzerinde günlük oranları hesapla.
    dry_run=True ise sadece kaç kayıt güncelleneceğini gösterir, yazmaz.
    """
    log("=" * 60)
    log("TLREF Günlük Oranları (daily_rate) Yeniden Hesaplama")
    log("=" * 60)
    log(f"Dry Run: {dry_run}")
    log("=" * 60)

    async with async_session_factory() as session:
        fetcher = TLREFFetcher(session)
        if dry_run:
            from sqlalchemy import select, func
            from app.models.tlref_rate import TLREFRate
            result = await session.execute(
                select(func.count(TLREFRate.id)).where(TLREFRate.index_value.isnot(None))
            )
            total = result.scalar() or 0
            log(f"Mevcut endeks kayıt sayısı: {total}")
            if total < 2:
                log("En az 2 kayıt gerekir; güncellenecek kayıt yok.")
                return 0
            log(f"Tahmini güncellenecek daily_rate sayısı: {total - 1}")
            log("\nDry run - veritabanına yazılmadı. Yazmak için --dry-run kullanmayın.")
            return 0
        rate_count = await fetcher._compute_daily_rates()
        await session.commit()
        log(f"\n✅ {rate_count} kayıt için günlük oran hesaplandı ve tlref_rates tablosuna yazıldı.")
        return rate_count


async def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(
        description="Mevcut TLREF endeks verisinden günlük oranları (daily_rate) yeniden hesaplar."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Sadece önizleme, veritabanına yazma",
    )
    args = parser.parse_args()

    try:
        await recompute_daily_rates(dry_run=args.dry_run)
    except Exception as e:
        log(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
