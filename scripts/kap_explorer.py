"""
KAP Veri Keşif Scripti
=====================
CSV'deki ilk 5 şirketten KAP bildirimlerini çeker, parse eder,
ve verileri incelemeye sunar.
"""

import csv
import json
import re
import time
from pathlib import Path
from datetime import datetime

import httpx

# ─── Config ──────────────────────────────────────────────────────────────
CSV_PATH = Path(__file__).parent.parent / "sirket_kap_idleri.csv"
MAX_COMPANIES = 5  # İlk kaç şirketi çekelim (test için)
REQUEST_DELAY = 0.5  # Saniye (rate limiting)
ISIN_PATTERN = re.compile(r"(TR[A-Z0-9]{10,})")

# ─── CSV Oku ─────────────────────────────────────────────────────────────
def read_companies(csv_path: Path, limit: int = MAX_COMPANIES):
    companies = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("api_url"):
                continue
            companies.append({
                "sirket_adi": row["sirket_adi"].strip(),
                "kap_id": row["kap_id"].strip(),
                "api_url": row["api_url"].strip(),
            })
            if len(companies) >= limit:
                break
    return companies

# ─── KAP API Fetch ───────────────────────────────────────────────────────
def fetch_company_disclosures(client: httpx.Client, api_url: str) -> list[dict]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    resp = client.get(api_url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()

# ─── Parse Disclosure ────────────────────────────────────────────────────
def parse_disclosure(item: dict) -> dict:
    basic = item.get("disclosureBasic", {})
    detail = item.get("disclosureDetail", {})
    
    summary = basic.get("summary", "") or ""
    title = basic.get("title", "") or ""
    
    # ISIN kodunu summary'den çıkar
    isin_match = ISIN_PATTERN.search(summary)
    isin_code = isin_match.group(1) if isin_match else None
    
    # publishDate parse: "24.02.2026 14:17:33"
    publish_date_str = basic.get("publishDate", "")
    publish_date = None
    if publish_date_str:
        try:
            publish_date = datetime.strptime(publish_date_str, "%d.%m.%Y %H:%M:%S")
        except ValueError:
            publish_date = publish_date_str
    
    # Disclosure URL oluştur
    disclosure_index = basic.get("disclosureIndex")
    disclosure_url = f"https://www.kap.org.tr/en/Bildirim/{disclosure_index}" if disclosure_index else None
    
    return {
        # ─── Temel Bildirim Bilgileri ─────────
        "disclosure_index": disclosure_index,
        "disclosure_id": basic.get("disclosureId"),
        "title": title,
        "summary": summary,
        "publish_date": publish_date,
        "disclosure_url": disclosure_url,
        
        # ─── Şirket Bilgileri ─────────────────
        "company_title": basic.get("companyTitle"),
        "stock_code": basic.get("stockCode"),
        "mkk_member_oid": basic.get("mkkMemberOid"),
        
        # ─── Sınıflandırma ───────────────────
        "disclosure_class": basic.get("disclosureClass"),
        "disclosure_type": basic.get("disclosureType"),
        "disclosure_category": basic.get("disclosureCategory"),
        
        # ─── İlişkili Veriler ─────────────────
        "related_stocks": basic.get("relatedStocks"),
        "is_changed": basic.get("isChanged"),
        "is_late": basic.get("isLate"),
        "attachment_count": basic.get("attachmentCount", 0),
        "has_multi_language": basic.get("hasMultiLanguageSupport"),
        
        # ─── Parse Edilen Veriler ─────────────
        "isin_code": isin_code,
        
        # ─── Dönem/Yıl ───────────────────────
        "year": basic.get("year"),
        "donem": basic.get("donem"),
        "period": basic.get("period"),
        
        # ─── Detail Alanları ──────────────────
        "fund_type": basic.get("fundType"),
        "related_disclosure_oid": basic.get("relatedDisclosureOid"),
        "ft_niteligi": detail.get("ftNiteligi"),
        "opinion": detail.get("opinion"),
        "opinion_type": detail.get("opinionType"),
        "audit_type": detail.get("auditType"),
        "old_kap": detail.get("oldKap"),
    }

# ─── Ana Çalıştırma ─────────────────────────────────────────────────────
def main():
    print("=" * 80)
    print("KAP VERİ KEŞİF ARACI")
    print("=" * 80)
    
    companies = read_companies(CSV_PATH)
    print(f"\n📋 CSV'den {len(companies)} şirket okundu (limit: {MAX_COMPANIES})")
    
    all_disclosures = []
    all_isin_codes = set()
    
    with httpx.Client() as client:
        for i, company in enumerate(companies):
            print(f"\n{'─' * 60}")
            print(f"🏢 [{i+1}/{len(companies)}] {company['sirket_adi']}")
            print(f"   KAP ID: {company['kap_id']}")
            print(f"   API URL: {company['api_url'][:80]}...")
            
            try:
                raw = fetch_company_disclosures(client, company["api_url"])
                print(f"   ✅ {len(raw)} bildirim çekildi")
                
                for item in raw:
                    parsed = parse_disclosure(item)
                    parsed["_sirket_adi"] = company["sirket_adi"]
                    all_disclosures.append(parsed)
                    
                    if parsed["isin_code"]:
                        all_isin_codes.add(parsed["isin_code"])
                
                # İlk 3 bildirimi detaylı göster
                print(f"\n   📊 İlk 3 bildirim detayı:")
                for j, item in enumerate(raw[:3]):
                    parsed = parse_disclosure(item)
                    print(f"\n   ── Bildirim {j+1} ──")
                    print(f"   Index:       {parsed['disclosure_index']}")
                    print(f"   Başlık:      {parsed['title'][:70]}")
                    print(f"   Özet:        {parsed['summary'][:100]}")
                    print(f"   Tarih:       {parsed['publish_date']}")
                    print(f"   ISIN:        {parsed['isin_code'] or '❌ Bulunamadı'}")
                    print(f"   URL:         {parsed['disclosure_url']}")
                    print(f"   Tür:         {parsed['disclosure_type']} / {parsed['disclosure_category']}")
                    print(f"   İlişkili:    {parsed['related_stocks'] or '-'}")
                    print(f"   Değişti mi:  {parsed['is_changed'] or 'Hayır'}")
                    print(f"   Ek sayısı:   {parsed['attachment_count']}")
                
            except Exception as e:
                print(f"   ❌ Hata: {e}")
            
            time.sleep(REQUEST_DELAY)
    
    # ─── Özet İstatistikler ──────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("📈 ÖZET İSTATİSTİKLER")
    print("=" * 80)
    print(f"  Toplam bildirim:          {len(all_disclosures)}")
    print(f"  ISIN bulunan bildirim:    {sum(1 for d in all_disclosures if d['isin_code'])}")
    print(f"  ISIN bulunamayan:         {sum(1 for d in all_disclosures if not d['isin_code'])}")
    print(f"  Benzersiz ISIN sayısı:    {len(all_isin_codes)}")
    
    # Bildirim türleri dağılımı
    type_counts = {}
    for d in all_disclosures:
        t = d["title"][:50]
        type_counts[t] = type_counts.get(t, 0) + 1
    
    print(f"\n  📊 Bildirim Türleri:")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"     {count:4d}x  {t}")
    
    # ISIN kodlarının listesi
    if all_isin_codes:
        print(f"\n  🔑 Bulunan ISIN Kodları (ilk 30):")
        for isin in sorted(all_isin_codes)[:30]:
            print(f"     {isin}")
    
    # ─── Tüm alanları göster (ilk bildirim) ──────────────────────────────
    if all_disclosures:
        print(f"\n{'=' * 80}")
        print("🔍 TAM VERİ YAPISI (İlk bildirim - tüm alanlar):")
        print("=" * 80)
        first = all_disclosures[0]
        for key, value in first.items():
            if key.startswith("_"):
                continue
            v_str = str(value) if value is not None else "null"
            print(f"  {key:30s} : {v_str[:80]}")
    
    # JSON'a da kaydet
    output_path = Path(__file__).parent / "kap_sample_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        # datetime objeleri string'e çevir
        serializable = []
        for d in all_disclosures:
            sd = {}
            for k, v in d.items():
                if isinstance(v, datetime):
                    sd[k] = v.isoformat()
                else:
                    sd[k] = v
            serializable.append(sd)
        json.dump(serializable, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Tüm veriler kaydedildi: {output_path}")
    print(f"   (JSON dosyasını inceleyerek hangi alanları DB'ye yazmak istediğinize karar verebilirsiniz)")


if __name__ == "__main__":
    main()
