from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.metrics_service import MetricsService

router = APIRouter()


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
