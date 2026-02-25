"""
KAP (Kamuyu Aydinlatma Platformu) veri cekme servisi.

1. CSV'den sirket listesini okur, kap_companies'a upsert eder
2. Her sirketin sgbf-data API'sinden bildirimleri ceker
3. Her bildirim icin Excel export'u indirip parse eder
4. kap_disclosures ve kap_disclosure_details tablolarina yazar
"""

import asyncio
import csv
import io
import logging
import re
import time
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import httpx
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.kap_disclosure import KapCompany, KapDisclosure, KapDisclosureDetail

logger = logging.getLogger(__name__)

ISIN_PATTERN = re.compile(r"(TR[A-Z0-9]{10,})")
CSV_PATH = Path(__file__).resolve().parent.parent.parent.parent / "sirket_kap_idleri.csv"
# Docker: /app dizinine mount ediliyor, CSV proje kökündedir
# docker-compose'da volume eklenecek
CSV_DOCKER_PATH = Path("/data/sirket_kap_idleri.csv")
REQUEST_DELAY = 0.3  # seconds between API calls
EXCEL_DELAY = 0.5  # seconds between Excel downloads

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Referer": "https://www.kap.org.tr/",
}


# ─── CSV Parse ───────────────────────────────────────────────────────────


def read_companies_from_csv(csv_path: Path | None = None) -> list[dict]:
    """sirket_kap_idleri.csv dosyasini oku."""
    if csv_path:
        path = csv_path
    elif CSV_DOCKER_PATH.exists():
        path = CSV_DOCKER_PATH
    elif CSV_PATH.exists():
        path = CSV_PATH
    else:
        raise FileNotFoundError(
            f"CSV bulunamadi. Aranan: {CSV_DOCKER_PATH}, {CSV_PATH}"
        )
    companies = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("api_url"):
                continue
            companies.append({
                "sirket_adi": row["sirket_adi"].strip(),
                "kap_id": row["kap_id"].strip(),
                "api_url": row["api_url"].strip(),
            })
    return companies


def upsert_companies(db: Session, companies: list[dict]) -> dict[str, int]:
    """Sirketleri kap_companies tablosuna upsert et. Returns kap_id -> company_id map."""
    kap_id_map = {}
    for comp in companies:
        existing = db.execute(
            select(KapCompany).where(KapCompany.kap_id == comp["kap_id"])
        ).scalar_one_or_none()

        if existing:
            existing.sirket_adi = comp["sirket_adi"]
            existing.api_url = comp["api_url"]
            kap_id_map[comp["kap_id"]] = existing.id
        else:
            new_comp = KapCompany(
                sirket_adi=comp["sirket_adi"],
                kap_id=comp["kap_id"],
                api_url=comp["api_url"],
            )
            db.add(new_comp)
            db.flush()
            kap_id_map[comp["kap_id"]] = new_comp.id

    db.commit()
    return kap_id_map


# ─── API Fetch (sgbf-data) ───────────────────────────────────────────────


