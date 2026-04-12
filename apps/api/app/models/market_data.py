from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Numeric, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class MarketData(Base):
    __tablename__ = "market_data"
    __table_args__ = (UniqueConstraint("bond_id", "trade_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bond_id: Mapped[int] = mapped_column(Integer, ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    clean_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    tlref_index: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    fark: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    volume: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bond = relationship("Bond", back_populates="market_data")
