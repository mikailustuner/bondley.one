from datetime import datetime, date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.tlref_rate import TLREFRate
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api.deps import get_admin_user
from app.schemas.user import UserUpdate, UserResponse
from app.services.bond_fetcher import BondFetcher
from app.services.tlref_fetcher import TLREFFetcher
from app.services.audit_service import AuditService
from app.services.metrics_service import MetricsService

router = APIRouter()


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Sadece admin: genel istatistikler (tahvil, TLREF, kullanici sayisi)."""
    bonds_count = (
        await db.execute(select(func.count(Bond.id)).where(Bond.is_active == True))
    ).scalar() or 0
    tlref_count = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    return {
        "bonds_count": bonds_count,
        "tlref_count": tlref_count,
        "users_count": users_count,
    }


@router.get("/public-summary")
async def get_public_summary(db: AsyncSession = Depends(get_db)):
    """Auth gerektirmez: landing sayfasi icin ozet veri."""
    latest_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
    )
    latest = latest_result.scalar_one_or_none()

    first_result = await db.execute(
        select(TLREFRate).order_by(TLREFRate.rate_date.asc()).limit(1)
    )
    first = first_result.scalar_one_or_none()

    total_tlref = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0
    total_bonds = (
        await db.execute(select(func.count(Bond.id)).where(Bond.is_active == True))
    ).scalar() or 0

    annualized_rate = None
    if latest and first and first.index_value > 0:
        days = (latest.rate_date - first.rate_date).days
        if days > 0:
            ratio = float(latest.index_value / first.index_value)
            annualized_rate = round((ratio ** (365.0 / days) - 1) * 100, 2)

    return {
        "tlref_index": float(latest.index_value) if latest else None,
        "tlref_date": latest.rate_date.isoformat() if latest else None,
        "tlref_daily_rate": float(latest.daily_rate * 100) if latest and latest.daily_rate else None,
        "tlref_annualized_rate": annualized_rate,
        "total_tlref_records": total_tlref,
        "total_bonds": total_bonds,
    }


@router.post("/sync-all")
async def sync_all_data(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: Hem TLREF endeks hem tahvil listesini guncelle."""
    tlref_fetcher = TLREFFetcher(db)
    bond_fetcher = BondFetcher(db)

    historical = await tlref_fetcher.fetch_historical()
    daily = await tlref_fetcher.fetch_daily()
    bonds = await bond_fetcher.fetch_and_sync()

    return {
        "tlref_historical": historical,
        "tlref_daily": daily,
        "bonds": bonds,
    }


# User Management Endpoints
@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullanici bilgilerini gunceller."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.company is not None:
        user.company = data.company
    if data.location is not None:
        user.location = data.location

    await AuditService.log_admin_action(
        db=db,
        action="update_user",
        admin_user_id=admin.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"updated_fields": data.model_dump(exclude_unset=True)},
    )

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role: str = Query(..., description="Yeni rol: admin, premium_user, pro_user, free_user"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullanici rolunu degistirir."""
    if role not in ("admin", "premium_user", "pro_user", "free_user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gecersiz rol. Gecerli roller: admin, premium_user, pro_user, free_user"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    old_role = user.role
    user.role = role

    await AuditService.log_admin_action(
        db=db,
        action="change_user_role",
        admin_user_id=admin.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"old_role": old_role, "new_role": role},
    )

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: int,
    is_active: bool = Query(..., description="Aktif durumu"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullanici aktif/pasif durumunu degistirir."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    old_status = user.is_active
    user.is_active = is_active

    await AuditService.log_admin_action(
        db=db,
        action="change_user_status",
        admin_user_id=admin.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"old_status": old_status, "new_status": is_active},
    )

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullaniciyi siler."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabinizi silemezsiniz"
        )

    await AuditService.log_admin_action(
        db=db,
        action="delete_user",
        admin_user_id=admin.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"deleted_user_email": user.email},
    )

    await db.delete(user)
    await db.commit()


# Log Endpoints
@router.get("/logs")
async def get_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: int | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Audit loglarini goruntuler."""
    logs, total = await AuditService.get_logs(
        db=db,
        skip=skip,
        limit=limit,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
    )

    return {
        "logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "request_method": log.request_method,
                "request_path": log.request_path,
                "status_code": log.status_code,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/logs/{log_id}")
async def get_log_detail(
    log_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Tek bir log detayini goruntuler."""
    result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log bulunamadi")

    return {
        "id": log.id,
        "user_id": log.user_id,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "request_method": log.request_method,
        "request_path": log.request_path,
        "status_code": log.status_code,
        "details": log.details,
        "created_at": log.created_at.isoformat(),
    }


@router.get("/logs/stats")
async def get_log_stats(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Log istatistiklerini goruntuler."""
    stats = await AuditService.get_log_stats(
        db=db,
        start_date=start_date,
        end_date=end_date,
    )

    return {
        "stats": stats,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
    }


# Metrics Endpoints
@router.get("/metrics/bonds")
async def get_bond_metrics(
    limit: int = Query(10, ge=1, le=100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: En cok goruntulenen tahviller."""
    stats = await MetricsService.get_bond_view_stats(
        db=db,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )

    return {"bonds": stats}


@router.get("/metrics/users")
async def get_user_metrics(
    limit: int = Query(10, ge=1, le=100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullanici aktivite metrikleri."""
    stats = await MetricsService.get_user_activity_stats(
        db=db,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )

    return {"users": stats}


@router.get("/metrics/overview")
async def get_metrics_overview(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Genel metrik ozeti."""
    overview = await MetricsService.get_metrics_overview(db=db, days=days)
    return overview
