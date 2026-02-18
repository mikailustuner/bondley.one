from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tlref_rate import TLREFRate
from app.models.user import User
from app.schemas.tlref import TLREFRateResponse, TLREFRateListResponse
from app.services.tlref_fetcher import TLREFFetcher
from app.api.deps import get_current_user, get_admin_user

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


@router.post("/fetch-daily", response_model=dict)
async def trigger_daily_fetch(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    fetcher = TLREFFetcher(db)
    return await fetcher.fetch_daily()


@router.post("/fetch-historical", response_model=dict)
async def trigger_historical_fetch(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    fetcher = TLREFFetcher(db)
    return await fetcher.fetch_historical()
