from typing import Any
from datetime import datetime

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditService:
    """Service for audit logging and retrieving audit logs."""

    @staticmethod
    async def log_action(
        db: AsyncSession,
        action: str,
        user_id: int | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_method: str | None = None,
        request_path: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Log an action to the audit log."""
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
            status_code=status_code,
            details=details,
        )
        db.add(audit_log)
        await db.flush()
        return audit_log

    @staticmethod
    async def log_user_action(
        db: AsyncSession,
        action: str,
        user_id: int,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Log a user action."""
        return await AuditService.log_action(
            db=db,
            action=action,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )

    @staticmethod
    async def log_admin_action(
        db: AsyncSession,
        action: str,
        admin_user_id: int,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Log an admin action."""
        return await AuditService.log_action(
            db=db,
            action=f"admin_{action}",
            user_id=admin_user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )

    @staticmethod
    async def log_api_request(
        db: AsyncSession,
        request_method: str,
        request_path: str,
        status_code: int,
        user_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Log an API request."""
        action = f"{request_method.lower()}_{request_path.split('/')[1] if '/' in request_path else 'unknown'}"
        return await AuditService.log_action(
            db=db,
            action=action,
            user_id=user_id,
            request_method=request_method,
            request_path=request_path,
            status_code=status_code,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )

    @staticmethod
    async def get_logs(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        user_id: int | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[list[AuditLog], int]:
        """Get audit logs with filtering and pagination."""
        query = select(AuditLog)
        count_query = select(func.count(AuditLog.id))

        conditions = []
        if user_id is not None:
            conditions.append(AuditLog.user_id == user_id)
        if action:
            conditions.append(AuditLog.action == action)
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if resource_id:
            conditions.append(AuditLog.resource_id == resource_id)
        if start_date:
            conditions.append(AuditLog.created_at >= start_date)
        if end_date:
            conditions.append(AuditLog.created_at <= end_date)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        logs = result.scalars().all()

        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        return list(logs), total

    @staticmethod
    async def get_log_stats(
        db: AsyncSession,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, int]:
        """Get statistics about audit logs grouped by action."""
        query = select(
            AuditLog.action,
            func.count(AuditLog.id).label("count")
        ).group_by(AuditLog.action)

        conditions = []
        if start_date:
            conditions.append(AuditLog.created_at >= start_date)
        if end_date:
            conditions.append(AuditLog.created_at <= end_date)

        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query)
        stats = {row.action: row.count for row in result.all()}
        return stats
