from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import User
from app.api.deps import get_admin_user

router = APIRouter()


@router.post("/csv", status_code=status.HTTP_403_FORBIDDEN)
async def import_csv(
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Veri aktarimi sadece BIST otomatik sureci ile yapilir.",
    )
