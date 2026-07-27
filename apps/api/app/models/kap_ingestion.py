from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class KapDisclosure(Base):
    """Immutable KAP disclosure snapshot.

    ``disclosure_id`` is the public KAP identifier.  A corrected disclosure is
    stored separately and linked through metadata instead of overwriting the
    original source evidence.
    """

    __tablename__ = "kap_disclosures"

    id: Mapped[int] = mapped_column(primary_key=True)
    disclosure_id: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    isin: Mapped[str | None] = mapped_column(String(12), index=True)
    member_code: Mapped[str | None] = mapped_column(String(40), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    content_type: Mapped[str | None] = mapped_column(String(255))
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    fetch_status: Mapped[str] = mapped_column(String(30), nullable=False, default="FETCHED", index=True)
    parse_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING", index=True)
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    coupon_events = relationship(
        "KapCouponEvent",
        back_populates="disclosure",
        cascade="all, delete-orphan",
    )


class KapCouponEvent(Base):
    __tablename__ = "kap_coupon_events"
    __table_args__ = (
        UniqueConstraint(
            "disclosure_id",
            "isin",
            "coupon_sequence",
            "payment_date",
            name="uq_kap_coupon_event_identity",
        ),
        Index("ix_kap_coupon_isin_payment", "isin", "payment_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    disclosure_id: Mapped[int] = mapped_column(
        ForeignKey("kap_disclosures.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    isin: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    coupon_sequence: Mapped[int | None] = mapped_column(Integer)
    period_start: Mapped[date | None] = mapped_column(Date)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    record_date: Mapped[date | None] = mapped_column(Date)
    investor_payment_date: Mapped[date | None] = mapped_column(Date)
    periodic_rate_decimal: Mapped[Decimal | None] = mapped_column(Numeric(24, 16))
    annual_simple_decimal: Mapped[Decimal | None] = mapped_column(Numeric(24, 16))
    annual_compound_decimal: Mapped[Decimal | None] = mapped_column(Numeric(24, 16))
    payment_amount: Mapped[Decimal | None] = mapped_column(Numeric(30, 8))
    currency_rate: Mapped[Decimal | None] = mapped_column(Numeric(24, 12))
    paid: Mapped[bool | None] = mapped_column(Boolean)
    raw_row: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    disclosure = relationship("KapDisclosure", back_populates="coupon_events")


class KapDerivedTerm(Base):
    __tablename__ = "kap_derived_terms"
    __table_args__ = (
        Index("ix_kap_derived_active_isin_type", "isin", "term_type", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    isin: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    term_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    value_decimal: Mapped[Decimal | None] = mapped_column(Numeric(24, 16))
    benchmark: Mapped[str | None] = mapped_column(String(20))
    annuality: Mapped[str | None] = mapped_column(String(30))
    observation_lag_business_days: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    valid_from: Mapped[date | None] = mapped_column(Date, index=True)
    valid_to: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    supporting_disclosure_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class KapIngestionState(Base):
    __tablename__ = "kap_ingestion_states"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class KapBackfillRequest(Base):
    __tablename__ = "kap_backfill_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin: Mapped[str] = mapped_column(String(12), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="QUEUED", index=True
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100, index=True)
    reason: Mapped[str] = mapped_column(String(80), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    disclosure_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    last_error: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
