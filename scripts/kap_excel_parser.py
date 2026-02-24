"""
KAP Excel/HTML Bildirim Parser
===============================
KAP 'Excel export' aslinda HTML table donduruyor.
pandas.read_html ile parse ediyoruz.
"""

import json
import sys
import os

import httpx
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*",
    "Referer": "https://www.kap.org.tr/",
}


def download_content(index: int) -> str:
    """Excel/HTML content indir."""
    url = f"https://www.kap.org.tr/en/api/notification/export/excel/{index}"
    with httpx.Client() as client:
        resp = client.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        resp.raise_for_status()
        return resp.text


def main():
    index = int(sys.argv[1]) if len(sys.argv) > 1 else 1556913
    
    lines = []
    def p(text=""):
        lines.append(text)
    
    p(f"KAP Bildirim Parser - Index: {index}")
    p(f"URL: kap.org.tr/en/api/notification/export/excel/{index}")
    p()
    
    # 1. Indir
    p("Indiriliyor...")
    html_content = download_content(index)
    p(f"Indirildi: {len(html_content)} karakter")
    
    # Raw HTML'i kaydet (debug icin)
    raw_path = os.path.join("scripts", f"kap_raw_{index}.html")
    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    p(f"Raw HTML kaydedildi: {raw_path}")
    
    # 2. pandas ile tablolari parse et
    p("\nParse ediliyor (pandas.read_html)...")
    try:
        tables = pd.read_html(html_content, header=None)
        p(f"Bulunan tablo sayisi: {len(tables)}")
        
        all_key_values = {}
        
        for i, df in enumerate(tables):
            p(f"\n{'=' * 75}")
            p(f"TABLO {i+1} ({df.shape[0]} satir x {df.shape[1]} sutun)")
            p("=" * 75)
            
            # Tum satir ve sutunlari goster
            for row_idx in range(len(df)):
                row_data = {}
                row_strs = []
                for col_idx in range(len(df.columns)):
                    val = df.iloc[row_idx, col_idx]
                    if pd.notna(val):
                        val_str = str(val).strip()
                        if val_str:
                            row_strs.append(f"[{col_idx}] {val_str}")
                            row_data[col_idx] = val_str
                
                if row_strs:
                    p(f"  Satir {row_idx:3d}: {' | '.join(row_strs)}")
                
                # 2 sutunlu key-value cifti mi?
                if len(row_data) == 2:
                    vals = list(row_data.values())
                    all_key_values[vals[0]] = vals[1]
                elif len(row_data) >= 2:
                    vals = list(row_data.values())
                    # Ilk sutun genelde key, gerisi value
                    all_key_values[vals[0]] = " | ".join(vals[1:])
        
        # Key-Value ozet
        if all_key_values:
            p(f"\n{'=' * 75}")
            p("PARSE EDILEN TUM KEY-VALUE CIFTLERI")
            p("=" * 75)
            for key, val in all_key_values.items():
                p(f"  {key[:55]:55s}: {val[:80]}")
        
        # JSON kaydet
        out_data = {
            "disclosure_index": index,
            "table_count": len(tables),
            "key_value_pairs": all_key_values,
            "tables_detail": [],
        }
        
        for i, df in enumerate(tables):
            table_records = []
            for row_idx in range(len(df)):
                row = {}
                for col_idx in range(len(df.columns)):
                    val = df.iloc[row_idx, col_idx]
                    if pd.notna(val):
                        row[f"col_{col_idx}"] = str(val).strip()
                if row:
                    table_records.append(row)
            out_data["tables_detail"].append({
                "table_index": i,
                "shape": list(df.shape),
                "records": table_records,
            })
        
        json_path = os.path.join("scripts", f"kap_excel_parsed_{index}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(out_data, f, ensure_ascii=False, indent=2)
        p(f"\nJSON kaydedildi: {json_path}")
        
    except Exception as e:
        p(f"HATA: {e}")
        import traceback
        p(traceback.format_exc())
    
    # Ciktilari dosyaya yaz
    full_text = "\n".join(lines)
    txt_path = os.path.join("scripts", f"kap_excel_output_{index}.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(full_text)
    
    print(full_text)


if __name__ == "__main__":
    main()
