"""
KAP API endpoint'leri.
/kap/disclosures, /kap/companies, /kap/unmatched, /kap/fetch
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, get_admin_user
from app.models.bond import Bond
from app.models.user import User
from app.models.kap_disclosure import KapCompany, KapDisclosure, KapDisclosureDetail
from app.services.kap_data_resolver import (
    get_kap_data_for_isin,
    get_all_kap_disclosures_for_isin,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/disclosures")
async def get_kap_disclosures(
    isin_code: str | None = Query(None, description="ISIN kodu ile filtrele"),
    company: str | None = Query(None, description="Sirket adi ile filtrele"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """KAP bildirimlerini sorgula."""
    if isin_code:
        disclosures = await get_all_kap_disclosures_for_isin(db, isin_code)
        detail = await get_kap_data_for_isin(db, isin_code)
        return {
            "isin_code": isin_code,
            "disclosures": disclosures,
            "latest_detail": detail,
            "total": len(disclosures),
        }

    query = select(KapDisclosure).order_by(KapDisclosure.publish_date.desc()).limit(limit)

    if company:
        query = query.join(KapCompany).where(
            KapCompany.sirket_adi.ilike(f"%{company}%")
        )

    result = await db.execute(query)
    disclosures = result.scalars().all()

    return {
        "disclosures": [
            {
                "disclosure_index": d.disclosure_index,
                "title": d.title,
                "summary": d.summary,
                "publish_date": d.publish_date.isoformat() if d.publish_date else None,
                "isin_code": d.isin_code,
                "disclosure_url": d.disclosure_url,
                "disclosure_type": d.disclosure_type,
                "company_title": d.company_title,
                "stock_code": d.stock_code,
            }
            for d in disclosures
        ],
        "total": len(disclosures),
    }


@router.get("/companies")
async def get_kap_companies(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """KAP sirketlerini listele."""
    result = await db.execute(
        select(KapCompany).order_by(KapCompany.sirket_adi)
    )
    companies = result.scalars().all()

    return {
        "companies": [
            {
                "id": c.id,
                "sirket_adi": c.sirket_adi,
                "kap_id": c.kap_id,
                "stock_code": c.stock_code,
                "last_fetched_at": c.last_fetched_at.isoformat() if c.last_fetched_at else None,
            }
            for c in companies
        ],
        "total": len(companies),
    }


@router.get("/unmatched")
async def get_unmatched_isins(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """KAP'ta olup bonds tablosunda olmayan ISIN kodlarini getir."""
    # KAP'taki benzersiz ISIN kodlari
    kap_result = await db.execute(
        select(KapDisclosure.isin_code)
        .where(KapDisclosure.isin_code.isnot(None))
        .distinct()
    )
    kap_isins = {row[0] for row in kap_result}

    # bonds tablosundaki ISIN kodlari
    bond_result = await db.execute(
        select(Bond.isin_code)
    )
    bond_isins = {row[0] for row in bond_result}

    # Fark
    unmatched = sorted(kap_isins - bond_isins)

    # Her biri icin son bildirim bilgisi
    unmatched_details = []
    for isin in unmatched[:100]:  # Limit
        disc_result = await db.execute(
            select(KapDisclosure)
            .where(KapDisclosure.isin_code == isin)
            .order_by(KapDisclosure.publish_date.desc())
            .limit(1)
        )
        disc = disc_result.scalar_one_or_none()
        if disc:
            unmatched_details.append({
                "isin_code": isin,
                "last_disclosure_title": disc.title,
                "company_title": disc.company_title,
                "publish_date": disc.publish_date.isoformat() if disc.publish_date else None,
                "disclosure_url": disc.disclosure_url,
            })

    return {
        "total_kap_isins": len(kap_isins),
        "total_bond_isins": len(bond_isins),
        "unmatched_count": len(unmatched),
        "unmatched": unmatched_details,
    }


@router.post("/fetch")
async def trigger_kap_fetch(
    max_companies: int | None = Query(None, description="Sirket limiti (test icin)"),
    _admin: User = Depends(get_admin_user),
):
    """Admin: KAP veri cekimini manuel tetikle."""
    from app.tasks.kap_tasks import fetch_kap_disclosures

    task = fetch_kap_disclosures.delay()
    return {
        "message": "KAP veri cekimi baslatildi",
        "task_id": task.id,
    }
