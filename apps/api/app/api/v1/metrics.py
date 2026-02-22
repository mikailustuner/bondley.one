from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.metrics_service import MetricsService

router = APIRouter()


def _month_start_end(d: date) -> tuple[date, date]:
    """Return (first day of month, last day of month) for date d."""
    start = d.replace(day=1)
    if d.month == 12:
        end = d.replace(day=31)
    else:
        from calendar import monthrange
        _, last_day = monthrange(d.year, d.month)
        end = d.replace(day=last_day)
    return start, end


@router.get("/summary")
async def get_my_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    start_date: date | None = Query(None, description="Donem basi (varsayilan: bu ayin 1'i)"),
    end_date: date | None = Query(None, description="Donem sonu (varsayilan: bu ayin sonu)"),
) -> dict[str, Any]:
    """Kullaniciya ozel kullanim ozeti: bu donemde kac tahvil incelendi, en cok bakilan tahviller."""
    today = date.today()
    if start_date is None or end_date is None:
        start_date, end_date = _month_start_end(today)
    return await MetricsService.get_personal_summary(
        db=db,
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
        most_viewed_limit=5,
    )


@router.get("/my-stats")
async def get_my_stats(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Kullanici kendi metriklerini goruntuler."""
    metrics = await MetricsService.get_user_metrics(
        db=db,
        user_id=user.id,
        start_date=start_date,
        end_date=end_date,
    )

    return {
        "user_id": user.id,
        "metrics": [
            {
                "date": metric.metric_date.isoformat(),
                "bonds_viewed": metric.bonds_viewed,
                "api_calls": metric.api_calls,
                "calculations_run": metric.calculations_run,
            }
            for metric in metrics
        ],
    }
