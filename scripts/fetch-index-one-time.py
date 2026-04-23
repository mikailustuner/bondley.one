#!/usr/bin/env python3
"""
BIST TLREF Endeks Tarihsel Veri Çekme (Tek Seferlik)
Kaynak: https://www.borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip
"""

import asyncio
import sys
import io
import zipfile
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import httpx

# API dizinini yola ekle
project_root = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root / "apps" / "api"))

from app.core.database import async_session_factory, engine
from app.models.tlref_rate import TLREFRate
from sqlalchemy.dialects.postgresql import insert as pg_insert

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

URL = "https://www.borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip"

async def fetch_and_save_index():
    logger.info(f"Downloading from {URL}...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(URL)
        response.raise_for_status()
    
    logger.info("Extracting ZIP...")
    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        csv_name = zf.namelist()[0]
        with zf.open(csv_name) as f:
            content = f.read().decode("utf-16")
    
    lines = content.strip().splitlines()
    records = []
    logger.info(f"Parsing {len(lines)} lines...")
    
    for line in lines[1:]: # Header atla
        parts = line.split(";")
        if len(parts) < 7: continue
        
        try:
            # Format: DD.MM.YYYY
            dt = datetime.strptime(parts[0].strip(), "%d.%m.%Y").date()
            # Index value column 6
            val = Decimal(parts[6].strip().replace(",", "."))
            
            records.append({
                "rate_date": dt,
                "index_value": val,
                "source": "BIST_ONETIME"
            })
        except Exception:
            continue

    logger.info(f"Upserting {len(records)} records to DB...")
    async with async_session_factory() as session:
        for i in range(0, len(records), 500):
            batch = records[i:i+500]
            stmt = pg_insert(TLREFRate).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["rate_date"],
                set_={"index_value": stmt.excluded.index_value}
            )
            await session.execute(stmt)
        await session.commit()
    
    logger.info("✅ Tarihsel endeks verileri başarıyla yüklendi.")

if __name__ == "__main__":
    asyncio.run(fetch_and_save_index())
