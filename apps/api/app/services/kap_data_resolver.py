"""
KAP vs tbliste veri cakisma cozumleyici.

ISIN koduna gore her iki kaynaktan veri ceker, tarih/saat karsilastirmasiyla
guncel olani secer. Uyusmazliklari raporlar.
"""

import logging
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bond import Bond
from app.models.kap_disclosure import KapDisclosure, KapDisclosureDetail
from app.services.kap_fetcher import build_detail_record

logger = logging.getLogger(__name__)


async def get_kap_data_for_isin(db: AsyncSession, isin_code: str) -> dict | None:
    """
    ISIN koduna gore en guncel KAP bildirim detayini getir.
    En son publish_date'li, detayi olan bildirimi dondurur.
    """
    result = await db.execute(
        select(KapDisclosure, KapDisclosureDetail)
        .join(KapDisclosureDetail, KapDisclosure.id == KapDisclosureDetail.disclosure_id)
        .where(KapDisclosure.isin_code == isin_code)
        .order_by(KapDisclosure.publish_date.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return None

    disclosure, detail = row[0], row[1]

    # Re-parse from raw_data_json for records where fields were saved with wrong key names
    rp: dict = {}
    if detail.instrument_type is None and detail.raw_data_json:
        try:
            rp = build_detail_record(detail.raw_data_json)
        except Exception:
            pass

    def _d(orm_val, field: str):
        """Return ORM value if present, else fall back to re-parsed value."""
        return orm_val if orm_val is not None else rp.get(field)

    def _date_str(d) -> str | None:
        if d is None:
            return None
        return d.isoformat() if hasattr(d, "isoformat") else str(d)

    return {
        "isin_code": _d(detail.isin_code, "isin_code") or isin_code,
        "disclosure_index": disclosure.disclosure_index,
        "title": disclosure.title,
        "summary": disclosure.summary,
        "publish_date": disclosure.publish_date.isoformat() if disclosure.publish_date else None,
        "disclosure_url": disclosure.disclosure_url,
        "company_title": disclosure.company_title,
        "stock_code": disclosure.stock_code,
        "is_changed": disclosure.is_changed,
        # Detail fields
        "instrument_type": _d(detail.instrument_type, "instrument_type"),
        "fund_user": _d(detail.fund_user, "fund_user"),
        "source_institution": _d(detail.source_institution, "source_institution"),
        "maturity_date": _date_str(_d(detail.maturity_date, "maturity_date")),
        "maturity_days": _d(detail.maturity_days, "maturity_days"),
        "nominal_value": str(_d(detail.nominal_value, "nominal_value")) if _d(detail.nominal_value, "nominal_value") else None,
        "issue_price": str(_d(detail.issue_price, "issue_price")) if _d(detail.issue_price, "issue_price") else None,
        "interest_rate_type": _d(detail.interest_rate_type, "interest_rate_type"),
        "floating_rate_reference": _d(detail.floating_rate_reference, "floating_rate_reference"),
        "additional_return_pct": str(_d(detail.additional_return_pct, "additional_return_pct")) if _d(detail.additional_return_pct, "additional_return_pct") else None,
        "coupon_number": _d(detail.coupon_number, "coupon_number"),
        "coupon_frequency": _d(detail.coupon_frequency, "coupon_frequency"),
        "currency": _d(detail.currency, "currency"),
        "payment_type": _d(detail.payment_type, "payment_type"),
        "sale_type": _d(detail.sale_type, "sale_type"),
        "starting_date_sale": _date_str(_d(detail.starting_date_sale, "starting_date_sale")),
        "ending_date_sale": _date_str(_d(detail.ending_date_sale, "ending_date_sale")),
        "traded_in_exchange": _d(detail.traded_in_exchange, "traded_in_exchange"),
        "intermediary_brokerage": _d(detail.intermediary_brokerage, "intermediary_brokerage"),
        "issue_limit": str(_d(detail.issue_limit, "issue_limit")) if _d(detail.issue_limit, "issue_limit") else None,
        "issuer_has_rating": detail.issuer_has_rating,
        "issuer_rating_company": detail.issuer_rating_company,
        "issuer_rating_note": detail.issuer_rating_note,
        "issuer_rating_date": detail.issuer_rating_date.isoformat() if detail.issuer_rating_date else None,
        "issuer_rating_investment_grade": detail.issuer_rating_investment_grade,
        "instrument_has_rating": detail.instrument_has_rating,
        "originator_has_rating": detail.originator_has_rating,
        "coupon_payments": detail.coupon_payments_json,
        "additional_explanation": _d(detail.additional_explanation, "additional_explanation"),
        "board_decision_date": _date_str(_d(detail.board_decision_date, "board_decision_date")),
        "subject_of_notification": _d(detail.subject_of_notification, "subject_of_notification"),
        "fetched_at": detail.fetched_at.isoformat() if detail.fetched_at else None,
    }


async def get_all_kap_disclosures_for_isin(db: AsyncSession, isin_code: str) -> list[dict]:
    """ISIN koduna gore tum KAP bildirimlerini getir (son 50)."""
    result = await db.execute(
        select(KapDisclosure)
        .where(KapDisclosure.isin_code == isin_code)
        .order_by(KapDisclosure.publish_date.desc())
        .limit(50)
    )
    disclosures = result.scalars().all()

    return [
        {
            "disclosure_index": d.disclosure_index,
            "title": d.title,
            "summary": d.summary,
            "publish_date": d.publish_date.isoformat() if d.publish_date else None,
            "disclosure_url": d.disclosure_url,
            "disclosure_type": d.disclosure_type,
            "is_changed": d.is_changed,
        }
        for d in disclosures
    ]


def _str_val(val) -> str | None:
    if val is None:
        return None
    return str(val).strip()


async def apply_kap_data_to_bond(db: AsyncSession, bond: Bond, kap_data: dict) -> bool:
    """
    KAP verilerini Bond modeline uygula (BIST verisini ez).
    """
    changed = False
    
    # 1. Tarihleri Guncelle (KAP her zaman daha dogrudur)
    kap_maturity = kap_data.get("maturity_date")
    if kap_maturity:
        try:
            k_mat = date.fromisoformat(kap_maturity)
            if bond.maturity_date != k_mat:
                bond.maturity_date = k_mat
                changed = True
        except ValueError: pass

    # 2. Spread / Ek Getiri Guncelle
    kap_spread = kap_data.get("additional_return_pct")
    if kap_spread:
        try:
            k_spread = Decimal(str(kap_spread).replace(",", ".")) / Decimal("100")
            # Eger BIST verisiyle (bond.spread) belirgin fark varsa guncelle
            if bond.spread != k_spread:
                bond.spread = k_spread
                changed = True
        except (InvalidOperation, ValueError): pass

    # 3. Kupon Oranini Guncelle (JSON icinden gelecek ilk kuponu bul)
    coupons = kap_data.get("coupon_payments")
    if coupons and isinstance(coupons, list):
        today = date.today()
        next_coupon = None
        for c in coupons:
            p_date_str = c.get("payment_date")
            if not p_date_str: continue
            try:
                p_date = datetime.strptime(p_date_str, "%d.%m.%Y").date()
                if p_date >= today:
                    # En yakin gelecek kuponu bulduk
                    if not next_coupon or p_date < next_coupon["date"]:
                        next_coupon = {"date": p_date, "rate": c.get("periodic_rate")}
            except ValueError: continue
        
        if next_coupon:
            if bond.next_coupon_date != next_coupon["date"]:
                bond.next_coupon_date = next_coupon["date"]
                changed = True
            
            if next_coupon["rate"]:
                k_rate = Decimal(str(next_coupon["rate"]).replace(",", ".")) / Decimal("100")
                if k_rate > 0 and bond.next_coupon_rate != k_rate:
                    bond.next_coupon_rate = k_rate
                    changed = True

    # 4. Kupon Sikligi
    kap_freq = kap_data.get("coupon_frequency")
    if kap_freq and str(bond.coupon_frequency).lower() != str(kap_freq).lower():
        bond.coupon_frequency = kap_freq
        changed = True

    # 4. Faiz Tipi
    kap_rate_type = kap_data.get("interest_rate_type")
    if kap_rate_type and str(bond.yield_type).lower() != str(kap_rate_type).lower():
        bond.yield_type = kap_rate_type
        changed = True

    if changed:
        bond.updated_at = datetime.utcnow()
        await db.commit()
        logger.info(f"Bond {bond.isin_code} updated with KAP data.")
        
    return changed


async def resolve_data_conflicts(
    db: AsyncSession, bond: Bond, kap_data: dict | None = None, auto_apply: bool = True
) -> dict:
    """
    tbliste vs KAP veri cakismalarini tespit et ve coz.
    auto_apply=True ise farkliliklari otomatik Bond tablosuna yazar.
    """
    if kap_data is None:
        kap_data = await get_kap_data_for_isin(db, bond.isin_code)

    data_sources = [
        {
            "source": "tbliste",
            "label": "BIST tbliste.zip",
            "updated_at": bond.updated_at.isoformat() if bond.updated_at else None,
            "disclosure_url": "https://borsaistanbul.com/datum/tbliste.zip"
        }
    ]

    if not kap_data:
        return {"conflicts": [], "data_sources": data_sources, "kap_overrides": {}}

    data_sources.append({
        "source": "kap",
        "label": "KAP Bildirim",
        "updated_at": kap_data.get("fetched_at"),
        "disclosure_url": kap_data.get("disclosure_url"),
    })

    # Tarih karsilastirmasi icin
    tbliste_time = bond.updated_at or datetime.min
    kap_time_str = kap_data.get("fetched_at")
    kap_time = datetime.fromisoformat(kap_time_str) if kap_time_str else datetime.min

    # KAP verisi mevcutsa, BIST verisi cok daha guncel (son 1-2 saat) degilse 
    # KAP'i her zaman "newer" veya "better" kabul edelim.
    kap_is_newer = True 

    conflicts = []
    kap_overrides = {}

    # Maturity Date karsilastirmasi
    tbliste_maturity = bond.maturity_date.isoformat() if bond.maturity_date else None
    kap_maturity = kap_data.get("maturity_date")
    if kap_maturity:
        kap_overrides["maturity_date"] = kap_maturity
        if tbliste_maturity and tbliste_maturity != kap_maturity:
            conflicts.append({
                "field": "Maturity Date (İtfa Tarihi)",
                "tbliste_value": tbliste_maturity,
                "kap_value": kap_maturity,
                "resolved_source": "kap",
            })

    # Spread / Additional Return karsilastirmasi
    tbliste_spread = _str_val(bond.spread)
    kap_spread = kap_data.get("additional_return_pct")
    if kap_spread:
        kap_overrides["additional_return_pct"] = kap_spread
        if tbliste_spread and tbliste_spread != kap_spread:
            conflicts.append({
                "field": "Spread / Ek Getiri (%)",
                "tbliste_value": tbliste_spread,
                "kap_value": kap_spread,
                "resolved_source": "kap",
            })

    # Floating rate reference
    kap_ref = kap_data.get("floating_rate_reference")
    if kap_ref:
        kap_overrides["floating_rate_reference"] = kap_ref

    # Interest rate type
    kap_rate_type = kap_data.get("interest_rate_type")
    if kap_rate_type:
        kap_overrides["interest_rate_type"] = kap_rate_type
        
    # Auto-apply changes if requested and conflicts exist
    if auto_apply and (conflicts or kap_overrides):
        await apply_kap_data_to_bond(db, bond, kap_data)

    return {
        "conflicts": conflicts,
        "data_sources": data_sources,
        "kap_overrides": kap_overrides,
    }
