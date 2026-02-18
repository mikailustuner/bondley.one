from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Date, Numeric, Boolean, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Bond(Base):
    __tablename__ = "bonds"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    bond_type: Mapped[str] = mapped_column(String(10), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=False)
    coupon_rate: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    coupon_frequency: Mapped[int] = mapped_column(Integer, default=2)
    face_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("100.00"))
    currency: Mapped[str] = mapped_column(String(3), default="TRY")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    market_data = relationship("MarketData", back_populates="bond", cascade="all, delete-orphan")
    calculations = relationship("Calculation", back_populates="bond", cascade="all, delete-orphan")
