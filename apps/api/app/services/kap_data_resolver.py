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

    return {
        "disclosure_index": disclosure.disclosure_index,
        "title": disclosure.title,
        "summary": disclosure.summary,
        "publish_date": disclosure.publish_date.isoformat() if disclosure.publish_date else None,
        "disclosure_url": disclosure.disclosure_url,
        "company_title": disclosure.company_title,
        "stock_code": disclosure.stock_code,
        "is_changed": disclosure.is_changed,
        # Detail fields
        "instrument_type": detail.instrument_type,
        "fund_user": detail.fund_user,
        "source_institution": detail.source_institution,
        "maturity_date": detail.maturity_date.isoformat() if detail.maturity_date else None,
        "maturity_days": detail.maturity_days,
        "nominal_value": str(detail.nominal_value) if detail.nominal_value else None,
        "issue_price": str(detail.issue_price) if detail.issue_price else None,
        "interest_rate_type": detail.interest_rate_type,
        "floating_rate_reference": detail.floating_rate_reference,
        "additional_return_pct": str(detail.additional_return_pct) if detail.additional_return_pct else None,
        "coupon_number": detail.coupon_number,
        "coupon_frequency": detail.coupon_frequency,
        "currency": detail.currency,
        "payment_type": detail.payment_type,
        "sale_type": detail.sale_type,
        "starting_date_sale": detail.starting_date_sale.isoformat() if detail.starting_date_sale else None,
        "ending_date_sale": detail.ending_date_sale.isoformat() if detail.ending_date_sale else None,
        "traded_in_exchange": detail.traded_in_exchange,
        "intermediary_brokerage": detail.intermediary_brokerage,
        "issue_limit": str(detail.issue_limit) if detail.issue_limit else None,
        "issuer_has_rating": detail.issuer_has_rating,
        "issuer_rating_company": detail.issuer_rating_company,
        "issuer_rating_note": detail.issuer_rating_note,
        "issuer_rating_date": detail.issuer_rating_date.isoformat() if detail.issuer_rating_date else None,
        "issuer_rating_investment_grade": detail.issuer_rating_investment_grade,
        "instrument_has_rating": detail.instrument_has_rating,
        "originator_has_rating": detail.originator_has_rating,
        "coupon_payments": detail.coupon_payments_json,
        "additional_explanation": detail.additional_explanation,
        "board_decision_date": detail.board_decision_date.isoformat() if detail.board_decision_date else None,
        "subject_of_notification": detail.subject_of_notification,
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


async def resolve_data_conflicts(db: AsyncSession, bond: Bond) -> dict:
    """
    tbliste vs KAP veri cakismalarini tespit et ve coz.

    Returns:
        {
            "conflicts": [{"field": ..., "tbliste_value": ..., "kap_value": ..., "resolved_source": ...}],
            "data_sources": [{"source": "tbliste", "updated_at": ...}, {"source": "kap", "updated_at": ...}],
            "kap_overrides": {"spread": ..., ...}  # Hesaplamalarda kullanilacak override'lar
        }
    """
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

    kap_is_newer = kap_time > tbliste_time

    conflicts = []
    kap_overrides = {}

    # Maturity Date karsilastirmasi
    tbliste_maturity = bond.maturity_date.isoformat() if bond.maturity_date else None
    kap_maturity = kap_data.get("maturity_date")
    if tbliste_maturity and kap_maturity and tbliste_maturity != kap_maturity:
        conflicts.append({
            "field": "Maturity Date (İtfa Tarihi)",
            "tbliste_value": tbliste_maturity,
            "kap_value": kap_maturity,
            "resolved_source": "kap" if kap_is_newer else "tbliste",
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
                "resolved_source": "kap" if kap_is_newer else "tbliste",
            })

    # Coupon Frequency
    tbliste_freq = _str_val(bond.coupon_frequency)
    kap_freq = kap_data.get("coupon_frequency")
    if tbliste_freq and kap_freq and tbliste_freq.lower() != kap_freq.lower():
        conflicts.append({
            "field": "Kupon Sıklığı",
            "tbliste_value": tbliste_freq,
            "kap_value": kap_freq,
            "resolved_source": "kap" if kap_is_newer else "tbliste",
        })

    # Total Issue Amount vs Nominal Value
    tbliste_amount = _str_val(bond.total_issue_amount)
    kap_amount = kap_data.get("nominal_value")
    if tbliste_amount and kap_amount:
        # tbliste x1000 olarak sakliyor, karsilastirma icin normalize et
        pass  # Birim farki oldugu icin dogrudan karsilastirma zor

    # Floating rate reference
    kap_ref = kap_data.get("floating_rate_reference")
    if kap_ref:
        kap_overrides["floating_rate_reference"] = kap_ref

    # Interest rate type
    kap_rate_type = kap_data.get("interest_rate_type")
    if kap_rate_type:
        kap_overrides["interest_rate_type"] = kap_rate_type

    return {
        "conflicts": conflicts,
        "data_sources": data_sources,
        "kap_overrides": kap_overrides,
    }
