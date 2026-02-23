from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Numeric, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class Calculation(Base):
    __tablename__ = "calculations"
    __table_args__ = (UniqueConstraint("bond_id", "calc_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bond_id: Mapped[int] = mapped_column(Integer, ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False)
    calc_date: Mapped[date] = mapped_column(Date, nullable=False)
    dirty_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    accrued_interest: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    yield_to_maturity: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    spread: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    modified_duration: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    macaulay_duration: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bond = relationship("Bond", back_populates="calculations")
