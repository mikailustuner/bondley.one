from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class NotificationBase(BaseModel):
    title: str
    message: str
    type: str = "info"

class NotificationCreate(NotificationBase):
    user_id: Optional[int] = None  # None means broadcast to all (handled in service)

class NotificationBroadcast(NotificationBase):
    pass # Used for admin broadcast

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
