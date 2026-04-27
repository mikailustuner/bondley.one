from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import date, timedelta
import asyncio
import json
import logging

from app.core.database import get_db, async_session_factory

logger = logging.getLogger(__name__)
from app.models.bond import Bond
from app.models.calculation import Calculation
from app.models.market_data import MarketData
from app.models.user import User
from app.models.user_favorite_bond import UserFavoriteBond
from app.models.bond_user_note import BondUserNote
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
    YieldCurveResponse,
    YieldCurvePoint,
    BondNoteResponse,
    BondNoteUpsert,
)
from app.api.deps import get_current_user, get_admin_user
from app.core.cache import cache_get, cache_set
from app.services.bond_fetcher import BondFetcher
from app.services.bond_metrics_service import BondMetricsService
from app.services.metrics_service import MetricsService

router = APIRouter()


@router.get("/", response_model=BondListResponse)
async def list_bonds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=3000),
    active_only: bool = Query(True),
    with_data_only: bool = Query(True, description="Sadece güncel verisi olanları getir"),
    search: str | None = Query(None, description="ISIN veya ihracciyla ara"),
    fund_user: str | None = Query(None, description="Fon kullanicisi ile ara"),
    currency: str | None = Query(None, description="Para birimi filtresi"),
    security_type: str | None = Query(None, description="MK turu filtresi"),
    yield_type: str | None = Query(None, description="Getiri turu filtresi"),
    order_by: str | None = Query(
        "maturity_date_asc",
        description="maturity_date_asc | days_to_maturity_asc | last_issue_yield_desc | spread_desc",
    ),
    max_days_to_maturity: int | None = Query(None, description="Maksimum vadeye kalan gun (dahil)"),
    min_spread: float | None = Query(None, description="Minimum spread filtresi (yuzde, ornek: 5.0)"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Filtre yoksa cache'e bak (sayfanın varsayılan yüklemesi bu patha girer)
    no_filters = not any([search, fund_user, currency, security_type, yield_type, max_days_to_maturity, min_spread])
    cache_key = (
        f"bond_list:{int(active_only)}:{int(with_data_only)}:{order_by}:{skip}:{limit}"
        if no_filters else None
    )
    if cache_key:
        cached = await cache_get(cache_key)
        if cached:
            return BondListResponse.model_validate(json.loads(cached))

    query = select(Bond)
    count_query = select(func.count(Bond.id))

    # Spread bazlı filtreleme veya sıralama varsa Calculation tablosuna join yap
    needs_calc_join = min_spread is not None or order_by == "spread_desc"
    
    if needs_calc_join:
        # En son hesaplama tarihlerini bul
        latest_calc_sub = (
            select(Calculation.bond_id, func.max(Calculation.calc_date).label("max_date"))
            .group_by(Calculation.bond_id)
            .subquery()
        )
        # 1. Alt sorguyu Bond ile birleştir (anon_1 hatasını çözer)
        query = query.outerjoin(
            latest_calc_sub, Bond.id == latest_calc_sub.c.bond_id
        )
        # 2. Calculation tablosunu hem bond_id hem de en son tarih üzerinden birleştir
        query = query.outerjoin(
            Calculation,
            (Bond.id == Calculation.bond_id) & 
            (Calculation.calc_date == latest_calc_sub.c.max_date)
        )
        
        if min_spread is not None:
            count_query = count_query.outerjoin(
                latest_calc_sub, Bond.id == latest_calc_sub.c.bond_id
            ).outerjoin(
                Calculation,
                (Bond.id == Calculation.bond_id) & 
                (Calculation.calc_date == latest_calc_sub.c.max_date)
            )

    if active_only:
        active_filter = (
            Bond.is_active == True,
            Bond.maturity_date >= date.today(),
        )
        query = query.where(*active_filter)
        count_query = count_query.where(*active_filter)

    if with_data_only:
        query = query.where(Bond.has_data == True)
        count_query = count_query.where(Bond.has_data == True)

    if fund_user:
        pattern = f"%{fund_user}%"
        query = query.where(Bond.fund_user.ilike(pattern))
        count_query = count_query.where(Bond.fund_user.ilike(pattern))

    if search:
        pattern = f"%{search}%"
        search_filter = or_(
            Bond.isin_code.ilike(pattern),
            Bond.issuer.ilike(pattern),
            Bond.fund_user.ilike(pattern),
            Bond.source_institution.ilike(pattern),
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

    if min_spread is not None:
        # Calculation tablosundaki spread ondalık (0.05 = %5) olabilir, 
        # frontend'den gelen min_spread ise yüzde (5.0) formatındadır.
        # Hem Bond.spread (statik) hem de Calculation.spread (dinamik) kontrol edilebilir.
        # Öncelik dinamik hesaplanmış spread'de.
        query = query.where(
            or_(
                (Bond.spread >= min_spread),
                (Calculation.spread >= min_spread / 100)
            )
        )
        count_query = count_query.where(
            or_(
                (Bond.spread >= min_spread),
                (Calculation.spread >= min_spread / 100)
            )
        )

    if order_by == "days_to_maturity_asc":
        order_clause = Bond.days_to_maturity.asc().nullslast()
    elif order_by == "last_issue_yield_desc":
        order_clause = Bond.last_issue_yield.desc().nullslast()
    elif order_by == "updated_at_desc":
        order_clause = Bond.updated_at.desc().nullslast()
    elif order_by == "spread_desc":
        # Sıralamada da dinamik spread'i kullan (varsa hesaplanmış spread, yoksa statik spread)
        order_clause = func.coalesce(Calculation.spread * 100, Bond.spread).desc().nullslast()
    else:
        order_clause = Bond.maturity_date.asc().nullslast()

    total = (await db.execute(count_query)).scalar() or 0
    
    if needs_calc_join:
        # Tuple olarak (Bond, Calculation) döner
        result = await db.execute(
            query.order_by(order_clause).offset(skip).limit(limit)
        )
        rows = result.all()
        items = []
        for row in rows:
            bond_obj = row[0]
            calc_obj = row[1]
            item = BondListItem.model_validate(bond_obj)
            # Eğer statik spread yoksa, hesaplanmış spread'i kullan (% formatına çevirerek)
            if (item.spread is None or item.spread == 0) and calc_obj and calc_obj.spread is not None:
                item.spread = calc_obj.spread * 100
            items.append(item)
    else:
        result = await db.execute(
            query.order_by(order_clause).offset(skip).limit(limit)
        )
        bonds = result.scalars().all()
        items = [BondListItem.model_validate(b) for b in bonds]

    response = BondListResponse(
        items=items,
        total=total,
    )
    if cache_key:
        await cache_set(cache_key, json.dumps(response.model_dump(mode="json")), 300)
    return response


@router.get("/stats", response_model=BondStatsResponse)
async def get_bond_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cached = await cache_get("bond_stats")
    if cached:
        return BondStatsResponse.model_validate(json.loads(cached))

    active_filter = (
        Bond.is_active == True,
        Bond.maturity_date >= date.today(),
    )

    total = (
        await db.execute(select(func.count(Bond.id)).where(*active_filter))
    ).scalar() or 0

    sec_rows = await db.execute(
        select(Bond.security_type, func.count(Bond.id))
        .where(*active_filter, Bond.security_type.isnot(None))
        .group_by(Bond.security_type)
    )
    by_security_type = {row[0]: row[1] for row in sec_rows.all()}

    cur_rows = await db.execute(
        select(Bond.currency, func.count(Bond.id))
        .where(*active_filter)
        .group_by(Bond.currency)
    )
    by_currency = {row[0]: row[1] for row in cur_rows.all()}

    yt_rows = await db.execute(
        select(Bond.yield_type, func.count(Bond.id))
        .where(*active_filter, Bond.yield_type.isnot(None))
        .group_by(Bond.yield_type)
    )
    by_yield_type = {row[0]: row[1] for row in yt_rows.all()}

    avg_dtm = (
        await db.execute(
            select(func.avg(Bond.days_to_maturity))
            .where(*active_filter, Bond.days_to_maturity.isnot(None))
        )
    ).scalar()

    short = (
        await db.execute(
            select(func.count(Bond.id)).where(
                *active_filter, Bond.days_to_maturity.isnot(None), Bond.days_to_maturity < 365
            )
        )
    ).scalar() or 0
    medium = (
        await db.execute(
            select(func.count(Bond.id)).where(
                *active_filter,
                Bond.days_to_maturity.isnot(None),
                Bond.days_to_maturity >= 365,
                Bond.days_to_maturity <= 1825,
            )
        )
    ).scalar() or 0
    long_count = (
        await db.execute(
            select(func.count(Bond.id)).where(
                *active_filter, Bond.days_to_maturity.isnot(None), Bond.days_to_maturity > 1825
            )
        )
    ).scalar() or 0
    by_maturity_bucket = {"short": short, "medium": medium, "long": long_count}

    response = BondStatsResponse(
        total_bonds=total,
        by_security_type=by_security_type,
        by_currency=by_currency,
        by_yield_type=by_yield_type,
        avg_days_to_maturity=round(float(avg_dtm), 1) if avg_dtm else None,
        by_maturity_bucket=by_maturity_bucket,
    )
    await cache_set("bond_stats", json.dumps(response.model_dump(mode="json")), 300)
    return response


@router.get("/favorites", response_model=FavoriteListResponse)
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının favori tahvil listesi (BondListItem[])."""
    q = (
        select(Bond)
        .join(UserFavoriteBond, UserFavoriteBond.bond_id == Bond.id)
        .where(
            UserFavoriteBond.user_id == user.id, 
            Bond.is_active == True,
            Bond.maturity_date >= date.today(),
        )
        .order_by(Bond.maturity_date.asc().nullslast())
    )
    result = await db.execute(q)
    bonds = result.unique().scalars().all()
    return FavoriteListResponse(items=[BondListItem.model_validate(b) for b in bonds])


@router.get("/favorites/archived", response_model=FavoriteListResponse)
async def list_favorites_archived(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının favorilerindeki süresi dolmuş / dolaşımdan çıkmış tahviller."""
    q = (
        select(Bond)
        .join(UserFavoriteBond, UserFavoriteBond.bond_id == Bond.id)
        .where(
            UserFavoriteBond.user_id == user.id,
            or_(Bond.is_active == False, Bond.maturity_date < date.today()),
        )
        .order_by(Bond.maturity_date.desc().nullslast())
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


@router.get("/yield-curve", response_model=YieldCurveResponse)
async def get_yield_curve(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Tüm aktif tahvillerin son hesaplanan YTM vs vadeye kalan gün verisi (scatter plot için)."""
    cached = await cache_get("bond_yield_curve")
    if cached:
        return YieldCurveResponse.model_validate(json.loads(cached))

    latest_calc = (
        select(Calculation.bond_id, func.max(Calculation.calc_date).label("max_date"))
        .group_by(Calculation.bond_id)
        .subquery()
    )

    stmt = (
        select(
            Bond.isin_code,
            Bond.issuer,
            Bond.days_to_maturity,
            Bond.yield_type,
            Bond.security_type,
            Calculation.yield_to_maturity,
        )
        .join(latest_calc, latest_calc.c.bond_id == Bond.id)
        .join(
            Calculation,
            (Calculation.bond_id == Bond.id) & (Calculation.calc_date == latest_calc.c.max_date),
        )
        .where(
            Bond.is_active == True,
            Bond.has_data == True,
            Bond.maturity_date >= date.today(),
            Bond.days_to_maturity.isnot(None),
            Calculation.yield_to_maturity.isnot(None),
        )
        .order_by(Bond.days_to_maturity.asc())
    )

    rows = (await db.execute(stmt)).all()
    items = [
        YieldCurvePoint(
            isin_code=row.isin_code,
            issuer=row.issuer,
            days_to_maturity=row.days_to_maturity,
            ytm_pct=round(float(row.yield_to_maturity) * 100, 4),
            yield_type=row.yield_type,
            security_type=row.security_type,
        )
        for row in rows
    ]
    response = YieldCurveResponse(items=items)
    await cache_set("bond_yield_curve", json.dumps(response.model_dump(mode="json")), 300)
    return response


@router.get("/{isin_code}/history")
async def get_bond_history(
    isin_code: str,
    days: int = Query(90, ge=7, le=365, description="Kac gunluk gecmis"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Son N gunun temiz fiyat ve YTM verisi (grafik icin)."""
    bond_result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = bond_result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")

    cutoff = date.today() - timedelta(days=days)

    md_rows = await db.execute(
        select(MarketData.trade_date, MarketData.clean_price)
        .where(MarketData.bond_id == bond.id, MarketData.trade_date >= cutoff, MarketData.clean_price.isnot(None))
        .order_by(MarketData.trade_date.asc())
    )
    prices = {row[0]: float(row[1]) for row in md_rows.all()}

    calc_rows = await db.execute(
        select(Calculation.calc_date, Calculation.yield_to_maturity)
        .where(Calculation.bond_id == bond.id, Calculation.calc_date >= cutoff)
        .order_by(Calculation.calc_date.asc())
    )
    ytms = {row[0]: float(row[1]) for row in calc_rows.all()}

    all_dates = sorted(set(prices.keys()) | set(ytms.keys()))
    items = [
        {
            "date": d.isoformat(),
            "clean_price": prices.get(d),
            "ytm": ytms.get(d),
        }
        for d in all_dates
    ]
    return {"items": items}


@router.get("/{isin_code}/scenario", response_model=BondScenarioResponse)
async def get_bond_scenario(
    isin_code: str,
    settlement_date: date | None = Query(None, description="Hesaplama tarihi (varsayilan: bugun)"),
    tlref_shock_bp: int = Query(0, description="TLREF baz puan sok (ornegin 50, -50)"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """TLREF sok senaryosu: belirtilen bp kadar kaymada tahmini yeni YTM ve kirli fiyat."""
    result = await db.execute(select(Bond).where(
        Bond.isin_code == isin_code, Bond.is_active == True,
        or_(Bond.maturity_date.is_(None), Bond.maturity_date >= date.today()),
    ))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tahvil bulunamadi")
    calc_date = settlement_date or date.today()
    # Hafta sonu ise Cuma gününe (getiri hesaplamalari icin) geri çek
    if calc_date.weekday() == 5:  # Cumartesi
        calc_date -= timedelta(days=1)
    elif calc_date.weekday() == 6:  # Pazar
        calc_date -= timedelta(days=2)
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

    # Track scenario run
    try:
        await MetricsService.increment_calculation_run(db=db, user_id=_user.id)
        await db.commit()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass

    return BondScenarioResponse(
        current_ytm=current_ytm,
        current_dirty_price=current_dirty,
        shock_bp=tlref_shock_bp,
        new_ytm_approx=new_ytm_approx,
        new_dirty_price_approx=new_dirty_price_approx,
        price_change_pct=price_change_pct,
        modified_duration=mod_dur,
    )


# ── Parallel helpers for get_bond ────────────────────────────────────────────

async def _track_view_bg(
    bond_id: int, user_id: int, ip: str | None, ua: str | None, calc_date: date
) -> None:
    """Fire-and-forget view tracking — kendi session'ini acip kapatir."""
    try:
        async with async_session_factory() as s:
            await MetricsService.track_bond_view(
                db=s, bond_id=bond_id, user_id=user_id,
                ip_address=ip, user_agent=ua, settlement_date=calc_date,
            )
            await s.commit()
    except Exception:
        pass


async def _compute_metrics_parallel(bond: Bond, calc_date: date, isin_code: str) -> dict | None:
    metrics_cache_key = f"bond_metrics:{isin_code}:{calc_date.isoformat()}"
    try:
        cached = await cache_get(metrics_cache_key)
        if cached is not None:
            return json.loads(cached)
        async with async_session_factory() as s:
            result = await BondMetricsService(s).compute_metrics(bond, calc_date)
        if result is not None:
            await cache_set(metrics_cache_key, json.dumps(result), 300)
        return result
    except Exception as e:
        logger.warning(f"Metrics parallel failed for {isin_code}: {e}")
        return None


async def _check_favorite_parallel(user_id: int, bond_id: int) -> bool:
    try:
        async with async_session_factory() as s:
            r = await s.execute(
                select(UserFavoriteBond).where(
                    UserFavoriteBond.user_id == user_id,
                    UserFavoriteBond.bond_id == bond_id,
                )
            )
            return r.scalar_one_or_none() is not None
    except Exception:
        return False


async def _get_kap_parallel(
    isin_code: str, bond: Bond
) -> tuple[dict | None, list, dict]:
    try:
        from app.services.kap_data_resolver import (
            get_kap_data_for_isin,
            get_all_kap_disclosures_for_isin,
            resolve_data_conflicts,
        )
        async with async_session_factory() as s:
            kap_data = await get_kap_data_for_isin(s, isin_code)
            if not kap_data:
                return None, [], {}
            disclosures = await get_all_kap_disclosures_for_isin(s, isin_code)
            # kap_data geçildiği için çift fetch yapılmaz
            conflict_result = await resolve_data_conflicts(s, bond, kap_data=kap_data)
        return kap_data, disclosures, conflict_result
    except Exception as e:
        logger.warning(f"KAP parallel failed for {isin_code}: {e}")
        return None, [], {}


# ─────────────────────────────────────────────────────────────────────────────

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

    bond_id = bond.id
    user_id = user.id

    base = BondDetailWithMetrics.model_validate(bond)
    calc_date = settlement_date or date.today()
    if calc_date.weekday() == 5:
        calc_date -= timedelta(days=1)
    elif calc_date.weekday() == 6:
        calc_date -= timedelta(days=2)

    # View tracking — arka planda, ana isteği bloklamaz
    client_host = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    task = asyncio.create_task(_track_view_bg(bond_id, user_id, client_host, user_agent, calc_date))
    task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)

    # Metrik, favori ve KAP verisini paralel çek (her biri kendi session'ını açar)
    metrics, is_fav, (kap_data, kap_disclosures, conflict_result) = await asyncio.gather(
        _compute_metrics_parallel(bond, calc_date, isin_code),
        _check_favorite_parallel(user_id, bond_id),
        _get_kap_parallel(isin_code, bond),
    )

    base.calculated_metrics = BondCalculatedMetrics(**metrics) if metrics else None
    base.is_favorite = is_fav

    if kap_data:
        base.kap_data = kap_data
        base.kap_disclosures = kap_disclosures
        base.data_conflicts = conflict_result.get("conflicts")
        base.data_sources = conflict_result.get("data_sources")
    else:
        base.data_sources = [{
            "source": "tbliste",
            "label": "BIST tbliste.zip",
            "updated_at": bond.updated_at.isoformat() if bond.updated_at else None,
        }]

    return base


@router.get("/{isin_code}/note", response_model=BondNoteResponse)
async def get_bond_note(
    isin_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının belirli tahvil için kişisel notunu getirir."""
    result = await db.execute(
        select(BondUserNote).where(
            BondUserNote.user_id == user.id,
            BondUserNote.isin_code == isin_code,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not bulunamadı")
    return BondNoteResponse(
        isin_code=note.isin_code,
        note_text=note.note_text,
        updated_at=note.updated_at,
    )


@router.put("/{isin_code}/note", response_model=BondNoteResponse)
async def upsert_bond_note(
    isin_code: str,
    body: BondNoteUpsert,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının tahvil notunu oluşturur veya günceller (upsert)."""
    result = await db.execute(
        select(BondUserNote).where(
            BondUserNote.user_id == user.id,
            BondUserNote.isin_code == isin_code,
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        note = BondUserNote(user_id=user.id, isin_code=isin_code, note_text=body.note_text)
        db.add(note)
    else:
        note.note_text = body.note_text
    await db.commit()
    await db.refresh(note)
    return BondNoteResponse(
        isin_code=note.isin_code,
        note_text=note.note_text,
        updated_at=note.updated_at,
    )


@router.delete("/{isin_code}/note", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bond_note(
    isin_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının tahvil notunu siler."""
    result = await db.execute(
        select(BondUserNote).where(
            BondUserNote.user_id == user.id,
            BondUserNote.isin_code == isin_code,
        )
    )
    note = result.scalar_one_or_none()
    if note is not None:
        await db.delete(note)
        await db.commit()


@router.post("/sync", tags=["Admin"])
async def sync_bonds(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: BIST tbliste.zip indir, XLS parse et, tahvilleri guncelle."""
    fetcher = BondFetcher(db)
    return await fetcher.fetch_and_sync()
