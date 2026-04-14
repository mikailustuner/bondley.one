from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.api import deps
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationUpdate, NotificationBroadcast
from app.core.database import get_db

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Kullanıcının bildirimlerini getir."""
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Bildirimi okundu/okunmadı olarak işaretle."""
    query = select(Notification).where(
        Notification.id == notification_id, 
        Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
        
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Bildirimi sil."""
    query = delete(Notification).where(
        Notification.id == notification_id, 
        Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    await db.commit()
    return None

@router.post("/broadcast", status_code=status.HTTP_201_CREATED)
async def broadcast_notification(
    data: NotificationBroadcast,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Tüm aktif kullanıcılara bildirim gönder (Sadece Admin)."""
    # Tum aktif kullanicilari bul
    user_query = select(User).where(User.is_active == True)
    user_result = await db.execute(user_query)
    users = user_result.scalars().all()
    
    # Her kullanıcı için bildirim oluştur
    for user in users:
        new_notif = Notification(
            user_id=user.id,
            title=data.title,
            message=data.message,
            type=data.type
        )
        db.add(new_notif)
        
    await db.commit()
    return {"status": "success", "users_notified": len(users)}
