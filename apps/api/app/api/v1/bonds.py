from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.user import User
from app.schemas.bond import BondResponse, BondListResponse
from app.api.deps import get_current_user, get_admin_user

router = APIRouter()


@router.get("/", response_model=BondListResponse)
async def list_bonds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=3000),
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Bond)
    count_query = select(func.count(Bond.id))

    if active_only:
        query = query.where(Bond.is_active == True)
        count_query = count_query.where(Bond.is_active == True)

    total = (await db.execute(count_query)).scalar()
    result = await db.execute(query.offset(skip).limit(limit).order_by(Bond.maturity_date))
    bonds = result.scalars().all()

    return BondListResponse(
        items=[BondResponse.model_validate(b) for b in bonds],
        total=total,
    )


@router.get("/{isin_code}", response_model=BondResponse)
async def get_bond(
    isin_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(Bond).where(Bond.isin_code == isin_code))
    bond = result.scalar_one_or_none()
    if not bond:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
    return BondResponse.model_validate(bond)


@router.post("/", status_code=status.HTTP_403_FORBIDDEN)
async def create_bond(
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tahviller sadece BIST otomatik sureci ile eklenir.",
    )


@router.patch("/{isin_code}", status_code=status.HTTP_403_FORBIDDEN)
async def update_bond(
    isin_code: str,
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tahviller sadece BIST otomatik sureci ile guncellenir.",
    )


@router.delete("/{isin_code}", status_code=status.HTTP_403_FORBIDDEN)
async def delete_bond(
    isin_code: str,
    _admin: User = Depends(get_admin_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tahviller sadece BIST otomatik sureci ile yonetilir; silme kapali.",
    )
