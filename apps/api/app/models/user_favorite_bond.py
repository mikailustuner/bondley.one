from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class UserFavoriteBond(Base):
    __tablename__ = "user_favorite_bonds"
    __table_args__ = (UniqueConstraint("user_id", "bond_id", name="uq_user_favorite_bonds_user_bond"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    bond_id: Mapped[int] = mapped_column(ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    bond = relationship("Bond", foreign_keys=[bond_id])
