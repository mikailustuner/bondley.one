from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.user import User
from app.schemas.market_data import MarketDataCreate, MarketDataResponse
from app.api.deps import get_current_user, get_admin_user

router = APIRouter()


@router.get("/{isin_code}", response_model=list[MarketDataResponse])
async def get_market_data(
    isin_code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    bond_result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = bond_result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

    query = select(MarketData).where(MarketData.bond_id == bond.id)

    if start_date:
        query = query.where(MarketData.trade_date >= start_date)
    if end_date:
        query = query.where(MarketData.trade_date <= end_date)

    query = query.order_by(MarketData.trade_date.desc()).limit(limit)
    result = await db.execute(query)
    return [MarketDataResponse.model_validate(md) for md in result.scalars().all()]


@router.post("/", response_model=MarketDataResponse, status_code=status.HTTP_201_CREATED)
async def create_market_data(
    data: MarketDataCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    bond_result = await db.execute(select(Bond).where(Bond.id == data.bond_id))
    if not bond_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

    stmt = pg_insert(MarketData).values(**data.model_dump())
    stmt = stmt.on_conflict_do_update(
        index_elements=["bond_id", "trade_date"],
        set_={
            "clean_price": stmt.excluded.clean_price,
            "tlref_index": stmt.excluded.tlref_index,
            "fark": stmt.excluded.fark,
            "volume": stmt.excluded.volume,
        },
    )
    await db.execute(stmt)

    result = await db.execute(
        select(MarketData)
        .where(MarketData.bond_id == data.bond_id, MarketData.trade_date == data.trade_date)
    )
    return MarketDataResponse.model_validate(result.scalar_one())
