from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.tlref_rate import TLREFRate
from app.models.user import User
from app.api.deps import get_admin_user

router = APIRouter()


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Sadece admin: genel istatistikler (tahvil, TLREF, kullanici sayisi)."""
    bonds_count = (await db.execute(select(func.count(Bond.id)))).scalar() or 0
    tlref_count = (await db.execute(select(func.count(TLREFRate.id)))).scalar() or 0
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    return {
        "bonds_count": bonds_count,
        "tlref_count": tlref_count,
        "users_count": users_count,
    }
