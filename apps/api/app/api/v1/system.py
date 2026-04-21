from datetime import date, timedelta

from fastapi import APIRouter, Depends
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
    total_bonds = (
        await db.execute(select(func.count(Bond.id)).where(Bond.is_active == True))
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

    # 4. Veri açıklanmasına 1 gün kalan tahvilleri getir
    tomorrow = date.today() + timedelta(days=1)
    upcoming_result = await db.execute(
        select(Bond)
        .where(Bond.is_active == True)
        .where(Bond.next_coupon_date == tomorrow)
        .limit(5)
    )
    upcoming_bonds_records = upcoming_result.scalars().all()
    upcoming_bonds = [
        {
            "isin_code": b.isin_code,
            "issuer": b.issuer,
            "next_coupon_date": b.next_coupon_date.isoformat() if b.next_coupon_date else None,
            "days_to_coupon": 1
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
