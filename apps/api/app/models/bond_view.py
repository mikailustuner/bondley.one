from datetime import date, datetime

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class BondView(Base):
    __tablename__ = "bond_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    bond_id: Mapped[int] = mapped_column(ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    settlement_date: Mapped[date | None] = mapped_column(Date)

    bond = relationship("Bond", foreign_keys=[bond_id])
    user = relationship("User", foreign_keys=[user_id])
