#!/usr/bin/env python3
"""
Market Data Doldurma Script'i
Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.
"""

import asyncio
import sys
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

# Add apps/api to path
project_root = Path(__file__).parent.parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))
elif Path("/app").exists():
    # Docker container içinde çalışıyorsa
    sys.path.insert(0, "/app")

from app.core.database import async_session_factory
from app.core.config import get_settings
from app.models.bond import Bond
from app.models.market_data import MarketData
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = None
try:
    import logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger(__name__)
except:
    pass

def log(msg):
    if logger:
        logger.info(msg)
    else:
        print(msg)


def parse_clean_price_text(price_text: str) -> Decimal | None:
    """Parse clean_price from text field (may contain formatting, commas, etc.)."""
    if not price_text:
        return None
    
    # Convert to string and strip
    price_str = str(price_text).strip()
    
    # Handle empty, dash, or placeholder text
    if not price_str or price_str == "-" or price_str.lower() == "nan":
        return None
    
    # Skip placeholder text like "Giriş/Input", "Input", etc.
    placeholder_patterns = [
        "giriş", "input", "entry", "manuel", "manual", 
        "yok", "none", "null", "boş", "empty"
    ]
    price_lower = price_str.lower()
    if any(pattern in price_lower for pattern in placeholder_patterns):
        return None
    
    # Try direct decimal conversion first (in case it's already numeric)
    try:
        # If it's already a number-like string, try direct conversion
        if re.match(r'^-?\d+\.?\d*$', price_str.replace(",", ".")):
            price = Decimal(price_str.replace(",", "."))
            if 0 <= price <= 1000:
                return price
    except (InvalidOperation, ValueError):
        pass
    
    # Remove common formatting characters
    cleaned = price_str.replace(",", ".").replace(" ", "").replace("'", "").replace('"', "").strip()
    
    # Remove currency symbols, parentheses, etc. but keep digits and dots
    cleaned = re.sub(r'[^\d.]', '', cleaned)
    
    # Remove multiple dots (keep only first one)
    if cleaned.count('.') > 1:
        parts = cleaned.split('.')
        cleaned = parts[0] + '.' + ''.join(parts[1:])
    
    if not cleaned or cleaned == "-" or cleaned == "." or cleaned == "":
        return None
    
    try:
        price = Decimal(cleaned)
        # Sanity check: clean price should be reasonable (strictly positive, max 1000)
        # BondCalculator requires clean_price > 0 (not 0 or negative)
        if price <= 0 or price > 1000:
            return None
        return price
    except (InvalidOperation, ValueError):
        return None


