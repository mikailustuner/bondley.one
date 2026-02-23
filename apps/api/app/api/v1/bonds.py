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
from app.models.user_favorite_bond import UserFavoriteBond
from app.schemas.bond import (
    BondResponse,
    BondListResponse,
    BondListItem,
    BondStatsResponse,
    BondDetailWithMetrics,
    BondCalculatedMetrics,
    BondScenarioResponse,
    FavoriteListResponse,
    AddFavoriteRequest,
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
    order_by: str | None = Query(
        "maturity_date_asc",
        description="maturity_date_asc | days_to_maturity_asc | last_issue_yield_desc",
    ),
    max_days_to_maturity: int | None = Query(None, description="Maksimum vadeye kalan gun (dahil)"),
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

    if max_days_to_maturity is not None:
        query = query.where(
            Bond.days_to_maturity.isnot(None),
            Bond.days_to_maturity <= max_days_to_maturity,
        )
        count_query = count_query.where(
            Bond.days_to_maturity.isnot(None),
            Bond.days_to_maturity <= max_days_to_maturity,
        )

    if order_by == "days_to_maturity_asc":
        order_clause = Bond.days_to_maturity.asc().nullslast()
    elif order_by == "last_issue_yield_desc":
        order_clause = Bond.last_issue_yield.desc().nullslast()
    elif order_by == "updated_at_desc":
        order_clause = Bond.updated_at.desc().nullslast()
    else:
        order_clause = Bond.maturity_date.asc().nullslast()

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(order_clause).offset(skip).limit(limit)
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

    base = Bond.is_active == True
    short = (
        await db.execute(
            select(func.count(Bond.id)).where(
                base, Bond.days_to_maturity.isnot(None), Bond.days_to_maturity < 365
            )
        )
    ).scalar() or 0
    medium = (
        await db.execute(
            select(func.count(Bond.id)).where(
                base,
                Bond.days_to_maturity.isnot(None),
                Bond.days_to_maturity >= 365,
                Bond.days_to_maturity <= 1825,
            )
        )
    ).scalar() or 0
    long_count = (
        await db.execute(
            select(func.count(Bond.id)).where(
                base, Bond.days_to_maturity.isnot(None), Bond.days_to_maturity > 1825
            )
        )
    ).scalar() or 0
    by_maturity_bucket = {"short": short, "medium": medium, "long": long_count}

    return BondStatsResponse(
        total_bonds=total,
        by_security_type=by_security_type,
        by_currency=by_currency,
        by_yield_type=by_yield_type,
        avg_days_to_maturity=round(float(avg_dtm), 1) if avg_dtm else None,
        by_maturity_bucket=by_maturity_bucket,
    )


@router.get("/favorites", response_model=FavoriteListResponse)
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının favori tahvil listesi (BondListItem[])."""
    q = (
        select(Bond)
        .join(UserFavoriteBond, UserFavoriteBond.bond_id == Bond.id)
        .where(UserFavoriteBond.user_id == user.id)
        .order_by(Bond.maturity_date.asc().nullslast())
    )
    result = await db.execute(q)
    bonds = result.unique().scalars().all()
    return FavoriteListResponse(items=[BondListItem.model_validate(b) for b in bonds])


@router.post("/favorites", status_code=status.HTTP_200_OK)
async def add_favorite(
    body: AddFavoriteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Favorilere tahvil ekler. Zaten ekliyse 200 döner."""
    result = await db.execute(select(Bond).where(Bond.isin_code == body.isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")
    existing = await db.execute(
        select(UserFavoriteBond).where(
            UserFavoriteBond.user_id == user.id,
            UserFavoriteBond.bond_id == bond.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return {"status": "already_favorite"}
    fav = UserFavoriteBond(user_id=user.id, bond_id=bond.id)
    db.add(fav)
    await db.commit()
    return {"status": "added"}


@router.delete("/favorites/{isin_code}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    isin_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Favorilerden tahvil çıkarır."""
    result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")
    del_result = await db.execute(
        select(UserFavoriteBond).where(
            UserFavoriteBond.user_id == user.id,
            UserFavoriteBond.bond_id == bond.id,
        )
    )
    fav = del_result.scalar_one_or_none()
    if fav is not None:
        await db.delete(fav)
        await db.commit()


@router.get("/{isin_code}/scenario", response_model=BondScenarioResponse)
async def get_bond_scenario(
    isin_code: str,
    settlement_date: date | None = Query(None, description="Hesaplama tarihi (varsayilan: bugun)"),
    tlref_shock_bp: int = Query(0, description="TLREF baz puan sok (ornegin 50, -50)"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """TLREF sok senaryosu: belirtilen bp kadar kaymada tahmini yeni YTM ve kirli fiyat."""
    result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")
    calc_date = settlement_date or date.today()
    metrics_svc = BondMetricsService(db)
    metrics = await metrics_svc.compute_metrics(bond, calc_date)
    if metrics is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{calc_date} tarihi icin piyasa verisi yok",
        )
    current_ytm = metrics.get("yield_to_maturity")
    current_dirty = metrics.get("dirty_price")
    mod_dur = metrics.get("modified_duration")
    if current_ytm is None or current_dirty is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="YTM veya kirli fiyat hesaplanamadi",
        )
    # Paralel kayma: new_ytm = current_ytm + (shock_bp / 10000)
    shock_decimal = tlref_shock_bp / 10000.0
    new_ytm_approx = current_ytm + shock_decimal
    # Duration yaklasimi: delta_price_pct ≈ -modified_duration * shock_decimal
    if mod_dur is not None and mod_dur != 0:
        delta_price_pct = -mod_dur * shock_decimal
    else:
        delta_price_pct = 0.0
    new_dirty_price_approx = current_dirty * (1.0 + delta_price_pct)
    price_change_pct = (new_dirty_price_approx - current_dirty) / current_dirty * 100.0
    return BondScenarioResponse(
        current_ytm=current_ytm,
        current_dirty_price=current_dirty,
        shock_bp=tlref_shock_bp,
        new_ytm_approx=new_ytm_approx,
        new_dirty_price_approx=new_dirty_price_approx,
        price_change_pct=price_change_pct,
        modified_duration=mod_dur,
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
            return_to_date_pct=None,
            return_to_date_used_fallback_price=False,
        )
        # Bugüne kadar getiri: DB'de saklanmaz, anlık hesapla ve ekle
        rtd_pct, rtd_fallback = metrics_svc.compute_return_to_date_only(
            bond, calc_date, clean_price_used
        )
        if rtd_pct is not None:
            base.calculated_metrics.return_to_date_pct = rtd_pct
            base.calculated_metrics.return_to_date_used_fallback_price = rtd_fallback
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
    # Favori mi?
    fav_check = await db.execute(
        select(UserFavoriteBond).where(
            UserFavoriteBond.user_id == user.id,
            UserFavoriteBond.bond_id == bond_id,
        )
    )
    base.is_favorite = fav_check.scalar_one_or_none() is not None
    return base


@router.post("/sync", tags=["Admin"])
async def sync_bonds(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: BIST tbliste.zip indir, XLS parse et, tahvilleri guncelle."""
    fetcher = BondFetcher(db)
    return await fetcher.fetch_and_sync()
