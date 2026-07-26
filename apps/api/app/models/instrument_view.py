from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class InstrumentView(Base):
    __tablename__ = "instrument_views"
    __table_args__ = (
        UniqueConstraint(
            "instrument_id",
            "user_id",
            "view_date",
            name="uq_instrument_views_instrument_user_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    view_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    settlement_date: Mapped[date | None] = mapped_column(Date)

    instrument = relationship("Instrument", foreign_keys=[instrument_id])
    user = relationship("User", foreign_keys=[user_id])
