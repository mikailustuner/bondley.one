"""
Belirli bir KAP bildirimi icin Excel detayini manuel olarak cekip DB'ye yazar.

Kullanim:
  python fetch_single_kap.py --index 1597137 --isin TRFDVYS42612
  python fetch_single_kap.py --index 1597137 --isin TRFDVYS42612 --dry-run
"""

import argparse
import json
import sys
from datetime import datetime

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.kap_disclosure import KapDisclosure, KapDisclosureDetail
from app.services.kap_fetcher import (
    HEADERS,
    build_detail_record,
    download_excel_content,
    extract_rating_from_parsed,
    parse_excel_detail,
    save_disclosure_detail,
)

settings = get_settings()
SyncSession = sessionmaker(bind=create_engine(settings.DATABASE_URL_SYNC))


def run(disclosure_index: int, isin: str, dry_run: bool) -> None:
    with httpx.Client() as client:
        # 1. Ham HTML indir
        print(f"\n[1] Excel indiriliyor: disclosure_index={disclosure_index}")
        html = download_excel_content(client, disclosure_index)
        if not html:
            print("HATA: HTML indirilemedi. Index yanlis olabilir veya KAP erisimi yok.")
            sys.exit(1)
        print(f"    {len(html)} karakter indi.")

        # 2. Parse et
        print("\n[2] Tablo ayrıştırılıyor...")
        parsed = parse_excel_detail(html)
        kv = parsed["key_values"]

        print(f"    Bulunan key-value cift sayisi : {len(kv)}")
        print(f"    Bulunan kupon satiri sayisi    : {len(parsed['coupon_payments'])}")
        print(f"    Bulunan ham tablo sayisi       : {len(parsed['tables_raw'])}")

        if not kv:
            print("\n  [UYARI] key_values bos! Tablo yapisi asagida:")
            for i, tbl in enumerate(parsed["tables_raw"]):
                print(f"\n  --- Tablo {i} ({len(tbl)} satir) ---")
                for row in tbl[:8]:
                    print(f"    {dict(row)}")
            sys.exit(1)

        print("\n  Cekilen anahtar-deger ciftleri:")
        for k, v in kv.items():
            print(f"    {k!r:50s} → {v!r}")

        # 3. DB alanlarina donustur
        print("\n[3] DB alanlarina donusturuluyor...")
        detail_data = build_detail_record(parsed)
        rating_updates = extract_rating_from_parsed(parsed)
        detail_data.update(rating_updates)

        print("  Doldurulan alanlar:")
        for field, val in detail_data.items():
            if field not in ("raw_data_json", "coupon_payments_json") and val is not None:
                print(f"    {field:<35} = {val!r}")
        empty = [f for f, v in detail_data.items() if v is None and f != "raw_data_json"]
        print(f"\n  Bos kalan alanlar ({len(empty)}): {', '.join(empty)}")

        if dry_run:
            print("\n[DRY-RUN] DB'ye yazilmadi. Yazmak icin --dry-run olmadan calistir.")
            return

        # 4. DB'ye yaz
        print("\n[4] DB'ye yaziliyor...")
        with SyncSession() as db:
            # disclosure kaydini bul (once index ile, bulamazsa isin ile)
            disclosure = db.execute(
                select(KapDisclosure).where(
                    KapDisclosure.disclosure_index == disclosure_index
                )
            ).scalar_one_or_none()

            if not disclosure:
                print(f"  disclosure_index={disclosure_index} DB'de yok, isin={isin} ile en son kayit aranıyor...")
                disclosure = db.execute(
                    select(KapDisclosure)
                    .where(KapDisclosure.isin_code == isin)
                    .order_by(KapDisclosure.publish_date.desc())
                ).scalar_one_or_none()

            if not disclosure:
                print(f"HATA: {isin} icin hic KAP bildirimi yok. Once bildirim listesi cekilmeli.")
                sys.exit(1)

            print(f"  Kullanilan disclosure: id={disclosure.id}, index={disclosure.disclosure_index}, tarih={disclosure.publish_date}")

            # Mevcut detayi guncelle veya yeni ekle
            existing = db.execute(
                select(KapDisclosureDetail).where(
                    KapDisclosureDetail.disclosure_id == disclosure.id
                )
            ).scalar_one_or_none()

            if existing:
                for key, value in detail_data.items():
                    if value is not None:
                        setattr(existing, key, value)
                existing.fetched_at = datetime.utcnow()
                action = "guncellendi"
            else:
                new_detail = KapDisclosureDetail(
                    disclosure_id=disclosure.id,
                    fetched_at=datetime.utcnow(),
                    **detail_data,
                )
                db.add(new_detail)
                action = "yeni kayit eklendi"

            db.commit()
            print(f"  ✓ kap_disclosure_details {action}.")
            print(f"\nSonuc: instrument_type={detail_data.get('instrument_type')!r}, "
                  f"maturity_date={detail_data.get('maturity_date')!r}, "
                  f"currency={detail_data.get('currency')!r}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=int, required=True, help="KAP disclosure_index (URL'deki numara)")
    parser.add_argument("--isin", type=str, required=True, help="ISIN kodu")
    parser.add_argument("--dry-run", action="store_true", help="DB'ye yazma, sadece parse sonucunu goster")
    args = parser.parse_args()
    run(args.index, args.isin, args.dry_run)
