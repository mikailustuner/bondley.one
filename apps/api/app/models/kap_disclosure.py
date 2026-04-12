"""
KAP (Kamuyu Aydinlatma Platformu) bildirim modelleri.
3 tablo: kap_companies, kap_disclosures, kap_disclosure_details
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    String, Date, Numeric, Boolean, Integer, DateTime, Text, JSON,
    ForeignKey, func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class KapCompany(Base):
    """CSV'deki sirket-KAP ID eslemesi."""
    __tablename__ = "kap_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    sirket_adi: Mapped[str] = mapped_column(String(255), nullable=False)
    kap_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    stock_code: Mapped[str | None] = mapped_column(String(20))
    api_url: Mapped[str | None] = mapped_column(Text)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    disclosures = relationship("KapDisclosure", back_populates="company", cascade="all, delete-orphan")


class KapDisclosure(Base):
    """Her bir KAP bildirimi (sgbf-data API'den)."""
    __tablename__ = "kap_disclosures"

    id: Mapped[int] = mapped_column(primary_key=True)
    kap_company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kap_companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    disclosure_index: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    disclosure_id: Mapped[str | None] = mapped_column(String(100))
    title: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    publish_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    isin_code: Mapped[str | None] = mapped_column(String(30), index=True)
    disclosure_class: Mapped[str | None] = mapped_column(String(20))
    disclosure_type: Mapped[str | None] = mapped_column(String(20))
    disclosure_category: Mapped[str | None] = mapped_column(String(20))
    company_title: Mapped[str | None] = mapped_column(String(255))
    stock_code: Mapped[str | None] = mapped_column(String(20))
    related_stocks: Mapped[str | None] = mapped_column(String(100))
    is_changed: Mapped[str | None] = mapped_column(String(50))
    is_late: Mapped[bool | None] = mapped_column(Boolean)
    attachment_count: Mapped[int | None] = mapped_column(Integer, default=0)
    has_multi_language: Mapped[str | None] = mapped_column(String(5))
    period: Mapped[str | None] = mapped_column(String(10))
    year: Mapped[str | None] = mapped_column(String(10))
    disclosure_url: Mapped[str | None] = mapped_column(Text)
    fetch_date: Mapped[date | None] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    company = relationship("KapCompany", back_populates="disclosures")
    detail = relationship("KapDisclosureDetail", back_populates="disclosure", uselist=False, cascade="all, delete-orphan")


class KapDisclosureDetail(Base):
    """Excel export'tan parse edilen bildirim detaylari."""
    __tablename__ = "kap_disclosure_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    disclosure_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kap_disclosures.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    isin_code: Mapped[str | None] = mapped_column(String(30), index=True)
    fund_user: Mapped[str | None] = mapped_column(String(255))  # Sukuk: Fon Kullanicisi
    source_institution: Mapped[str | None] = mapped_column(String(255))  # Sukuk: Kaynak Kurulus

    # Arac bilgileri
    instrument_type: Mapped[str | None] = mapped_column(String(50))
    maturity_date: Mapped[date | None] = mapped_column(Date)
    maturity_days: Mapped[int | None] = mapped_column(Integer)
    nominal_value: Mapped[Decimal | None] = mapped_column(Numeric(22, 3))
    issue_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    interest_rate_type: Mapped[str | None] = mapped_column(String(50))
    floating_rate_reference: Mapped[str | None] = mapped_column(String(50))
    additional_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    coupon_number: Mapped[int | None] = mapped_column(Integer)
    coupon_frequency: Mapped[str | None] = mapped_column(String(50))
    currency: Mapped[str | None] = mapped_column(String(10))
    payment_type: Mapped[str | None] = mapped_column(String(50))

    # Satis bilgileri
    sale_type: Mapped[str | None] = mapped_column(String(100))
    starting_date_sale: Mapped[date | None] = mapped_column(Date)
    ending_date_sale: Mapped[date | None] = mapped_column(Date)
    maturity_starting_date: Mapped[date | None] = mapped_column(Date)
    traded_in_exchange: Mapped[bool | None] = mapped_column(Boolean)
    intermediary_brokerage: Mapped[str | None] = mapped_column(String(255))

    # Ihrac tavani
    issue_limit: Mapped[Decimal | None] = mapped_column(Numeric(22, 3))
    issue_limit_security_type: Mapped[str | None] = mapped_column(String(100))
    issue_limit_currency: Mapped[str | None] = mapped_column(String(10))

    # Rating
    issuer_has_rating: Mapped[bool | None] = mapped_column(Boolean)
    issuer_rating_company: Mapped[str | None] = mapped_column(String(100))
    issuer_rating_note: Mapped[str | None] = mapped_column(String(20))
    issuer_rating_date: Mapped[date | None] = mapped_column(Date)
    issuer_rating_investment_grade: Mapped[bool | None] = mapped_column(Boolean)
    instrument_has_rating: Mapped[bool | None] = mapped_column(Boolean)
    originator_has_rating: Mapped[bool | None] = mapped_column(Boolean)

    # Kupon odeme plani (JSON)
    coupon_payments_json: Mapped[dict | None] = mapped_column(JSON)

    # Ek aciklamalar
    additional_explanation: Mapped[str | None] = mapped_column(Text)
    board_decision_date: Mapped[date | None] = mapped_column(Date)
    subject_of_notification: Mapped[str | None] = mapped_column(String(100))

    # Ham veri (backup)
    raw_data_json: Mapped[dict | None] = mapped_column(JSON)

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    disclosure = relationship("KapDisclosure", back_populates="detail")