async def populate_market_data(trade_date: date, dry_run: bool = False, debug: bool = False):
    """
    Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.
    
    Args:
        trade_date: Market data için kullanılacak tarih
        dry_run: True ise sadece önizleme yapar, veritabanına yazmaz
        debug: True ise parse edilemeyen örnekleri gösterir
    """
    log("=" * 60)
    log("Market Data Doldurma Script'i")
    log("=" * 60)
    log(f"Tarih: {trade_date}")
    log(f"Dry Run: {dry_run}")
    log("=" * 60)
    
    async with async_session_factory() as session:
        # Aktif tahvilleri çek
        result = await session.execute(
            select(Bond).where(Bond.is_active == True)
        )
        bonds = result.scalars().all()
        
        log(f"\n📊 Toplam {len(bonds)} aktif tahvil bulundu.")
        
        # clean_price_text'i parse et ve market_data kayıtları hazırla
        market_data_records = []
        skipped_no_price = 0
        skipped_invalid_price = 0
        used_last_issue_price = 0
        debug_samples = []  # Parse edilemeyen örnekler için
        
        for bond in bonds:
            clean_price = None
            
            # Önce clean_price_text'i dene
            if bond.clean_price_text:
                clean_price = parse_clean_price_text(bond.clean_price_text)
            
            # Eğer clean_price_text parse edilemediyse, last_issue_price'ı kullan
            if clean_price is None and bond.last_issue_price is not None:
                try:
                    clean_price = Decimal(str(bond.last_issue_price))
                    # clean_price kesinlikle pozitif olmalı (> 0) - BondCalculator gereksinimi
                    if 0 < clean_price <= 1000:
                        used_last_issue_price += 1
                    else:
                        clean_price = None
                except (InvalidOperation, ValueError):
                    clean_price = None
            
            if clean_price is None:
                skipped_invalid_price += 1
                if debug and len(debug_samples) < 10:
                    debug_samples.append({
                        "isin": bond.isin_code,
                        "clean_price_text": bond.clean_price_text,
                        "last_issue_price": bond.last_issue_price,
                        "clean_price_text_type": type(bond.clean_price_text).__name__ if bond.clean_price_text else None,
                    })
                continue
            
            if not bond.clean_price_text and clean_price:
                skipped_no_price += 1
            
            market_data_records.append({
                "bond_id": bond.id,
                "trade_date": trade_date,
                "clean_price": clean_price,
            })
        
        log(f"\n✅ Parse edilen kayıt sayısı: {len(market_data_records)}")
        log(f"⏭️  clean_price_text olmayan: {skipped_no_price}")
        log(f"⏭️  Parse edilemeyen: {skipped_invalid_price}")
        if used_last_issue_price > 0:
            log(f"📌 last_issue_price kullanılan: {used_last_issue_price}")
        
        # Debug: Parse edilemeyen örnekleri göster
        if debug and debug_samples:
            log(f"\n🔍 Parse edilemeyen örnekler (ilk 10):")
            for i, sample in enumerate(debug_samples, 1):
                log(f"  {i}. ISIN: {sample['isin']}")
                log(f"     clean_price_text: '{sample['clean_price_text']}' (type: {sample.get('clean_price_text_type', 'None')})")
                log(f"     last_issue_price: {sample['last_issue_price']}")
                # Parse denemesi
                if sample['clean_price_text']:
                    parsed = parse_clean_price_text(sample['clean_price_text'])
                    log(f"     Parse sonucu: {parsed}")
        
        if dry_run:
            log("\n🔍 DRY RUN MODU - Veritabanına yazılmayacak")
            if market_data_records:
                log(f"\nİlk 5 örnek kayıt:")
                for i, rec in enumerate(market_data_records[:5], 1):
                    bond_result = await session.execute(
                        select(Bond).where(Bond.id == rec["bond_id"])
                    )
                    bond = bond_result.scalar_one()
                    log(f"  {i}. {bond.isin_code}: {rec['clean_price']}")
            return
        
        # Market data'yı veritabanına yaz
        if not market_data_records:
            log("\n❌ Yazılacak kayıt yok!")
            return
        
        log(f"\n💾 {len(market_data_records)} kayıt veritabanına yazılıyor...")
        
        # Batch insert (200'lük gruplar halinde)
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
            log(f"  ✓ {total_inserted}/{len(market_data_records)} kayıt işlendi...")
        
        await session.commit()
        log(f"\n✅ Başarıyla {total_inserted} market data kaydı eklendi/güncellendi!")
        
        # Kontrol: Kaç kayıt eklendi?
        count_result = await session.execute(
            select(MarketData).where(MarketData.trade_date == trade_date)
        )
        actual_count = len(count_result.scalars().all())
        log(f"📊 Veritabanında {trade_date} tarihi için toplam {actual_count} kayıt mevcut.")


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Bonds tablosundaki clean_price_text değerlerini market_data tablosuna yazar."
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Market data tarihi (YYYY-MM-DD formatında, varsayılan: bugün)",
        default=None,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Sadece önizleme yap, veritabanına yazma",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Parse edilemeyen örnekleri göster",
    )
    
    args = parser.parse_args()
    
    # Tarih parse et
    if args.date:
        try:
            trade_date = date.fromisoformat(args.date)
        except ValueError:
            print(f"❌ Hata: Geçersiz tarih formatı: {args.date}")
            print("   Doğru format: YYYY-MM-DD (örn: 2026-02-19)")
            sys.exit(1)
    else:
        trade_date = date.today()
        log(f"⚠️  Tarih belirtilmedi, bugünün tarihi kullanılıyor: {trade_date}")
    
    try:
        await populate_market_data(trade_date, dry_run=args.dry_run, debug=args.debug)
    except Exception as e:
        log(f"\n❌ Hata: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
