#!/usr/bin/env python3
"""
Borsa Istanbul'dan TLREF tarihsel oran verilerini (TLREFORANI_D.zip) manuel olarak ceker ve veritabanini gunceller.
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
    print(f"[TLREF_SYNC] {msg}")


async def sync_historical_rates() -> dict:
    log("=" * 60)
    log("TLREFORANI_D.zip Tarihsel Oran Verisi Senkronizasyonu Basliyor")
    log("=" * 60)

    async with async_session_factory() as session:
        fetcher = TLREFFetcher(session)
        log("BIST sunucularina baglaniliyor...")
        res = await fetcher.fetch_historical_rate()
        
        if res.get("status") == "success":
            log(f"✅ Basarili! Toplam {res.get('rate_records')} kayit guncellendi.")
        else:
            log(f"❌ Hata: {res.get('error')}")
            
        await session.commit()
        return res


async def main() -> None:
    try:
        await sync_historical_rates()
    except Exception as e:
        log(f"❌ Kritik Hata: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
