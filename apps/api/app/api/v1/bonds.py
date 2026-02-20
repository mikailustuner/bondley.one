from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import date
import logging

from app.core.database import get_db

logger = logging.getLogger(__name__)
from app.models.bond import Bond
from app.models.calculation import Calculation
from app.models.market_data import MarketData
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
from app.services.metrics_service import MetricsService

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
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")

    # Get bond.id immediately to avoid lazy loading issues
    bond_id = bond.id
    
    base = BondDetailWithMetrics.model_validate(bond)
    calc_date = settlement_date or date.today()

    # Track bond view
    client_host = None
    user_agent = None
    if request:
        client_host = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    try:
        await MetricsService.track_bond_view(
            db=db,
            bond_id=bond_id,
            user_id=user.id,
            ip_address=client_host,
            user_agent=user_agent,
            settlement_date=calc_date,
        )
    except Exception:
        # Don't fail the request if tracking fails
        # Rollback any partial transaction to avoid "transaction aborted" errors
        try:
            await db.rollback()
        except Exception:
            pass

    # Once DB'de (calculations) kayit var mi kontrol et; varsa oradan doldur.
    calc_result = await db.execute(
        select(Calculation).where(
            Calculation.bond_id == bond_id,
            Calculation.calc_date == calc_date,
        )
    )
    stored_calc = calc_result.scalar_one_or_none()
    if stored_calc is not None:
        md_result = await db.execute(
            select(MarketData.clean_price).where(
                MarketData.bond_id == bond_id,
                MarketData.trade_date == calc_date,
            )
        )
        md_row = md_result.one_or_none()
        if md_row and md_row[0] is not None:
            clean_price_used = float(md_row[0])
        else:
            clean_price_used = float(stored_calc.dirty_price - stored_calc.accrued_interest)
        # Oran degisimi (gunluk TLREF %) calculations'da saklanmaz; her zaman tlref_rates'tan alinir
        rate_change_pct = None
        metrics_svc = BondMetricsService(db)
        latest_daily = await metrics_svc.get_latest_daily_rate()
        if latest_daily is not None:
            rate_change_pct = float(latest_daily * 100)
        base.calculated_metrics = BondCalculatedMetrics(
            annual_reference_rate=None,
            annual_coupon_rate=None,
            periodic_coupon_rate=None,
            accrued_interest=float(stored_calc.accrued_interest),
            dirty_price=float(stored_calc.dirty_price),
            clean_price_used=clean_price_used,
            rate_change_today_pct=rate_change_pct,
            yield_to_maturity=float(stored_calc.yield_to_maturity),
            spread=float(stored_calc.spread) if stored_calc.spread is not None else None,
            modified_duration=float(stored_calc.modified_duration) if stored_calc.modified_duration is not None else None,
            macaulay_duration=float(stored_calc.macaulay_duration) if stored_calc.macaulay_duration is not None else None,
            convexity=None,
            coupon_payment_amount=None,
            period_days=None,
            next_coupon_date=None,
        )
    else:
        try:
            metrics_svc = BondMetricsService(db)
            metrics = await metrics_svc.compute_metrics(bond, calc_date)
            if metrics is None:
                # Belirli tarih icin veri yok - None olarak bırak (frontend'e bildirilecek)
                base.calculated_metrics = None
            else:
                base.calculated_metrics = BondCalculatedMetrics(**metrics)
        except Exception as e:
            logger.warning(f"Metrics calculation failed for {isin_code} on {calc_date}: {e}")
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
