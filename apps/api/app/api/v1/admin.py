from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.tlref_rate import TLREFRate
from app.models.user import User
from app.api.deps import get_admin_user

router = APIRouter()


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Sadece admin: genel istatistikler (tahvil, TLREF, kullanici sayisi)."""
    bonds_count = (await db.execute(select(func.count(Bond.id)))).scalar() or 0
    tlref_count = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    return {
        "bonds_count": bonds_count,
        "tlref_count": tlref_count,
        "users_count": users_count,
    }


@router.get("/public-summary")
async def get_public_summary(db: AsyncSession = Depends(get_db)):
    """Auth gerektirmez: landing sayfasi icin ozet veri."""
    latest_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
    )
    latest = latest_result.scalar_one_or_none()

    first_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.asc()).limit(1)
    )
    first = first_result.scalar_one_or_none()

    total = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0

    annualized_rate = None
    if latest and first and first.index_value > 0:
        days = (latest.rate_date - first.rate_date).days
        if days > 0:
            ratio = float(latest.index_value / first.index_value)
            annualized_rate = round((ratio ** (365.0 / days) - 1) * 100, 2)

    return {
        "tlref_index": float(latest.index_value) if latest else None,
        "tlref_date": latest.rate_date.isoformat() if latest else None,
        "tlref_daily_rate": float(latest.daily_rate * 100) if latest and latest.daily_rate else None,
        "tlref_annualized_rate": annualized_rate,
        "total_records": total,
    }
