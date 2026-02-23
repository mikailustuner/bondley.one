from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """Admin tarafindan kullanici olusturma"""
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    company: str | None = None
    location: str | None = None
    role: str = "free_user"


class PublicRegister(BaseModel):
    """Halka acik B2B kayit formu"""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    company: str = Field(min_length=2, max_length=255)
    location: str = Field(min_length=2, max_length=255)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    company: str | None
    location: str | None
    role: str
    is_active: bool
    mfa_enabled: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenResponseMfaRequired(BaseModel):
    """Login when 2FA is enabled: client must call POST /auth/mfa/verify with mfa_token and code."""
    mfa_required: bool = True
    mfa_token: str
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Refresh token ile yeni access token almak için"""
    refresh_token: str


class UserUpdate(BaseModel):
    """Kullanici profil bilgilerini guncelleme"""
    full_name: str | None = Field(None, min_length=2, max_length=255)
    company: str | None = Field(None, min_length=2, max_length=255)
    location: str | None = Field(None, min_length=2, max_length=255)


class PasswordChange(BaseModel):
    """Sifre degistirme"""
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class EmailChange(BaseModel):
    """E-posta degistirme"""
    new_email: EmailStr


# --- MFA schemas ---


class MfaSetupResponse(BaseModel):
    """One-time response: secret and QR URI for authenticator app."""
    secret: str
    qr_uri: str


class MfaConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaConfirmResponse(BaseModel):
    backup_codes: list[str]
    message: str = "2FA etkinlestirildi. Yedek kodlari guvenli bir yere kaydedin."


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=8)


class MfaDisableRequest(BaseModel):
    password: str
