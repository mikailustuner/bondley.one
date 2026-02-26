from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    String, Date, Numeric, Boolean, Integer, DateTime, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class Bond(Base):
    __tablename__ = "bonds"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    issuer: Mapped[str | None] = mapped_column(String(255))
    fund_user: Mapped[str | None] = mapped_column(String(255))  # Sukuk: Fon Kullanicisi
    source_institution: Mapped[str | None] = mapped_column(String(255))  # Sukuk: Kaynak Kurulus
    issuance_type: Mapped[str | None] = mapped_column(String(100))
    yield_type: Mapped[str | None] = mapped_column(String(255))
    security_type: Mapped[str | None] = mapped_column(String(255))
    coupon_frequency: Mapped[str | None] = mapped_column(String(50))
    currency: Mapped[str] = mapped_column(String(20), default="TRY")
    group_code: Mapped[int | None] = mapped_column(Integer)
    first_issue_date: Mapped[date | None] = mapped_column(Date)
    maturity_date: Mapped[date | None] = mapped_column(Date)
    days_to_maturity: Mapped[int | None] = mapped_column(Integer)
    total_issue_amount: Mapped[Decimal | None] = mapped_column(Numeric(22, 3))
    last_issue_date_text: Mapped[str | None] = mapped_column(String(100))
    last_issue_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    last_issue_yield: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    first_issue_yield: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    next_coupon_date: Mapped[date | None] = mapped_column(Date)
    next_coupon_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    spread: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    first_issue_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    quotation_method: Mapped[str | None] = mapped_column(String(100))
    accrued_interest_text: Mapped[str | None] = mapped_column(String(100))
    clean_price_text: Mapped[str | None] = mapped_column(String(100))
    dirty_price_formula: Mapped[str | None] = mapped_column(String(100))
    settlement_price_formula: Mapped[str | None] = mapped_column(String(100))
    yield_formula: Mapped[str | None] = mapped_column(String(100))
    compound_yield_formula: Mapped[str | None] = mapped_column(String(100))
    day_count_convention: Mapped[str | None] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    brokerage: Mapped[str | None] = mapped_column(String(255))
    security_type_detail: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    market_data = relationship("MarketData", back_populates="bond", cascade="all, delete-orphan")
    calculations = relationship("Calculation", back_populates="bond", cascade="all, delete-orphan")
