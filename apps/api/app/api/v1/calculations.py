from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.calculation import Calculation
from app.models.user import User
from app.schemas.calculation import CalculationResponse, CalculationRequest
from app.services.market_data_service import MarketDataService
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/{isin_code}", response_model=list[CalculationResponse])
async def get_calculations(
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

    query = select(Calculation).where(Calculation.bond_id == bond.id)

    if start_date:
        query = query.where(Calculation.calc_date >= start_date)
    if end_date:
        query = query.where(Calculation.calc_date <= end_date)

    query = query.order_by(Calculation.calc_date.desc()).limit(limit)
    result = await db.execute(query)
    return [CalculationResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/run", response_model=dict)
async def trigger_calculation(
    request: CalculationRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    bond_result = await db.execute(select(Bond).where(Bond.id == request.bond_id))
    bond = bond_result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

    service = MarketDataService(db)
    calc_date = request.calc_date or date.today()

    from sqlalchemy import select as sa_select
    from app.models.market_data import MarketData

    md_result = await db.execute(
        sa_select(MarketData)
        .where(MarketData.bond_id == bond.id)
        .order_by(MarketData.trade_date.desc())
        .limit(1)
    )
    market_data = md_result.scalar_one_or_none()
    if not market_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No market data available for this bond",
        )

    result = await service.run_calculations_for_bond(bond, calc_date, market_data.clean_price)
    return result


@router.post("/run-all", response_model=dict)
async def trigger_all_calculations(
    calc_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    service = MarketDataService(db)
    results = await service.run_daily_calculations(calc_date)
    return {"calculated": len(results), "date": str(calc_date or date.today())}
