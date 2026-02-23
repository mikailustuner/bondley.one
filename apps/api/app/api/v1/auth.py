from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import limiter, login_limit, signup_limit
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
    decode_access_token,
)
from datetime import timedelta

from app.models.user import User
from app.models.user_mfa_backup_code import UserMfaBackupCode
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    TokenResponseMfaRequired,
    PublicRegister,
    UserUpdate,
    PasswordChange,
    EmailChange,
    RefreshTokenRequest,
    MfaSetupResponse,
    MfaConfirmRequest,
    MfaConfirmResponse,
    MfaVerifyRequest,
    MfaDisableRequest,
)
from app.core.config import get_settings
from app.api.deps import get_current_user, get_admin_user

settings = get_settings()
from app.core.security import (
    encrypt_mfa_secret,
    decrypt_mfa_secret,
    verify_totp,
    generate_totp_secret,
    get_totp_uri,
    hash_backup_code,
)

router = APIRouter()


@router.post("/login")
@limiter.limit(login_limit)
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    if user.mfa_enabled:
        mfa_token = create_access_token(
            data={"sub": str(user.id), "mfa_pending": True},
            expires_delta=timedelta(minutes=2),
        )
        return TokenResponseMfaRequired(
            mfa_required=True,
            mfa_token=mfa_token,
            user=UserResponse.model_validate(user),
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = await create_refresh_token(user.id, db)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(signup_limit)
async def public_signup(request: Request, data: PublicRegister, db: AsyncSession = Depends(get_db)):
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

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = await create_refresh_token(user.id, db)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


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


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh token ile yeni access token al"""
    refresh_token_obj = await verify_refresh_token(data.refresh_token, db)

    if refresh_token_obj is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user
    result = await db.execute(select(User).where(User.id == refresh_token_obj.user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Create new access token
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})

    # Optionally create a new refresh token (token rotation - more secure)
    # For now, we'll reuse the same refresh token
    # new_refresh_token = await create_refresh_token(user.id, db)
    # await revoke_refresh_token(data.refresh_token, db)

    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=data.refresh_token,  # Return same token (or new_refresh_token if rotating)
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Logout - revoke refresh token"""
    success = await revoke_refresh_token(data.refresh_token, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid refresh token",
        )

    await db.commit()
    return {"message": "Successfully logged out"}


@router.post("/logout-all", status_code=status.HTTP_200_OK)
async def logout_all(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Logout from all devices - revoke all refresh tokens for user"""
    count = await revoke_all_user_tokens(user.id, db)
    await db.commit()
    return {"message": f"Logged out from {count} device(s)"}


# --- MFA / 2FA ---

def _generate_backup_codes(count: int = 10) -> list[str]:
    import secrets
    return [secrets.token_hex(4) for _ in range(count)]  # 8-char hex each


@router.post("/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate new TOTP secret and return secret + QR URI. Call /mfa/confirm with a code to enable."""
    secret = generate_totp_secret()
    encrypted = encrypt_mfa_secret(secret)
    if encrypted is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MFA encryption not configured (MFA_ENCRYPTION_KEY)",
        )
    user.mfa_secret_encrypted = encrypted
    await db.commit()
    qr_uri = get_totp_uri(secret, user.email or "user", issuer=settings.PROJECT_NAME)
    return MfaSetupResponse(secret=secret, qr_uri=qr_uri)


@router.post("/mfa/confirm", response_model=MfaConfirmResponse)
async def mfa_confirm(
    data: MfaConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code and enable 2FA; generate and return backup codes (one-time)."""
    if not user.mfa_secret_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Önce /mfa/setup çağırın")
    secret = decrypt_mfa_secret(user.mfa_secret_encrypted)
    if not secret or not verify_totp(secret, data.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kod")
    user.mfa_enabled = True
    codes = _generate_backup_codes(10)
    for code in codes:
        db.add(UserMfaBackupCode(user_id=user.id, code_hash=hash_backup_code(code)))
    await db.commit()
    return MfaConfirmResponse(backup_codes=codes)


@router.post("/mfa/verify", response_model=TokenResponse)
async def mfa_verify(data: MfaVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Exchange mfa_token + TOTP or backup code for access and refresh tokens."""
    payload = decode_access_token(data.mfa_token)
    if not payload or not payload.get("mfa_pending") or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz veya süresi dolmuş mfa_token")
    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı")
    verified = False
    if user.mfa_secret_encrypted:
        secret = decrypt_mfa_secret(user.mfa_secret_encrypted)
        if secret and len(data.code) == 6 and verify_totp(secret, data.code):
            verified = True
    if not verified:
        code_hash = hash_backup_code(data.code)
        backup_result = await db.execute(
            select(UserMfaBackupCode).where(
                UserMfaBackupCode.user_id == user.id,
                UserMfaBackupCode.code_hash == code_hash,
                UserMfaBackupCode.used_at.is_(None),
            )
        )
        backup = backup_result.scalar_one_or_none()
        if backup:
            from datetime import datetime, timezone
            backup.used_at = datetime.now(timezone.utc)
            verified = True
    if not verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz kod")
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = await create_refresh_token(user.id, db)
    await db.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/mfa/disable", status_code=status.HTTP_200_OK)
async def mfa_disable(
    data: MfaDisableRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA after verifying password; clear secret and backup codes."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yanlış parola")
    user.mfa_enabled = False
    user.mfa_secret_encrypted = None
    from sqlalchemy import delete
    await db.execute(delete(UserMfaBackupCode).where(UserMfaBackupCode.user_id == user.id))
    await db.commit()
    return {"message": "İki adımlı doğrulama kapatıldı"}


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
