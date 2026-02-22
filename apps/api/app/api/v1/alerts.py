from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.user_alert import UserAlert
from app.schemas.alert import AlertCreate, AlertUpdate, AlertResponse

router = APIRouter()


@router.post("/", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = UserAlert(
        user_id=user.id,
        type=body.type,
        parameters=body.parameters,
        is_active=True,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlert).where(UserAlert.user_id == user.id).order_by(UserAlert.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/triggered", response_model=list[AlertResponse])
async def list_triggered_alerts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlert)
        .where(UserAlert.user_id == user.id, UserAlert.last_triggered_at.isnot(None))
        .order_by(UserAlert.last_triggered_at.desc())
    )
    return list(result.scalars().all())


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    body: AlertUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlert).where(UserAlert.id == alert_id, UserAlert.user_id == user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uyari bulunamadi")
    if body.type is not None:
        alert.type = body.type
    if body.parameters is not None:
        alert.parameters = body.parameters
    if body.is_active is not None:
        alert.is_active = body.is_active
    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlert).where(UserAlert.id == alert_id, UserAlert.user_id == user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uyari bulunamadi")
    await db.delete(alert)
    await db.commit()
