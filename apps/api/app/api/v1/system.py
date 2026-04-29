from datetime import date, timedelta
from sqlalchemy import or_

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.system_setting import SystemSetting
from app.models.tlref_rate import TLREFRate
from app.models.bond import Bond
from sqlalchemy import func

router = APIRouter()

@router.get("/maintenance")
async def get_maintenance_status(db: AsyncSession = Depends(get_db)):
    """
    Returns the current maintenance mode status.
    Publicly accessible.
    """
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "maintenance_mode"))
    setting = result.scalar_one_or_none()
    
    is_maintenance = False
    if setting and setting.value == "true":
        is_maintenance = True
        
    return {"is_maintenance": is_maintenance}

@router.get("/public-summary")
async def get_public_summary(db: AsyncSession = Depends(get_db)):
    """Auth gerektirmez: landing sayfasi icin ozet veri."""
    
    # 1. En son 2 TLREF kaydını tek sorguda al
    recent_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(2)
    )
    recent_rates = recent_result.scalars().all()
    latest = recent_rates[0] if len(recent_rates) > 0 else None
    prev = recent_rates[1] if len(recent_rates) > 1 else None

    # 2. İlk TLREF kaydı (yıllıklandırılmış getiri için)
    first_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.asc()).limit(1)
    )
    first = first_result.scalar_one_or_none()

    # 3. İstatistiksel Count'ları al
    tlref_count = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0
    today = date.today()
    total_bonds = (
        await db.execute(
            select(func.count(Bond.id)).where(
                Bond.is_active == True,
                Bond.maturity_date >= today,
            )
        )
    ).scalar() or 0

    tlref_index_change_pct = None
    if latest and prev and prev.index_value and float(prev.index_value) > 0:
        change = (float(latest.index_value) - float(prev.index_value)) / float(prev.index_value) * 100
        tlref_index_change_pct = round(change, 2)

    annualized_rate = None
    if latest and first and first.index_value > 0:
        days = (latest.rate_date - first.rate_date).days
        if days > 0:
            ratio = float(latest.index_value / first.index_value)
            annualized_rate = round((ratio ** (365.0 / days) - 1) * 100, 2)

    # 4. Veri açıklanmasına en yakın gün kalan tahvilleri getir (Bugün, Yarın, 2 Gün Sonra)
    today_dt = date.today()
    max_date = today_dt + timedelta(days=2)
    
    upcoming_result = await db.execute(
        select(Bond)
        .where(Bond.is_active == True, Bond.maturity_date >= today_dt)
        .where(Bond.next_coupon_date >= today_dt, Bond.next_coupon_date <= max_date)
        .order_by(Bond.next_coupon_date.asc())
    )
    upcoming_bonds_records = upcoming_result.scalars().all()
    
    upcoming_bonds = [
        {
            "isin_code": b.isin_code,
            "issuer": b.issuer,
            "next_coupon_date": b.next_coupon_date.isoformat() if b.next_coupon_date else None,
            "days_to_coupon": (b.next_coupon_date - today_dt).days if b.next_coupon_date else None
        }
        for b in upcoming_bonds_records
    ]

    return {
        "tlref_index": float(latest.index_value) if latest else None,
        "tlref_date": latest.rate_date.isoformat() if latest else None,
        "tlref_daily_rate": float(latest.daily_rate * 100) if latest and latest.daily_rate else None,
        "tlref_annualized_rate": annualized_rate,
        "tlref_index_change_pct": tlref_index_change_pct,
        "total_tlref_records": tlref_count,
        "total_bonds": total_bonds,
        "upcoming_bonds": upcoming_bonds,
    }


@router.get("/public-bonds")
async def get_public_bonds(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=1000, ge=1, le=2000),
):
    """Auth gerektirmez: sitemap ve public tahvil sayfaları için liste."""
    today = date.today()
    result = await db.execute(
        select(Bond)
        .where(Bond.is_active == True, Bond.maturity_date >= today)
        .order_by(Bond.updated_at.desc())
        .limit(limit)
    )
    bonds = result.scalars().all()
    return [
        {
            "isin_code": b.isin_code,
            "issuer": b.issuer,
            "security_type": b.security_type,
            "yield_type": b.yield_type,
            "currency": b.currency,
            "maturity_date": b.maturity_date.isoformat() if b.maturity_date else None,
            "coupon_frequency": b.coupon_frequency,
            "updated_at": b.updated_at.isoformat() if b.updated_at else None,
        }
        for b in bonds
    ]


@router.get("/public-bonds/{isin}")
async def get_public_bond(isin: str, db: AsyncSession = Depends(get_db)):
    """Auth gerektirmez: tek tahvil temel bilgisi."""
    today = date.today()
    result = await db.execute(
        select(Bond).where(Bond.isin_code == isin, Bond.is_active == True, Bond.maturity_date >= today)
    )
    bond = result.scalar_one_or_none()
    if bond is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
    return {
        "isin_code": bond.isin_code,
        "issuer": bond.issuer,
        "security_type": bond.security_type,
        "yield_type": bond.yield_type,
        "currency": bond.currency,
        "maturity_date": bond.maturity_date.isoformat() if bond.maturity_date else None,
        "coupon_frequency": bond.coupon_frequency,
        "first_issue_date": bond.first_issue_date.isoformat() if bond.first_issue_date else None,
        "total_issue_amount": float(bond.total_issue_amount) if bond.total_issue_amount else None,
        "next_coupon_date": bond.next_coupon_date.isoformat() if bond.next_coupon_date else None,
        "updated_at": bond.updated_at.isoformat() if bond.updated_at else None,
    }