def fetch_company_disclosures(client: httpx.Client, api_url: str) -> list[dict]:
    """Bir sirketin sgbf-data API'sinden bildirimleri cek."""
    resp = client.get(api_url, headers=HEADERS, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    return resp.json()


def parse_disclosure_basic(item: dict) -> dict:
    """API response'daki bir bildirimi parse et."""
    basic = item.get("disclosureBasic", {})

    summary = basic.get("summary", "") or ""
    isin_match = ISIN_PATTERN.search(summary)
    isin_code = isin_match.group(1) if isin_match else None

    publish_date_str = basic.get("publishDate", "")
    publish_date = None
    if publish_date_str:
        try:
            publish_date = datetime.strptime(publish_date_str, "%d.%m.%Y %H:%M:%S")
        except ValueError:
            pass

    disclosure_index = basic.get("disclosureIndex")

    return {
        "disclosure_index": disclosure_index,
        "disclosure_id": basic.get("disclosureId"),
        "title": basic.get("title"),
        "summary": summary,
        "publish_date": publish_date,
        "isin_code": isin_code,
        "disclosure_class": basic.get("disclosureClass"),
        "disclosure_type": basic.get("disclosureType"),
        "disclosure_category": basic.get("disclosureCategory"),
        "company_title": basic.get("companyTitle"),
        "stock_code": basic.get("stockCode"),
        "related_stocks": basic.get("relatedStocks"),
        "is_changed": basic.get("isChanged"),
        "is_late": bool(basic.get("isLate")) if basic.get("isLate") is not None else None,
        "attachment_count": basic.get("attachmentCount", 0),
        "has_multi_language": basic.get("hasMultiLanguageSupport"),
        "period": basic.get("period"),
        "year": str(basic.get("year")) if basic.get("year") else None,
        "disclosure_url": f"https://www.kap.org.tr/en/Bildirim/{disclosure_index}" if disclosure_index else None,
    }


def save_disclosures(db: Session, company_id: int, disclosures: list[dict]) -> list[KapDisclosure]:
    """Bildirimleri kap_disclosures tablosuna kaydet. Sadece yenileri ekler."""
    today = date.today()
    new_records = []

    existing_indices = set()
    result = db.execute(
        select(KapDisclosure.disclosure_index).where(
            KapDisclosure.kap_company_id == company_id
        )
    )
    for row in result:
        existing_indices.add(row[0])

    for disc_data in disclosures:
        if disc_data["disclosure_index"] in existing_indices:
            continue

        disclosure = KapDisclosure(
            kap_company_id=company_id,
            disclosure_index=disc_data["disclosure_index"],
            disclosure_id=disc_data["disclosure_id"],
            title=disc_data["title"],
            summary=disc_data["summary"],
            publish_date=disc_data["publish_date"],
            isin_code=disc_data["isin_code"],
            disclosure_class=disc_data["disclosure_class"],
            disclosure_type=disc_data["disclosure_type"],
            disclosure_category=disc_data["disclosure_category"],
            company_title=disc_data["company_title"],
            stock_code=disc_data["stock_code"],
            related_stocks=disc_data["related_stocks"],
            is_changed=disc_data["is_changed"],
            is_late=disc_data["is_late"],
            attachment_count=disc_data["attachment_count"],
            has_multi_language=disc_data["has_multi_language"],
            period=disc_data["period"],
            year=disc_data["year"],
            disclosure_url=disc_data["disclosure_url"],
            fetch_date=today,
        )
        db.add(disclosure)
        new_records.append(disclosure)

    if new_records:
        db.flush()

    return new_records


# ─── Excel Detail Fetch & Parse ──────────────────────────────────────────


def download_excel_content(client: httpx.Client, disclosure_index: int) -> str | None:
    """Excel export'u indir (aslinda HTML table)."""
    url = f"https://www.kap.org.tr/en/api/notification/export/excel/{disclosure_index}"
    try:
        resp = client.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        if resp.status_code == 200 and len(resp.text) > 100:
            return resp.text
    except Exception as e:
        logger.warning(f"Excel download failed for {disclosure_index}: {e}")
    return None


def _safe_decimal(value: str | None) -> Decimal | None:
    """Guvenli Decimal cevirimi."""
    if not value:
        return None
    cleaned = value.replace(".", "").replace(",", ".").strip()
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _safe_date(value: str | None) -> date | None:
    """dd.mm.yyyy formati parse."""
    if not value:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _safe_int(value: str | None) -> int | None:
    if not value:
        return None
    cleaned = value.replace(".", "").replace(",", "").strip()
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return None


def _safe_bool(value: str | None) -> bool | None:
    if not value:
        return None
    v = value.strip().lower()
    if v in ("yes", "evet", "true", "1"):
        return True
    if v in ("no", "hayir", "hayır", "false", "0"):
        return False
    return None


def parse_excel_detail(html_content: str) -> dict:
    """Excel (HTML table) icerigini parse et."""
    result = {
        "key_values": {},
        "coupon_payments": [],
        "rating_info": [],
        "tables_raw": [],
    }

    try:
        tables = pd.read_html(html_content, header=None)
    except Exception as e:
        logger.warning(f"HTML table parse failed: {e}")
        return result

    for i, df in enumerate(tables):
        table_records = []
        for row_idx in range(len(df)):
            row = {}
            for col_idx in range(len(df.columns)):
                val = df.iloc[row_idx, col_idx]
                if pd.notna(val):
                    row[col_idx] = str(val).strip()
            if row:
                table_records.append(row)
        result["tables_raw"].append(table_records)

        # Key-value ciftlerini cikar (2 sutunlu satirlar)
        for row_idx in range(len(df)):
            row_data = {}
            for col_idx in range(len(df.columns)):
                val = df.iloc[row_idx, col_idx]
                if pd.notna(val):
                    row_data[col_idx] = str(val).strip()

            if len(row_data) == 2 and 0 in row_data and 1 in row_data:
                result["key_values"][row_data[0]] = row_data[1]

        # Kupon odeme plani tablosunu bul (10 sutunlu tablo, header satiri)
        if len(df.columns) >= 7:
            header_row = None
            for row_idx in range(len(df)):
                val0 = str(df.iloc[row_idx, 0]).strip() if pd.notna(df.iloc[row_idx, 0]) else ""
                if val0 in ("Coupon Number", "Kupon No", "1"):
                    if val0 in ("Coupon Number", "Kupon No"):
                        header_row = row_idx
                    else:
                        # Numara ile basliyorsa dogrudan veri satiri
                        data_start = row_idx
                        for r in range(data_start, len(df)):
                            row_vals = {}
                            for c in range(len(df.columns)):
                                v = df.iloc[r, c]
                                if pd.notna(v):
                                    row_vals[c] = str(v).strip()
                            if row_vals and 0 in row_vals:
                                try:
                                    int(float(row_vals[0]))
                                    result["coupon_payments"].append({
                                        "coupon_number": row_vals.get(0),
                                        "payment_date": row_vals.get(1),
                                        "record_date": row_vals.get(2),
                                        "payment_date_2": row_vals.get(3),
                                        "periodic_rate": row_vals.get(4),
                                        "yearly_simple_rate": row_vals.get(5),
                                        "yearly_compound_rate": row_vals.get(6),
                                        "payment_amount": row_vals.get(7),
                                        "was_payment_made": row_vals.get(9),
                                    })
                                except (ValueError, TypeError):
                                    if "principal" in row_vals.get(0, "").lower() or "maturity" in row_vals.get(0, "").lower():
                                        result["coupon_payments"].append({
                                            "coupon_number": "principal",
                                            "payment_date": row_vals.get(1),
                                            "payment_amount": row_vals.get(7),
                                            "was_payment_made": row_vals.get(9),
                                        })
                        break

                    continue

                if header_row is not None and row_idx > header_row:
                    row_vals = {}
                    for c in range(len(df.columns)):
                        v = df.iloc[row_idx, c]
                        if pd.notna(v):
                            row_vals[c] = str(v).strip()
                    if row_vals and 0 in row_vals:
                        try:
                            int(float(row_vals[0]))
                            result["coupon_payments"].append({
                                "coupon_number": row_vals.get(0),
                                "payment_date": row_vals.get(1),
                                "record_date": row_vals.get(2),
                                "payment_date_2": row_vals.get(3),
                                "periodic_rate": row_vals.get(4),
                                "yearly_simple_rate": row_vals.get(5),
                                "yearly_compound_rate": row_vals.get(6),
                                "payment_amount": row_vals.get(7),
                                "was_payment_made": row_vals.get(9),
                            })
                        except (ValueError, TypeError):
                            if "principal" in row_vals.get(0, "").lower() or "maturity" in row_vals.get(0, "").lower():
                                result["coupon_payments"].append({
                                    "coupon_number": "principal",
                                    "payment_date": row_vals.get(1),
                                    "payment_amount": row_vals.get(7),
                                    "was_payment_made": row_vals.get(9),
                                })

    return result


def build_detail_record(parsed: dict) -> dict:
    """Parse edilmis Excel verisinden KapDisclosureDetail alanlari olustur."""
    kv = parsed["key_values"]

    return {
        "isin_code": kv.get("ISIN Code") or kv.get("ISIN Kodu"),
        "instrument_type": kv.get("Type") or kv.get("Tür"),
        "maturity_date": _safe_date(kv.get("Maturity Date") or kv.get("İtfa Tarihi")),
        "maturity_days": _safe_int(kv.get("Maturity (Day)") or kv.get("Vade (Gün)")),
        "nominal_value": _safe_decimal(
            kv.get("Nominal Value of Capital Market Instrument Sold")
            or kv.get("İhraç Edilen Sermaye Piyasası Aracının Nominal Değeri")
        ),
        "issue_price": _safe_decimal(kv.get("Issue Price") or kv.get("İhraç Fiyatı")),
        "interest_rate_type": kv.get("Interest Rate Type") or kv.get("Faiz Oranı Tipi"),
        "floating_rate_reference": kv.get("Floating Rate Reference") or kv.get("Değişken Faiz Referansı"),
        "additional_return_pct": _safe_decimal(kv.get("Additional Return (%)") or kv.get("Ek Getiri (%)")),
        "coupon_number": _safe_int(kv.get("Coupon Number") or kv.get("Kupon Sayısı")),
        "coupon_frequency": kv.get("Coupon Payment Frequency") or kv.get("Kupon Ödeme Sıklığı"),
        "currency": kv.get("Currency Unit") or kv.get("Para Birimi"),
        "payment_type": kv.get("Payment Type") or kv.get("Ödeme Tipi"),
        "sale_type": kv.get("Sale Type") or kv.get("Satış Tipi"),
        "starting_date_sale": _safe_date(kv.get("Starting Date of Sale") or kv.get("Satış Başlangıç Tarihi")),
        "ending_date_sale": _safe_date(kv.get("Ending Date of Sale") or kv.get("Satış Bitiş Tarihi")),
        "maturity_starting_date": _safe_date(kv.get("Maturity Starting Date") or kv.get("Vade Başlangıç Tarihi")),
        "traded_in_exchange": _safe_bool(kv.get("Traded in the Stock Exchange") or kv.get("Borsada İşlem Görüyor mu")),
        "intermediary_brokerage": (
            kv.get("Title Of Intermediary Brokerage House")
            or kv.get("Aracı Kurum Ünvanı")
        ),
        "issue_limit": _safe_decimal(kv.get("Limit")),
        "issue_limit_security_type": kv.get("Issue Limit Security Type") or kv.get("İhraç Tavanı MK Türü"),
        "issue_limit_currency": kv.get("Currency Unit"),
        "issuer_has_rating": _safe_bool(kv.get("Does the issuer have a rating note?") or kv.get("İhraççının derecelendirme notu var mı?")),
        "instrument_has_rating": _safe_bool(kv.get("Does the capital market instrument have a rating note?")),
        "originator_has_rating": _safe_bool(kv.get("Does the originator have a rating note?")),
        "additional_explanation": kv.get("Additional Explanations") or kv.get("Ek Açıklamalar"),
        "board_decision_date": _safe_date(kv.get("Board Decision Date") or kv.get("Yönetim Kurulu Kararı Tarihi")),
        "subject_of_notification": kv.get("Subject of Notification") or kv.get("Bildirim Konusu"),
        "coupon_payments_json": parsed["coupon_payments"] if parsed["coupon_payments"] else None,
        "raw_data_json": {
            "key_values": parsed["key_values"],
            "coupon_payments": parsed["coupon_payments"],
        },
    }


def save_disclosure_detail(
    db: Session,
    disclosure: KapDisclosure,
    detail_data: dict,
) -> KapDisclosureDetail | None:
    """Bildirim detayini kap_disclosure_details tablosuna kaydet."""
    existing = db.execute(
        select(KapDisclosureDetail).where(
            KapDisclosureDetail.disclosure_id == disclosure.id
        )
    ).scalar_one_or_none()

    if existing:
        # Guncelle
        for key, value in detail_data.items():
            if value is not None:
                setattr(existing, key, value)
        existing.fetched_at = datetime.utcnow()
        return existing

    detail = KapDisclosureDetail(
        disclosure_id=disclosure.id,
        **detail_data,
    )
    db.add(detail)
    db.flush()
    return detail


# ─── Rating Parse (ayri tablo satiri) ────────────────────────────────────


def extract_rating_from_parsed(parsed: dict) -> dict:
    """Rating bilgilerini cikar ve detail_data'ya ekle."""
    updates = {}
    for table in parsed["tables_raw"]:
        for i, row in enumerate(table):
            if 0 in row and 1 in row and 2 in row and 3 in row:
                # Header olmayan, rating verisi iceren satir
                val0 = row[0]
                if val0 not in ("Rating Company", "Derecelendirme Kuruluşu", "Coupon Number", "Kupon No"):
                    # Potansiyel rating satiri
                    if any(w in val0 for w in ["Fitch", "Moody", "S&P", "JCR", "Türk", "SAHA"]):
                        updates["issuer_rating_company"] = val0
                        updates["issuer_rating_note"] = row.get(1)
                        updates["issuer_rating_date"] = _safe_date(row.get(2))
                        updates["issuer_rating_investment_grade"] = _safe_bool(row.get(3))
                        break
    return updates


# ─── Main Orchestrator ───────────────────────────────────────────────────


def fetch_all_kap_data(db: Session, max_companies: int | None = None, fetch_details: bool = True):
    """
    Tum KAP verilerini cek ve DB'ye yaz.

    Args:
        db: SQLAlchemy sync session
        max_companies: Test icin sinirla (None = hepsi)
        fetch_details: Excel detaylarini da cek (yavassa False yapilabilir)
    """
    logger.info("KAP veri cekimi basliyor...")

    # 1. CSV oku ve sirketleri upsert et
    companies = read_companies_from_csv()
    if max_companies:
        companies = companies[:max_companies]

    kap_id_map = upsert_companies(db, companies)
    logger.info(f"{len(kap_id_map)} sirket upsert edildi")

    total_new = 0
    total_details = 0

    with httpx.Client() as client:
        for i, comp in enumerate(companies):
            company_id = kap_id_map[comp["kap_id"]]
            logger.info(f"[{i+1}/{len(companies)}] {comp['sirket_adi']}...")

            try:
                # 2. Bildirimleri cek
                raw = fetch_company_disclosures(client, comp["api_url"])
                parsed_list = [parse_disclosure_basic(item) for item in raw]

                # 3. DB'ye kaydet (Sadece son 3 gunlugu)
                recent_disclosures = []
                three_days_ago = date.today() - pd.Timedelta(days=3)
                for item in parsed_list:
                    pub_date = item.get("publish_date")
                    if pub_date:
                        if pub_date.date() >= three_days_ago:
                            recent_disclosures.append(item)
                    else:
                        # Tarih yoksa (nadiren olur) guvenli kalmak icin ekle
                        recent_disclosures.append(item)
                
                new_disclosures = save_disclosures(db, company_id, recent_disclosures)
                total_new += len(new_disclosures)
                logger.info(f"  {len(raw)} cikan, {len(recent_disclosures)} filtrelenen (3gun), {len(new_disclosures)} yeni")

                # 4. Yeni bildirimler icin Excel detaylarini cek
                if fetch_details and new_disclosures:
                    for disc in new_disclosures:
                        if not disc.isin_code:
                            continue  # ISIN yoksa detay gereksiz

                        time.sleep(EXCEL_DELAY)
                        html = download_excel_content(client, disc.disclosure_index)
                        if html:
                            parsed = parse_excel_detail(html)
                            detail_data = build_detail_record(parsed)

                            # Rating bilgileri
                            rating_updates = extract_rating_from_parsed(parsed)
                            detail_data.update(rating_updates)

                            save_disclosure_detail(db, disc, detail_data)
                            total_details += 1

                # Sirketin last_fetched_at guncelle
                comp_record = db.get(KapCompany, company_id)
                if comp_record:
                    comp_record.last_fetched_at = datetime.utcnow()
                    comp_record.stock_code = parsed_list[0].get("stock_code") if parsed_list else None

                db.commit()

            except Exception as e:
                logger.error(f"  HATA: {e}")
                db.rollback()

            time.sleep(REQUEST_DELAY)

    logger.info(f"KAP cekimi tamamlandi: {total_new} yeni bildirim, {total_details} detay")
    return {"new_disclosures": total_new, "new_details": total_details}
