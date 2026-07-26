from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
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


class SourceFile(Base):
    __tablename__ = "source_files"
    __table_args__ = (
        UniqueConstraint("source_kind", "effective_date", "sha256", name="uq_source_file_identity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_kind: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date, index=True)
    requested_business_date: Mapped[date | None] = mapped_column(Date, index=True)
    date_origin: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="SOURCE_CONTENT",
    )
    freshness_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="CURRENT",
        index=True,
    )
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255))
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    etag: Mapped[str | None] = mapped_column(Text)
    last_modified: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="DOWNLOADED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    import_runs = relationship("ImportRun", back_populates="source_file")


class ImportRun(Base):
    __tablename__ = "import_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    parser_name: Mapped[str] = mapped_column(String(100), nullable=False)
    parser_version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="DISCOVERED", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    instrument_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    quarantine_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_report: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    failure_message: Mapped[str | None] = mapped_column(Text)

    source_file = relationship("SourceFile", back_populates="import_runs")
    raw_rows = relationship("RawWorkbookRow", back_populates="import_run", cascade="all, delete-orphan")
    diagnostics = relationship("ImportDiagnostic", back_populates="import_run", cascade="all, delete-orphan")


class RawWorkbookRow(Base):
    __tablename__ = "raw_workbook_rows"
    __table_args__ = (
        UniqueConstraint("import_run_id", "sheet_name", "row_number", name="uq_raw_row_location"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    import_run_id: Mapped[int] = mapped_column(
        ForeignKey("import_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sheet_name: Mapped[str] = mapped_column(String(255), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    row_class: Mapped[str] = mapped_column(String(30), nullable=False)
    cells_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    row_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    import_run = relationship("ImportRun", back_populates="raw_rows")


class SourceNote(Base):
    __tablename__ = "source_notes"
    __table_args__ = (
        UniqueConstraint("source_file_id", "sheet_name", "row_number", name="uq_source_note_location"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    raw_row_id: Mapped[int] = mapped_column(
        ForeignKey("raw_workbook_rows.id", ondelete="CASCADE"),
        nullable=False,
    )
    sheet_name: Mapped[str] = mapped_column(String(255), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    note_kind: Mapped[str] = mapped_column(String(40), nullable=False, default="SOURCE_NOTE")
    note_text: Mapped[str] = mapped_column(Text, nullable=False)


class ImportDiagnostic(Base):
    __tablename__ = "import_diagnostics"

    id: Mapped[int] = mapped_column(primary_key=True)
    import_run_id: Mapped[int] = mapped_column(
        ForeignKey("import_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    severity: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sheet_name: Mapped[str | None] = mapped_column(String(255))
    row_number: Mapped[int | None] = mapped_column(Integer)
    column_number: Mapped[int | None] = mapped_column(Integer)
    raw_fragment: Mapped[str | None] = mapped_column(Text)
    context_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    resolution_status: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    resolution_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    import_run = relationship("ImportRun", back_populates="diagnostics")


class BistGroupCodeVersion(Base):
    __tablename__ = "bist_group_code_versions"
    __table_args__ = (
        UniqueConstraint("source_file_id", "group_code", name="uq_bist_group_code_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    group_code: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    description_tr: Mapped[str] = mapped_column(Text, nullable=False)
    description_en: Mapped[str] = mapped_column(Text, nullable=False)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date)


class BistInstrumentClassificationVersion(Base):
    __tablename__ = "bist_instrument_classification_versions"
    __table_args__ = (
        UniqueConstraint("source_file_id", "classification_code", name="uq_bist_class_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    classification_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    description_tr: Mapped[str] = mapped_column(Text, nullable=False)
    description_en: Mapped[str] = mapped_column(Text, nullable=False)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date)


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin: Mapped[str] = mapped_column(String(12), nullable=False, unique=True, index=True)
    instrument_family: Mapped[str] = mapped_column(String(30), nullable=False, default="STANDARD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    versions = relationship("InstrumentVersion", back_populates="instrument")


class InstrumentVersion(Base):
    __tablename__ = "instrument_versions"
    __table_args__ = (
        UniqueConstraint("source_file_id", "source_row_number", name="uq_instrument_version_source_row"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    raw_row_id: Mapped[int] = mapped_column(
        ForeignKey("raw_workbook_rows.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_from: Mapped[date | None] = mapped_column(Date, index=True)
    valid_to: Mapped[date | None] = mapped_column(Date, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    parse_status: Mapped[str] = mapped_column(String(30), nullable=False)
    valuation_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    issuer_name: Mapped[str | None] = mapped_column(Text)
    maturity_date: Mapped[date | None] = mapped_column(Date, index=True)
    yield_type_raw: Mapped[str | None] = mapped_column(Text)
    security_type_raw: Mapped[str | None] = mapped_column(Text)
    group_code: Mapped[int | None] = mapped_column(Integer, index=True)
    bist_security_type_code: Mapped[str | None] = mapped_column(String(20))
    canonical_fields_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    semantic_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    instrument = relationship("Instrument", back_populates="versions")
    term_rule = relationship(
        "InstrumentTermRule",
        back_populates="instrument_version",
        uselist=False,
        cascade="all, delete-orphan",
    )


class InstrumentTermRule(Base):
    __tablename__ = "instrument_term_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_version_id: Mapped[int] = mapped_column(
        ForeignKey("instrument_versions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    parser_version: Mapped[str] = mapped_column(String(50), nullable=False)
    ast_schema_version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    remarks_raw: Mapped[str | None] = mapped_column(Text)
    remarks_normalized: Mapped[str | None] = mapped_column(Text)
    ast_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    instrument_version = relationship("InstrumentVersion", back_populates="term_rule")


class InstrumentConflict(Base):
    __tablename__ = "instrument_conflicts"
    __table_args__ = (
        UniqueConstraint("source_file_id", "isin", "conflict_type", name="uq_instrument_conflict"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    isin: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    conflict_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_row_numbers_json: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    differences_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    resolution_status: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    resolution_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BenchmarkObservation(Base):
    __tablename__ = "benchmark_observations"
    __table_args__ = (
        UniqueConstraint("benchmark", "observation_date", name="uq_benchmark_observation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    benchmark: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    observation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    published_annual_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    annual_rate_decimal: Mapped[Decimal | None] = mapped_column(Numeric(18, 12))
    index_value: Mapped[Decimal | None] = mapped_column(Numeric(24, 10))
    next_business_day_gap: Mapped[int | None] = mapped_column(Integer)
    period_return: Mapped[Decimal | None] = mapped_column(Numeric(24, 16))
    rate_source_file_id: Mapped[int | None] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT")
    )
    index_source_file_id: Mapped[int | None] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT")
    )
    rate_source_row: Mapped[int | None] = mapped_column(Integer)
    index_source_row: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class BenchmarkValidationResult(Base):
    __tablename__ = "benchmark_validation_results"
    __table_args__ = (
        UniqueConstraint(
            "benchmark",
            "observation_date",
            "rate_source_file_id",
            "index_source_file_id",
            name="uq_benchmark_validation_source",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    benchmark: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    observation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    previous_observation_date: Mapped[date] = mapped_column(Date, nullable=False)
    next_observation_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_index_value: Mapped[Decimal] = mapped_column(Numeric(28, 16), nullable=False)
    actual_index_value: Mapped[Decimal] = mapped_column(Numeric(24, 10), nullable=False)
    absolute_error: Mapped[Decimal] = mapped_column(Numeric(28, 18), nullable=False)
    tolerance: Mapped[Decimal] = mapped_column(Numeric(28, 18), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    rate_source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
    )
    index_source_file_id: Mapped[int] = mapped_column(
        ForeignKey("source_files.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BootstrapRun(Base):
    __tablename__ = "bootstrap_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )
    current_step: Mapped[str | None] = mapped_column(String(80))
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    requested_business_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    timezone_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="Europe/Istanbul",
    )
    app_version: Mapped[str | None] = mapped_column(String(50))
    parser_versions: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    source_file_ids: Mapped[list[int] | None] = mapped_column(JSON)
    published_effective_dates: Mapped[dict[str, str] | None] = mapped_column(JSON)
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failure_code: Mapped[str | None] = mapped_column(String(100))
    failure_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
