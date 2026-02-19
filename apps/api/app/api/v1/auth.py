from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    PublicRegister,
    UserUpdate,
    PasswordChange,
    EmailChange,
)
from app.api.deps import get_current_user, get_admin_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def public_signup(data: PublicRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayitli",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        company=data.company,
        location=data.location,
        role="free_user",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        company=data.company,
        location=data.location,
        role=data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Sadece admin: tum kullanicilari listeler."""
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.put("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanici kendi profil bilgilerini gunceller."""
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.company is not None:
        user.company = data.company
    if data.location is not None:
        user.location = data.location

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanici sifresini degistirir."""
    # Verify current password
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut sifre yanlis"
        )

    # Update password
    user.password_hash = hash_password(data.new_password)
    await db.commit()

    return {"message": "Sifre basariyla guncellendi"}


@router.post("/change-email", response_model=UserResponse)
async def change_email(
    data: EmailChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanici e-posta adresini degistirir."""
    # Check if new email is already taken
    existing = await db.execute(select(User).where(User.email == data.new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kullaniliyor"
        )

    # Update email
    user.email = data.new_email
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.get("/permissions")
async def get_permissions(user: User = Depends(get_current_user)):
    """Kullanici yetkilerini dondurur."""
    from app.core.permissions import (
        is_admin,
        is_pro_user,
        is_premium_user,
        get_role_level,
    )

    return {
        "role": user.role,
        "is_admin": is_admin(user.role),
        "is_pro_user": is_pro_user(user.role),
        "is_premium_user": is_premium_user(user.role),
        "role_level": get_role_level(user.role),
    }
