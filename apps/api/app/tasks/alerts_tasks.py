"""
Celery task to evaluate user alerts (YTM, TLREF, days to maturity).
Runs periodically; when condition is met, sets last_triggered_at and snapshot.
"""

import asyncio
import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.tasks.celery_app import celery_app
from app.core.config import get_settings
from app.models.user_alert import UserAlert
from app.models.bond import Bond
from app.services.bond_metrics_service import BondMetricsService

logger = logging.getLogger(__name__)
settings = get_settings()


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _evaluate_alerts(db: AsyncSession, today: date):
    result = await db.execute(
        select(UserAlert).where(UserAlert.is_active == True)
    )
    alerts = list(result.scalars().all())
    metrics_svc = BondMetricsService(db)
    triggered_count = 0

    for alert in alerts:
        try:
            triggered = False
            snapshot = {}

            if alert.type in ("ytm_above", "ytm_below"):
                isin = (alert.parameters or {}).get("isin")
                threshold = (alert.parameters or {}).get("threshold")
                if not isin or threshold is None:
                    continue
                bond_result = await db.execute(select(Bond).where(Bond.isin_code == isin))
                bond = bond_result.scalar_one_or_none()
                if not bond:
                    continue
                metrics = await metrics_svc.compute_metrics(bond, today)
                if metrics is None:
                    continue
                ytm = metrics.get("yield_to_maturity")
                if ytm is None:
                    continue
                th = float(threshold)
                if alert.type == "ytm_above" and ytm >= th:
                    triggered = True
                    snapshot = {"ytm": ytm, "threshold": th}
                elif alert.type == "ytm_below" and ytm <= th:
                    triggered = True
                    snapshot = {"ytm": ytm, "threshold": th}

            elif alert.type in ("tlref_daily_above", "tlref_daily_below"):
                threshold = (alert.parameters or {}).get("threshold")
                if threshold is None:
                    continue
                daily_rate = await metrics_svc.get_latest_daily_rate()
                if daily_rate is None:
                    continue
                rate_pct = float(daily_rate * 100)
                th = float(threshold)
                if alert.type == "tlref_daily_above" and rate_pct >= th:
                    triggered = True
                    snapshot = {"daily_rate_pct": rate_pct, "threshold": th}
                elif alert.type == "tlref_daily_below" and rate_pct <= th:
                    triggered = True
                    snapshot = {"daily_rate_pct": rate_pct, "threshold": th}

            elif alert.type == "days_to_maturity":
                isin = (alert.parameters or {}).get("isin")
                days_param = (alert.parameters or {}).get("days")
                if not isin or days_param is None:
                    continue
                bond_result = await db.execute(select(Bond).where(Bond.isin_code == isin))
                bond = bond_result.scalar_one_or_none()
                if not bond or bond.days_to_maturity is None:
                    continue
                d = int(bond.days_to_maturity)
                if d <= int(days_param):
                    triggered = True
                    snapshot = {"days_to_maturity": d, "days_threshold": int(days_param)}

            if triggered:
                alert.last_triggered_at = datetime.now(timezone.utc)
                alert.triggered_value_snapshot = snapshot
                triggered_count += 1
        except Exception as e:
            logger.warning("Alert %s evaluation failed: %s", alert.id, e)

    await db.commit()
    return triggered_count


@celery_app.task(name="app.tasks.alerts_tasks.check_user_alerts")
def check_user_alerts():
    """Evaluate all active user alerts and set last_triggered_at when condition is met."""
    logger.info("Task: Checking user alerts...")

    async def _run():
        engine = create_async_engine(settings.DATABASE_URL)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as db:
            today = date.today()
            count = await _evaluate_alerts(db, today)
            logger.info("User alerts: %s triggered", count)
            return count

    return _run_async(_run())
