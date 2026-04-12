from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bond_view import BondView
from app.models.user_metric import UserMetric
from app.models.bond import Bond


class MetricsService:
    """Service for tracking and retrieving metrics."""

    @staticmethod
    async def track_bond_view(
        db: AsyncSession,
        bond_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        settlement_date: date | None = None,
    ) -> BondView:
        """Track a bond view. Uses unique constraint to prevent duplicate views per user per day."""
        # Try to create a new view record
        # The unique constraint on (bond_id, user_id, DATE(viewed_at)) will prevent duplicates
        bond_view = BondView(
            bond_id=bond_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            settlement_date=settlement_date,
        )
        db.add(bond_view)
        try:
            await db.flush()
        except Exception:
            # If unique constraint violation or any other error, rollback and skip tracking
            # This prevents transaction abort errors
            try:
                await db.rollback()
            except Exception:
                pass
            # Skip tracking for this request if insert fails
            # The unique constraint prevents duplicate views per day anyway
            return None

        # Update user metrics for today
        if user_id and bond_view:
            try:
                await MetricsService._update_user_metrics(db, user_id, increment_bonds_viewed=True)
            except Exception:
                # If metrics update fails, rollback and skip metrics update
                try:
                    await db.rollback()
                except Exception:
                    pass
                # Continue without metrics update rather than failing

        return bond_view

    @staticmethod
    async def _update_user_metrics(
        db: AsyncSession,
        user_id: int,
        increment_bonds_viewed: bool = False,
        increment_api_calls: bool = False,
        increment_calculations_run: bool = False,
    ) -> UserMetric:
        """Update or create user metrics for today."""
        today = date.today()
        result = await db.execute(
            select(UserMetric).where(
                and_(
                    UserMetric.user_id == user_id,
                    UserMetric.metric_date == today
                )
            )
        )
        metric = result.scalar_one_or_none()

        if metric is None:
            metric = UserMetric(
                user_id=user_id,
                metric_date=today,
                bonds_viewed=1 if increment_bonds_viewed else 0,
                api_calls=1 if increment_api_calls else 0,
                calculations_run=1 if increment_calculations_run else 0,
            )
            db.add(metric)
        else:
            if increment_bonds_viewed:
                metric.bonds_viewed += 1
            if increment_api_calls:
                metric.api_calls += 1
            if increment_calculations_run:
                metric.calculations_run += 1

        await db.flush()
        return metric

    @staticmethod
    async def increment_api_call(
        db: AsyncSession,
        user_id: int | None = None,
    ) -> None:
        """Increment API call count for a user."""
        if user_id:
            await MetricsService._update_user_metrics(db, user_id, increment_api_calls=True)

    @staticmethod
    async def increment_calculation_run(
        db: AsyncSession,
        user_id: int | None = None,
    ) -> None:
        """Increment calculation run count for a user."""
        if user_id:
            await MetricsService._update_user_metrics(db, user_id, increment_calculations_run=True)

    @staticmethod
    async def get_bond_view_stats(
        db: AsyncSession,
        limit: int = 10,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[dict[str, Any]]:
        """Get statistics about most viewed bonds."""
        query = select(
            BondView.bond_id,
            Bond.isin_code,
            Bond.issuer,
            func.count(BondView.id).label("view_count"),
            func.count(func.distinct(BondView.user_id)).label("unique_users")
        ).join(
            Bond, BondView.bond_id == Bond.id
        ).group_by(
            BondView.bond_id, Bond.isin_code, Bond.issuer
        )

        conditions = []
        if start_date:
            conditions.append(func.date(BondView.viewed_at) >= start_date)
        if end_date:
            conditions.append(func.date(BondView.viewed_at) <= end_date)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc("view_count")).limit(limit)

        result = await db.execute(query)
        stats = []
        for row in result.all():
            stats.append({
                "bond_id": row.bond_id,
                "isin_code": row.isin_code,
                "issuer": row.issuer,
                "view_count": row.view_count,
                "unique_users": row.unique_users,
            })
        return stats

    @staticmethod
    async def get_user_metrics(
        db: AsyncSession,
        user_id: int,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[UserMetric]:
        """Get user metrics for a date range."""
        query = select(UserMetric).where(UserMetric.user_id == user_id)

        if start_date:
            query = query.where(UserMetric.metric_date >= start_date)
        if end_date:
            query = query.where(UserMetric.metric_date <= end_date)

        query = query.order_by(UserMetric.metric_date.desc())

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_user_activity_stats(
        db: AsyncSession,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Get user activity statistics."""
        query = select(
            UserMetric.user_id,
            func.sum(UserMetric.bonds_viewed).label("total_bonds_viewed"),
            func.sum(UserMetric.api_calls).label("total_api_calls"),
            func.sum(UserMetric.calculations_run).label("total_calculations"),
        ).group_by(UserMetric.user_id)

        conditions = []
        if start_date:
            conditions.append(UserMetric.metric_date >= start_date)
        if end_date:
            conditions.append(UserMetric.metric_date <= end_date)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc("total_api_calls")).limit(limit)

        result = await db.execute(query)
        stats = []
        for row in result.all():
            stats.append({
                "user_id": row.user_id,
                "total_bonds_viewed": row.total_bonds_viewed or 0,
                "total_api_calls": row.total_api_calls or 0,
                "total_calculations": row.total_calculations or 0,
            })
        return stats

    @staticmethod
    async def get_personal_summary(
        db: AsyncSession,
        user_id: int,
        start_date: date,
        end_date: date,
        most_viewed_limit: int = 5,
    ) -> dict[str, Any]:
        """Get personal usage summary: distinct bonds viewed in period and top most viewed bonds."""
        # Distinct bond count for this user in date range
        distinct_query = select(func.count(func.distinct(BondView.bond_id))).where(
            and_(
                BondView.user_id == user_id,
                func.date(BondView.viewed_at) >= start_date,
                func.date(BondView.viewed_at) <= end_date,
            )
        )
        this_month_bonds_viewed = (await db.execute(distinct_query)).scalar() or 0

        # Total views in period (optional)
        total_query = select(func.count(BondView.id)).where(
            and_(
                BondView.user_id == user_id,
                func.date(BondView.viewed_at) >= start_date,
                func.date(BondView.viewed_at) <= end_date,
            )
        )
        total_views_this_month = (await db.execute(total_query)).scalar() or 0

        # Top N most viewed bonds for this user in period
        top_query = (
            select(
                BondView.bond_id,
                Bond.isin_code,
                Bond.issuer,
                func.count(BondView.id).label("view_count"),
            )
            .join(Bond, BondView.bond_id == Bond.id)
            .where(
                and_(
                    BondView.user_id == user_id,
                    func.date(BondView.viewed_at) >= start_date,
                    func.date(BondView.viewed_at) <= end_date,
                )
            )
            .group_by(BondView.bond_id, Bond.isin_code, Bond.issuer)
            .order_by(desc("view_count"))
            .limit(most_viewed_limit)
        )
        top_result = await db.execute(top_query)
        most_viewed_bonds = [
            {
                "isin_code": row.isin_code,
                "issuer": row.issuer or "",
                "view_count": row.view_count,
            }
            for row in top_result.all()
        ]

        return {
            "this_month_bonds_viewed": this_month_bonds_viewed,
            "most_viewed_bonds": most_viewed_bonds,
            "total_views_this_month": total_views_this_month,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }

    @staticmethod
    async def get_metrics_overview(
        db: AsyncSession,
        days: int = 30,
    ) -> dict[str, Any]:
        """Get overall metrics overview for the last N days."""
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        # Total bond views
        bond_views_query = select(func.count(BondView.id)).where(
            and_(
                func.date(BondView.viewed_at) >= start_date,
                func.date(BondView.viewed_at) <= end_date
            )
        )
        total_bond_views = (await db.execute(bond_views_query)).scalar() or 0

        # Unique users who viewed bonds
        unique_users_query = select(func.count(func.distinct(BondView.user_id))).where(
            and_(
                func.date(BondView.viewed_at) >= start_date,
                func.date(BondView.viewed_at) <= end_date
            )
        )
        unique_users = (await db.execute(unique_users_query)).scalar() or 0

        # Total API calls
        api_calls_query = select(func.sum(UserMetric.api_calls)).where(
            and_(
                UserMetric.metric_date >= start_date,
                UserMetric.metric_date <= end_date
            )
        )
        total_api_calls = (await db.execute(api_calls_query)).scalar() or 0

        # Total calculations
        calculations_query = select(func.sum(UserMetric.calculations_run)).where(
            and_(
                UserMetric.metric_date >= start_date,
                UserMetric.metric_date <= end_date
            )
        )
        total_calculations = (await db.execute(calculations_query)).scalar() or 0

        return {
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_bond_views": total_bond_views,
            "unique_users": unique_users,
            "total_api_calls": total_api_calls or 0,
            "total_calculations": total_calculations or 0,
        }
