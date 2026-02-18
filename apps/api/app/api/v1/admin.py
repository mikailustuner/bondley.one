from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.calculation import Calculation
from app.models.market_data import MarketData
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
    """Auth gerektirmez: landing sayfasi icin ozet veri (TLREF + son tahviller)."""
    tlref_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
    )
    tlref = tlref_result.scalar_one_or_none()
    tlref_value = float(tlref.rate_value) if tlref else None

    bonds_result = await db.execute(
        select(Bond).where(Bond.is_active == True).order_by(Bond.maturity_date).limit(6)
    )
    bonds = bonds_result.scalars().all()

    items = []
    for b in bonds:
        md_result = await db.execute(
            select(MarketData)
            .where(MarketData.bond_id == b.id)
            .order_by(MarketData.trade_date.desc())
            .limit(1)
        )
        md = md_result.scalar_one_or_none()

        calc_result = await db.execute(
            select(Calculation)
            .where(Calculation.bond_id == b.id)
            .order_by(Calculation.calc_date.desc())
            .limit(1)
        )
        calc = calc_result.scalar_one_or_none()

        items.append({
            "isin": b.isin_code,
            "bond_type": b.bond_type,
            "price": float(md.clean_price) if md else None,
            "ytm": float(calc.yield_to_maturity) if calc else None,
            "spread": float(calc.spread) if calc and calc.spread else None,
        })

    return {
        "tlref_rate": tlref_value,
        "bonds": items,
    }
