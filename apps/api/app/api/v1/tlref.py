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
from app.services.market_data_service import MarketDataService
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


@router.post("/fetch-daily", status_code=status.HTTP_403_FORBIDDEN)
async def trigger_daily_fetch(
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="TLREF verisi sadece zamanlanmis (Celery/cron) gorevlerle guncellenir.",
    )


@router.post("/fetch-historical", status_code=status.HTTP_403_FORBIDDEN)
async def trigger_historical_fetch(
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="TLREF verisi sadece zamanlanmis (Celery/cron) gorevlerle guncellenir.",
    )


@router.post("/sync-now")
async def sync_tlref_now(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Tek butonla tam pipeline:
    1. BIST'ten tarihsel + gunluk CSV/ZIP indir
    2. TLREF oranlarini DB'ye yaz
    3. Tahvil ISIN'lerini kesfet, Bond kayitlari olustur
    4. Piyasa verilerini MarketData'ya yaz
    5. Tum aktif tahviller icin hesaplamalari calistir (dirty price, YTM, spread, duration)
    """
    fetcher = TLREFFetcher(db)

    # Adim 1-4: Indir + parse + DB'ye yaz
    historical = await fetcher.fetch_historical()
    daily = await fetcher.fetch_daily()

    # Adim 5: Hesaplamalari calistir
    calc_result = {"calculated": 0, "errors": 0}
    try:
        service = MarketDataService(db)
        results = await service.run_daily_calculations()
        calc_result["calculated"] = len(results)
        logger.info(f"Calculations completed for {len(results)} bonds")
    except Exception as e:
        logger.error(f"Calculation step failed: {e}")
        calc_result["error"] = str(e)

    return {
        "historical": historical,
        "daily": daily,
        "calculations": calc_result,
    }
