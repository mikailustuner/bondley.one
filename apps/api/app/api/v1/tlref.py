import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tlref_rate import TLREFRate
from app.models.user import User
from app.schemas.tlref import TLREFRateResponse, TLREFRateListResponse
from app.services.tlref_fetcher import TLREFFetcher
from app.api.deps import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/latest", response_model=TLREFRateResponse | None)
async def get_latest_tlref(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
    )
    rate = result.scalar_one_or_none()
    if rate:
        return TLREFRateResponse.model_validate(rate)
    return None


@router.get("/history", response_model=TLREFRateListResponse)
async def get_tlref_history(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(365, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(TLREFRate)
    count_query = select(func.count(TLREFRate.id))

    if start_date:
        query = query.where(TLREFRate.rate_date >= start_date)
        count_query = count_query.where(TLREFRate.rate_date >= start_date)
    if end_date:
        query = query.where(TLREFRate.rate_date <= end_date)
        count_query = count_query.where(TLREFRate.rate_date <= end_date)

    total = (await db.execute(count_query)).scalar()
    result = await db.execute(query.order_by(TLREFRate.rate_date.desc()).limit(limit))
    items = [TLREFRateResponse.model_validate(r) for r in result.scalars().all()]

    return TLREFRateListResponse(items=items, total=total)


@router.get("/stats")
async def get_tlref_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """TLREF endeks istatistikleri: son deger, gunluk oran, yillik oran, min/max."""
    latest = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
    )
    latest_rate = latest.scalar_one_or_none()

    total = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0

    first = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.asc()).limit(1)
    )
    first_rate = first.scalar_one_or_none()

    if not latest_rate:
        return {"total_records": 0}

    cumulative_return = None
    if first_rate and first_rate.index_value > 0:
        cumulative_return = float(
            (latest_rate.index_value - first_rate.index_value) / first_rate.index_value * 100
        )

    annualized_rate = None
    if first_rate and first_rate.index_value > 0:
        days = (latest_rate.rate_date - first_rate.rate_date).days
        if days > 0:
            ratio = float(latest_rate.index_value / first_rate.index_value)
            annualized_rate = round((ratio ** (365.0 / days) - 1) * 100, 4)

    return {
        "total_records": total,
        "latest_date": latest_rate.rate_date.isoformat(),
        "latest_index": float(latest_rate.index_value),
        "latest_daily_rate": float(latest_rate.daily_rate * 100) if latest_rate.daily_rate else None,
        "first_date": first_rate.rate_date.isoformat() if first_rate else None,
        "first_index": float(first_rate.index_value) if first_rate else None,
        "cumulative_return_pct": cumulative_return,
        "annualized_rate_pct": annualized_rate,
    }


@router.post("/sync-now")
async def sync_tlref_now(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: BIST'ten TLREF endeks verilerini indir ve DB'ye yaz.
    1. Tarihsel ZIP indir + parse
    2. Gunluk CSV indir + parse
    3. Gunluk oranlari hesapla (ardisik endeks degerlerinden)
    """
    fetcher = TLREFFetcher(db)
    historical = await fetcher.fetch_historical()
    daily = await fetcher.fetch_daily()

    return {
        "historical": historical,
        "daily": daily,
    }
