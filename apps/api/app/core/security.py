from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import TYPE_CHECKING

import bcrypt
import pyotp
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken

settings = get_settings()

# --- MFA: TOTP secret encryption (do not derive from JWT secret) ---


def _get_fernet() -> Fernet | None:
    key = (settings.MFA_ENCRYPTION_KEY or "").strip()
    if not key:
        return None
    try:
        return Fernet(key.encode("utf-8") if isinstance(key, str) else key)
    except Exception:
        return None


def encrypt_mfa_secret(plain: str) -> str | None:
    f = _get_fernet()
    if f is None:
        return None
    try:
        return f.encrypt(plain.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def decrypt_mfa_secret(encrypted: str) -> str | None:
    f = _get_fernet()
    if f is None:
        return None
    try:
        return f.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        return None


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code or len(code) != 6:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except Exception:
        return False


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "FinCalc") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def hash_backup_code(code: str) -> str:
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_backup_code(code: str, stored_hash: str) -> bool:
    # bcrypt hashes start with $2b$ / $2a$; SHA256 hashes are 64-char hex
    try:
        if stored_hash.startswith("$2"):
            return bcrypt.checkpw(code.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        pass
    return hashlib.sha256(code.encode("utf-8")).hexdigest() == stored_hash

# bcrypt max 72 bytes; UTF-8 ile kesiyoruz (passlib kullanmiyoruz, uyumluluk hatasi onlendi)
BCRYPT_MAX_PASSWORD_BYTES = 72


def _to_b72(password: str) -> bytes:
    b = password.encode("utf-8")
    return b[:BCRYPT_MAX_PASSWORD_BYTES] if len(b) > BCRYPT_MAX_PASSWORD_BYTES else b


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_b72(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_to_b72(plain_password), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def create_email_verification_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {"exp": expire, "sub": email, "type": "email_verification"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_email_verification_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "email_verification":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def _hash_token(token: str) -> str:
    """Hash a refresh token using SHA256"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_refresh_token(user_id: int, db: AsyncSession) -> str:
    """Create a new refresh token and store it in the database"""
    from app.models.refresh_token import RefreshToken

    # Generate a secure random token
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)

    # Calculate expiration
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    # Store in database
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh_token)
    await db.flush()

    return token


async def verify_refresh_token(token: str, db: AsyncSession) -> "RefreshToken | None":
    """Verify a refresh token and return the RefreshToken object if valid"""
    from app.models.refresh_token import RefreshToken

    token_hash = _hash_token(token)

    # Find token in database
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    refresh_token = result.scalar_one_or_none()

    if refresh_token is None:
        return None

    # Check if token is valid (not revoked and not expired)
    if not refresh_token.is_valid():
        return None

    return refresh_token


async def revoke_refresh_token(token: str, db: AsyncSession) -> bool:
    """Revoke a refresh token by setting revoked_at timestamp"""
    from app.models.refresh_token import RefreshToken

    token_hash = _hash_token(token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    refresh_token = result.scalar_one_or_none()

    if refresh_token is None:
        return False

    refresh_token.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    return True


async def revoke_all_user_tokens(user_id: int, db: AsyncSession) -> int:
    """Revoke all refresh tokens for a user"""
    from app.models.refresh_token import RefreshToken

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    tokens = result.scalars().all()

    count = 0
    for token in tokens:
        token.revoked_at = datetime.now(timezone.utc)
        count += 1

    await db.flush()
    return count
