from fastapi import APIRouter, Depends

from app.models.user import User
from app.api.deps import get_admin_user

router = APIRouter()

IMPORT_DISABLED_RESPONSE = {
    "enabled": False,
    "message": "Veri aktarimi sadece BIST otomatik sureci ile yapilir. Manuel CSV yukleme kapalidir.",
}


@router.get("/csv", summary="Import durumu")
async def get_import_status(_admin: User = Depends(get_admin_user)):
    """CSV import devre disi; veriler BIST otomasyonu (Celery) ile doldurulur."""
    return IMPORT_DISABLED_RESPONSE


@router.post("/csv", summary="CSV import (devre disi)")
async def import_csv(_admin: User = Depends(get_admin_user)):
    """CSV import devre disi; veriler BIST otomasyonu ile doldurulur. Bu endpoint sadece aciklama doner."""
    return IMPORT_DISABLED_RESPONSE
