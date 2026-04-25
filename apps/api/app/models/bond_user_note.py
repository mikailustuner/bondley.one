from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class BondUserNote(Base):
    __tablename__ = "bond_user_notes"
    __table_args__ = (UniqueConstraint("user_id", "isin_code", name="uq_bond_user_notes_user_isin"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    isin_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
