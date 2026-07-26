from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class UserFavoriteInstrument(Base):
    __tablename__ = "user_favorite_instruments"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "instrument_id",
            name="uq_user_favorite_instruments_user_instrument",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class InstrumentUserNote(Base):
    __tablename__ = "instrument_user_notes"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "instrument_id",
            name="uq_instrument_user_notes_user_instrument",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class PriceObservation(Base):
    __tablename__ = "price_observations"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    instrument_version_id: Mapped[int] = mapped_column(
        ForeignKey("instrument_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quote_type: Mapped[str] = mapped_column(String(30), nullable=False)
    quote_value: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="USER_INPUT",
    )
    confidence: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="USER_PROVIDED",
    )
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class ValuationRequestRecord(Base):
    __tablename__ = "valuation_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_version_id: Mapped[int] = mapped_column(
        ForeignKey("instrument_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    price_observation_id: Mapped[int] = mapped_column(
        ForeignKey("price_observations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    engine_version: Mapped[str] = mapped_column(String(50), nullable=False)
    request_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    result = relationship(
        "ValuationResultRecord",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ValuationResultRecord(Base):
    __tablename__ = "valuation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("valuation_requests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_code: Mapped[str | None] = mapped_column(String(50), index=True)
    failure_message: Mapped[str | None] = mapped_column(Text)
    result_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    intermediates: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    request = relationship("ValuationRequestRecord", back_populates="result")
