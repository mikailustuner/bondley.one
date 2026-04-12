#!/usr/bin/env python3
"""
Veritabanındaki last_issue_date_text alanında Excel seri numarası (örn. 45712)
olarak kalan eski kayıtları DD.MM.YYYY formatına çevirir.

Kullanım (proje kökünden):
  python scripts/fix-last-issue-dates.py
  # veya
  cd apps/api && python ../../scripts/fix-last-issue-dates.py
"""

import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

# Proje kökü (scripts'in bir üstü) ve apps/api'i path'e ekle
script_dir = Path(__file__).resolve().parent
repo_root = script_dir.parent
api_dir = repo_root / "apps" / "api"
if api_dir.exists():
    sys.path.insert(0, str(api_dir))
elif Path("/app").exists():
    sys.path.insert(0, "/app")
else:
    print("HATA: apps/api bulunamadı. Proje kökünden veya apps/api içinden çalıştırın.")
    sys.exit(1)

from sqlalchemy import select, update
from app.core.database import async_session_factory
from app.models.bond import Bond

# Excel seri: 1 = 1900-01-01 (Windows). 31 Aralık 1899 + N gün
EXCEL_EPOCH = date(1899, 12, 31)


def excel_serial_to_date(serial: int) -> date | None:
    if not (30000 <= serial <= 50000):
        return None
    try:
        return EXCEL_EPOCH + timedelta(days=serial)
    except (OverflowError, ValueError):
        return None


def format_date_turkish(d: date) -> str:
    return d.strftime("%d.%m.%Y")


async def main():
    async with async_session_factory() as session:
        result = await session.execute(
            select(Bond.id, Bond.isin_code, Bond.last_issue_date_text).where(
                Bond.last_issue_date_text.isnot(None),
                Bond.last_issue_date_text != "",
            )
        )
        rows = result.all()

    to_update = []
    for id_, isin, text in rows:
        if not text or not text.strip():
            continue
        stripped = text.strip()
        if not stripped.isdigit():
            continue
        serial = int(stripped)
        d = excel_serial_to_date(serial)
        if d is None:
            continue
        new_value = format_date_turkish(d)
        if new_value == stripped:
            continue
        to_update.append({"id": id_, "isin_code": isin, "old": stripped, "new": new_value})

    if not to_update:
        print("Güncellenecek Excel seri tarihi bulunamadı (last_issue_date_text zaten düzgün veya boş).")
        return

    print(f"Toplam {len(to_update)} kayıt güncellenecek (Excel seri -> DD.MM.YYYY):")
    for u in to_update[:10]:
        print(f"  {u['isin_code']}: {u['old']} -> {u['new']}")
    if len(to_update) > 10:
        print(f"  ... ve {len(to_update) - 10} kayıt daha.")

    async with async_session_factory() as session:
        for u in to_update:
            await session.execute(
                update(Bond).where(Bond.id == u["id"]).values(last_issue_date_text=u["new"])
            )
        await session.commit()

    print(f"\nTamamlandı: {len(to_update)} kayıt güncellendi.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"\nHATA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
