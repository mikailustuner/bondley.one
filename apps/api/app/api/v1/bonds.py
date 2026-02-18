from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import date

from app.core.database import get_db
from app.models.bond import Bond
from app.models.user import User
from app.schemas.bond import (
    BondResponse,
    BondListResponse,
    BondListItem,
    BondStatsResponse,
    BondDetailWithMetrics,
    BondCalculatedMetrics,
)
from app.api.deps import get_current_user, get_admin_user
from app.services.bond_fetcher import BondFetcher
from app.services.bond_metrics_service import BondMetricsService

router = APIRouter()


@router.get("/", response_model=BondListResponse)
async def list_bonds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=3000),
    active_only: bool = True,
    search: str | None = Query(None, description="ISIN veya ihracciyla ara"),
    currency: str | None = Query(None, description="Para birimi filtresi"),
    security_type: str | None = Query(None, description="MK turu filtresi"),
    yield_type: str | None = Query(None, description="Getiri turu filtresi"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Bond)
    count_query = select(func.count(Bond.id))

    if active_only:
        query = query.where(Bond.is_active == True)
        count_query = count_query.where(Bond.is_active == True)

    if search:
        pattern = f"%{search}%"
        search_filter = or_(
            Bond.isin_code.ilike(pattern),
            Bond.issuer.ilike(pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if currency:
        query = query.where(Bond.currency == currency)
        count_query = count_query.where(Bond.currency == currency)

    if security_type:
        query = query.where(Bond.security_type.ilike(f"%{security_type}%"))
        count_query = count_query.where(Bond.security_type.ilike(f"%{security_type}%"))

    if yield_type:
        query = query.where(Bond.yield_type.ilike(f"%{yield_type}%"))
        count_query = count_query.where(Bond.yield_type.ilike(f"%{yield_type}%"))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Bond.maturity_date.asc().nullslast()).offset(skip).limit(limit)
    )
    bonds = result.scalars().all()

    return BondListResponse(
        items=[BondListItem.model_validate(b) for b in bonds],
        total=total,
    )


@router.get("/stats", response_model=BondStatsResponse)
async def get_bond_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    total = (
        await db.execute(select(func.count(Bond.id)).where(Bond.is_active == True))
    ).scalar() or 0

    sec_rows = await db.execute(
        select(Bond.security_type, func.count(Bond.id))
        .where(Bond.is_active == True, Bond.security_type.isnot(None))
        .group_by(Bond.security_type)
    )
    by_security_type = {row[0]: row[1] for row in sec_rows.all()}

    cur_rows = await db.execute(
        select(Bond.currency, func.count(Bond.id))
        .where(Bond.is_active == True)
        .group_by(Bond.currency)
    )
    by_currency = {row[0]: row[1] for row in cur_rows.all()}

    yt_rows = await db.execute(
        select(Bond.yield_type, func.count(Bond.id))
        .where(Bond.is_active == True, Bond.yield_type.isnot(None))
        .group_by(Bond.yield_type)
    )
    by_yield_type = {row[0]: row[1] for row in yt_rows.all()}

    avg_dtm = (
        await db.execute(
            select(func.avg(Bond.days_to_maturity))
            .where(Bond.is_active == True, Bond.days_to_maturity.isnot(None))
        )
    ).scalar()

    return BondStatsResponse(
        total_bonds=total,
        by_security_type=by_security_type,
        by_currency=by_currency,
        by_yield_type=by_yield_type,
        avg_days_to_maturity=round(float(avg_dtm), 1) if avg_dtm else None,
    )


@router.get("/{isin_code}", response_model=BondDetailWithMetrics)
async def get_bond(
    isin_code: str,
    settlement_date: date | None = Query(None, description="Hesaplama tarihi (varsayilan: bugun)"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")

    base = BondDetailWithMetrics.model_validate(bond)
    calc_date = settlement_date or date.today()
    try:
        metrics_svc = BondMetricsService(db)
        metrics = await metrics_svc.compute_metrics(bond, calc_date)
        base.calculated_metrics = BondCalculatedMetrics(**metrics)
    except Exception:
        base.calculated_metrics = None
    return base


@router.post("/sync", tags=["Admin"])
async def sync_bonds(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: BIST tbliste.zip indir, XLS parse et, tahvilleri guncelle."""
    fetcher = BondFetcher(db)
    return await fetcher.fetch_and_sync()
