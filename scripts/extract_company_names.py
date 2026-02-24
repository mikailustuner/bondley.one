#!/usr/bin/env python3
"""
tbliste_20260224.xls dosyasındaki tüm şirket (ihraççı kurum) adlarını çıkarıp
sirketler.txt dosyasına satır satır yazar.
"""
import xlrd
from pathlib import Path

# Dosya yolları (proje köküne göre)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
XLS_PATH = PROJECT_ROOT / "tbliste_20260224.xls"
OUTPUT_PATH = PROJECT_ROOT / "sirketler.txt"

# İhraççı Kurum / Issuer sütunu (0 tabanlı index)
ISSUER_COLUMN = 3
# Başlık satırı (0 = ilk satır başlık, 1'den itibaren veri)
HEADER_ROW_INDEX = 0


def main():
    if not XLS_PATH.exists():
        print(f"Hata: Dosya bulunamadı: {XLS_PATH}")
        return 1

    wb = xlrd.open_workbook(str(XLS_PATH))
    sheet = wb.sheet_by_index(0)

    companies = []

    for row_idx in range(HEADER_ROW_INDEX + 1, sheet.nrows):
        try:
            val = sheet.cell_value(row_idx, ISSUER_COLUMN)
            if val is None:
                continue
            name = str(val).strip()
            if not name or name.isspace():
                continue
            companies.append(name)
        except IndexError:
            continue

    OUTPUT_PATH.write_text("\n".join(companies), encoding="utf-8")
    print(f"Toplam {len(companies)} şirket/ihraççı adı (her tahvil için bir satır) yazıldı: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    exit(main())
