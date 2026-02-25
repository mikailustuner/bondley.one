from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.system_setting import SystemSetting

router = APIRouter()

@router.get("/maintenance")
async def get_maintenance_status(db: AsyncSession = Depends(get_db)):
    """
    Returns the current maintenance mode status.
    Publicly accessible.
    """
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "maintenance_mode"))
    setting = result.scalar_one_or_none()
    
    is_maintenance = False
    if setting and setting.value == "true":
        is_maintenance = True
        
    return {"is_maintenance": is_maintenance}
