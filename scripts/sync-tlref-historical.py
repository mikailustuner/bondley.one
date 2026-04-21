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


async def sync_historical_data() -> dict:
    log("=" * 60)
    log("TLREF TAM GECMIS SENKRONIZASYONU (Endeks + Oranlar)")
    log("=" * 60)

    async with async_session_factory() as session:
        fetcher = TLREFFetcher(session)
        
        log("1. Endeks gecmisi cekiliyor (BISTTLREFENDEKSI_D.zip)...")
        idx_res = await fetcher.fetch_historical()
        if idx_res.get("status") == "success":
            log(f"✅ Endeksler tamam: {idx_res.get('index_records')} kayit.")
        else:
            log(f"⚠️ Endeks hatasi: {idx_res.get('error')}")

        log("2. Faiz orani gecmisi cekiliyor (TLREFORANI_D.zip)...")
        rate_res = await fetcher.fetch_historical_rate()
        if rate_res.get("status") == "success":
            log(f"✅ Oranlar tamam: {rate_res.get('rate_records')} kayit guncellendi.")
        else:
            log(f"⚠️ Oran hatasi: {rate_res.get('error')}")
            
        await session.commit()
        return {"index": idx_res, "rate": rate_res}


async def main() -> None:
    try:
        await sync_historical_data()
    except Exception as e:
        log(f"❌ Kritik Hata: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
