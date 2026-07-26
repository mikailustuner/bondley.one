from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models.bist_ingestion import (
    BenchmarkObservation,
    ImportDiagnostic,
    InstrumentVersion,
)
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting
from app.api.deps import get_admin_user
from app.schemas.user import UserUpdate, UserResponse
from app.services.bist_ingestion.import_service import VerifiedBistImportService
from app.services.bist_ingestion.bootstrap import VerifiedBistBootstrapService
from app.services.audit_service import AuditService
from app.services.metrics_service import MetricsService

router = APIRouter()
settings = get_settings()


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Sadece admin: doğrulanmış enstrüman, benchmark ve kullanıcı sayıları."""
    bonds_count = (
        await db.execute(
            select(func.count(func.distinct(InstrumentVersion.instrument_id))).where(
                InstrumentVersion.is_published.is_(True)
            )
        )
    ).scalar() or 0
    tlref_count = (
        await db.execute(
            select(func.count(BenchmarkObservation.id)).where(
                BenchmarkObservation.benchmark == "TLREF"
            )
        )
    ).scalar() or 0
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    return {
        "bonds_count": bonds_count,
        "tlref_count": tlref_count,
        "users_count": users_count,
    }


@router.get("/data-health")
async def get_data_health(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin: doğrulanmış parser ve veri kalitesi tanıları."""
    total_active_bonds = (
        await db.scalar(
            select(func.count(func.distinct(InstrumentVersion.instrument_id))).where(
                InstrumentVersion.is_published.is_(True)
            )
        )
        or 0
    )
    rows = (
        await db.execute(
            select(ImportDiagnostic)
            .where(ImportDiagnostic.severity.in_(["ERROR", "FATAL"]))
            .order_by(ImportDiagnostic.id.desc())
            .limit(500)
        )
    ).scalars()
    health_issues = [
        {
            "diagnostic_id": item.id,
            "import_run_id": item.import_run_id,
            "code": item.code,
            "message": item.message,
            "sheet_name": item.sheet_name,
            "row_number": item.row_number,
            "issues": [item.code.lower()],
        }
        for item in rows
    ]
    return {
        "total_active_bonds": total_active_bonds,
        "total_issues": len(health_issues),
        "bonds_with_issues": health_issues,
    }


@router.post("/sync-all")
async def sync_all_data(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: doğrulanmış tbliste, TLREF ve TLREFK kaynaklarını güncelle."""
    service = VerifiedBistImportService(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
    requested_date = (
        VerifiedBistBootstrapService(db, settings)
        .calendar.resolve_expected_source_date()
        .requested_business_date
    )
    bonds = await service.import_tbliste(
        settings.BIST_BOND_LIST_URL,
        requested_business_date=requested_date,
    )
    tlref = await service.import_benchmark_pair(
        "TLREF",
        rate_url=settings.BIST_TLREF_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREF_HISTORICAL_URL,
        historical=True,
        requested_business_date=requested_date,
    )
    tlrefk = await service.import_benchmark_pair(
        "TLREFK",
        rate_url=settings.BIST_TLREFK_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREFK_INDEX_HISTORICAL_URL,
        historical=True,
        requested_business_date=requested_date,
    )
    return {
        "tlref_historical": tlref,
        "tlrefk_historical": tlrefk,
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

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

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
    role: Literal["admin", "premium_user", "pro_user", "free_user"] = Query(..., description="Yeni rol"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Kullanici rolunu degistirir."""
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
    action: str | None = Query(None, max_length=50),
    resource_type: str | None = Query(None, max_length=50),
    resource_id: str | None = Query(None, max_length=100),
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
    stats = await MetricsService.get_instrument_view_stats(
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


@router.post("/maintenance", status_code=status.HTTP_200_OK)
async def toggle_maintenance_mode(
    is_active: bool = Query(..., description="Bakım modunu aç/kapat"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Bakım modunu (Site Under Construction) açar veya kapatır."""
    
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "maintenance_mode"))
    setting = result.scalar_one_or_none()
    
    new_value = "true" if is_active else "false"
    
    if setting:
        setting.value = new_value
    else:
        setting = SystemSetting(
            key="maintenance_mode",
            value=new_value,
            description="Site bakım modu aktif/pasif durumu"
        )
        db.add(setting)
        
    await AuditService.log_admin_action(
        db=db,
        action="toggle_maintenance_mode",
        admin_user_id=admin.id,
        resource_type="system_setting",
        resource_id="maintenance_mode",
        details={"is_active": is_active},
    )
    
    await db.commit()
    return {"message": "Bakım modu güncellendi.", "maintenance_mode": is_active}
