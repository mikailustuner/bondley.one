from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import TYPE_CHECKING

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken

settings = get_settings()

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
