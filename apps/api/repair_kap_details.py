"""
KAP disclosure_details tablosunda instrument_type IS NULL olan kayitlari
raw_data_json uzerinden yeniden ayristirarak onarir.

Kullanim:
  python repair_kap_details.py           # dry-run: sadece rapor, DB dokunulmaz
  python repair_kap_details.py --apply   # gercek guncelleme + commit
"""

import asyncio
import sys
from collections import defaultdict

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.kap_disclosure import KapDisclosureDetail
from app.services.kap_fetcher import build_detail_record

# build_detail_record ciktisindaki su alanlar guncellenir;
# raw_data_json, fetched_at, disclosure_id, id dokunulmaz.
UPDATABLE_FIELDS = [
    "isin_code", "instrument_type", "fund_user", "source_institution",
    "maturity_date", "maturity_days", "nominal_value", "issue_price",
    "interest_rate_type", "floating_rate_reference", "additional_return_pct",
    "coupon_number", "coupon_frequency", "currency", "payment_type",
    "sale_type", "starting_date_sale", "ending_date_sale", "maturity_starting_date",
    "traded_in_exchange", "intermediary_brokerage", "issue_limit",
    "issue_limit_security_type", "issue_limit_currency",
    "issuer_has_rating", "instrument_has_rating", "originator_has_rating",
    "additional_explanation", "board_decision_date", "subject_of_notification",
    "coupon_payments_json",
]


async def repair(apply: bool) -> None:
    async with async_session_factory() as db:
        result = await db.execute(
            select(KapDisclosureDetail).where(
                KapDisclosureDetail.instrument_type.is_(None),
                KapDisclosureDetail.raw_data_json.is_not(None),
            )
        )
        records = result.scalars().all()

        total = len(records)
        updated_count = 0
        field_counts: dict[str, int] = defaultdict(int)

        for detail in records:
            try:
                reparsed = build_detail_record(detail.raw_data_json)
            except Exception as e:
                print(f"  HATA  id={detail.id}: {e}")
                continue

            changed = False
            for field in UPDATABLE_FIELDS:
                new_val = reparsed.get(field)
                if new_val is not None and getattr(detail, field, None) is None:
                    if apply:
                        setattr(detail, field, new_val)
                    field_counts[field] += 1
                    changed = True

            if changed:
                updated_count += 1

        print(f"\nToplam taranan : {total} kayit")
        print(f"Guncellenecek  : {updated_count} kayit")
        print(f"Degismeyen     : {total - updated_count} kayit (zaten doluydu)\n")

        if updated_count:
            print("Alan bazli guncelleme sayilari:")
            for field, count in sorted(field_counts.items(), key=lambda x: -x[1]):
                print(f"  {field:<35} {count}")

        if apply:
            await db.commit()
            print(f"\n✓ {updated_count} kayit guncellendi ve commit edildi.")
        else:
            await db.rollback()
            print("\n[DRY-RUN] Hicbir degisiklik kaydedilmedi. Uygulamak icin --apply ekleyin.")


if __name__ == "__main__":
    apply_mode = "--apply" in sys.argv
    if apply_mode:
        print("MOD: UYGULA (--apply)")
    else:
        print("MOD: DRY-RUN (degisiklik yok)")
    asyncio.run(repair(apply=apply_mode))
