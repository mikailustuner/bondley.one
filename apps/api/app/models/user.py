from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, Integer, Text, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken
    from app.models.user_mfa_backup_code import UserMfaBackupCode


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'premium_user', 'pro_user', 'free_user')", name="ck_users_role"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))

    # Onboarding fields
    department: Mapped[str | None] = mapped_column(String(255))
    job_title: Mapped[str | None] = mapped_column(String(255))
    usage_purpose: Mapped[str | None] = mapped_column(Text)
    estimated_daily_views: Mapped[int | None] = mapped_column(Integer)
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    role: Mapped[str] = mapped_column(String(20), default="free_user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Privacy policy acceptance
    privacy_policy_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    privacy_policy_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # MFA / 2FA
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret_encrypted: Mapped[str | None] = mapped_column(String(255))

    # Relationships
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    mfa_backup_codes: Mapped[list["UserMfaBackupCode"]] = relationship("UserMfaBackupCode", back_populates="user", cascade="all, delete-orphan")
