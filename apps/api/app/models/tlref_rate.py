from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Numeric, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class TLREFRate(Base):
    __tablename__ = "tlref_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    rate_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    index_value: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    daily_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 10))
    published_annual_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    source: Mapped[str] = mapped_column(String(50), default="BIST")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
