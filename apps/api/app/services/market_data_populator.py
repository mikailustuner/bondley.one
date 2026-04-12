"""
Market Data Doldurma Servisi
Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.
"""
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
import logging

from app.core.database import async_session_factory
from app.models.bond import Bond
from app.models.market_data import MarketData

logger = logging.getLogger(__name__)

def parse_clean_price_text(price_text: str) -> Optional[Decimal]:
    if not price_text:
        return None
    price_str = str(price_text).strip()
    if not price_str or price_str == "-" or price_str.lower() == "nan":
        return None
    placeholder_patterns = ["giriş", "input", "entry", "manuel", "manual", "yok", "none", "null", "boş", "empty"]
    if any(pattern in price_str.lower() for pattern in placeholder_patterns):
        return None
    try:
        if re.match(r'^-?\d+\.?\d*$', price_str.replace(",", ".")):
            price = Decimal(price_str.replace(",", "."))
            if 0 < price <= 1000:
                return price
    except (InvalidOperation, ValueError):
        pass
    cleaned = price_str.replace(",", ".").replace(" ", "").replace("'", "").replace('"', "").strip()
    cleaned = re.sub(r'[^\d.]', '', cleaned)
    if cleaned.count('.') > 1:
        parts = cleaned.split('.')
        cleaned = parts[0] + '.' + ''.join(parts[1:])
    if not cleaned or cleaned == "-" or cleaned == "." or cleaned == "":
        return None
    try:
        price = Decimal(cleaned)
        if price <= 0 or price > 1000:
            return None
        return price
    except (InvalidOperation, ValueError):
        return None

async def populate_market_data(trade_date: date, dry_run: bool = False, debug: bool = False):
    """
    Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.
    """
    logger.info(f"Market Data Doldurma Servisi (Date: {trade_date}) Started")
    async with async_session_factory() as session:
        result = await session.execute(select(Bond).where(Bond.is_active == True))
        bonds = result.scalars().all()
        logger.info(f"Found {len(bonds)} active bonds.")
        
        market_data_records = []
        for bond in bonds:
            clean_price = None
            if bond.clean_price_text:
                clean_price = parse_clean_price_text(bond.clean_price_text)
            if clean_price is None and bond.last_issue_price is not None:
                try:
                    clean_price = Decimal(str(bond.last_issue_price))
                    if not (0 < clean_price <= 1000):
                        clean_price = None
                except (InvalidOperation, ValueError):
                    clean_price = None
            if clean_price is None:
                continue
            
            market_data_records.append({
                "bond_id": bond.id,
                "trade_date": trade_date,
                "clean_price": clean_price,
            })
        
        logger.info(f"Parsed {len(market_data_records)} valid records.")
        if dry_run or not market_data_records:
            return
        
        total_inserted = 0
        for i in range(0, len(market_data_records), 200):
            batch = market_data_records[i: i + 200]
            stmt = pg_insert(MarketData).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["bond_id", "trade_date"],
                set_={"clean_price": stmt.excluded.clean_price},
            )
            await session.execute(stmt)
            total_inserted += len(batch)
        await session.commit()
        logger.info(f"Successfully processed {total_inserted} market data records.")
        return {"status": "success", "date": str(trade_date), "processed": total_inserted}
