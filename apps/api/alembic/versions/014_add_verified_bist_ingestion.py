"""add verified BIST ingestion and benchmark schema

Revision ID: 014
Revises: 013
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_kind", sa.String(50), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("effective_date", sa.Date()),
        sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(255)),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("etag", sa.Text()),
        sa.Column("last_modified", sa.Text()),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "source_kind",
            "effective_date",
            "sha256",
            name="uq_source_file_identity",
        ),
    )
    op.create_index("ix_source_files_kind", "source_files", ["source_kind"])
    op.create_index("ix_source_files_effective_date", "source_files", ["effective_date"])
    op.create_index("ix_source_files_sha256", "source_files", ["sha256"])

    op.create_table(
        "import_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("parser_name", sa.String(100), nullable=False),
        sa.Column("parser_version", sa.String(50), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instrument_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quarantine_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_report", sa.JSON()),
        sa.Column("failure_message", sa.Text()),
    )
    op.create_index("ix_import_runs_source_file", "import_runs", ["source_file_id"])
    op.create_index("ix_import_runs_status", "import_runs", ["status"])

    op.create_table(
        "raw_workbook_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "import_run_id",
            sa.Integer(),
            sa.ForeignKey("import_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sheet_name", sa.String(255), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("row_class", sa.String(30), nullable=False),
        sa.Column("cells_json", sa.JSON(), nullable=False),
        sa.Column("row_hash", sa.String(64), nullable=False),
        sa.UniqueConstraint(
            "import_run_id",
            "sheet_name",
            "row_number",
            name="uq_raw_row_location",
        ),
    )
    op.create_index("ix_raw_rows_import", "raw_workbook_rows", ["import_run_id"])
    op.create_index("ix_raw_rows_hash", "raw_workbook_rows", ["row_hash"])

    op.create_table(
        "source_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "raw_row_id",
            sa.Integer(),
            sa.ForeignKey("raw_workbook_rows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sheet_name", sa.String(255), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("note_kind", sa.String(40), nullable=False, server_default="SOURCE_NOTE"),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.UniqueConstraint(
            "source_file_id",
            "sheet_name",
            "row_number",
            name="uq_source_note_location",
        ),
    )
    op.create_index("ix_source_notes_file", "source_notes", ["source_file_id"])

    op.create_table(
        "import_diagnostics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "import_run_id",
            sa.Integer(),
            sa.ForeignKey("import_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("sheet_name", sa.String(255)),
        sa.Column("row_number", sa.Integer()),
        sa.Column("column_number", sa.Integer()),
        sa.Column("raw_fragment", sa.Text()),
        sa.Column("context_json", sa.JSON()),
        sa.Column("resolution_status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_import_diagnostics_run", "import_diagnostics", ["import_run_id"])
    op.create_index("ix_import_diagnostics_code", "import_diagnostics", ["code"])
    op.create_index("ix_import_diagnostics_severity", "import_diagnostics", ["severity"])

    op.create_table(
        "bist_group_code_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("group_code", sa.Integer(), nullable=False),
        sa.Column("description_tr", sa.Text(), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date()),
        sa.UniqueConstraint(
            "source_file_id",
            "group_code",
            name="uq_bist_group_code_source",
        ),
    )
    op.create_index("ix_bist_group_code", "bist_group_code_versions", ["group_code"])

    op.create_table(
        "bist_instrument_classification_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("classification_code", sa.String(10), nullable=False),
        sa.Column("description_tr", sa.Text(), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date()),
        sa.UniqueConstraint(
            "source_file_id",
            "classification_code",
            name="uq_bist_class_source",
        ),
    )
    op.create_index(
        "ix_bist_classification_code",
        "bist_instrument_classification_versions",
        ["classification_code"],
    )

    op.create_table(
        "instruments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("isin", sa.String(12), nullable=False, unique=True),
        sa.Column(
            "instrument_family",
            sa.String(30),
            nullable=False,
            server_default="STANDARD",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_instruments_isin", "instruments", ["isin"], unique=True)

    op.create_table(
        "instrument_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instrument_id",
            sa.Integer(),
            sa.ForeignKey("instruments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "raw_row_id",
            sa.Integer(),
            sa.ForeignKey("raw_workbook_rows.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date()),
        sa.Column("valid_to", sa.Date()),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("parse_status", sa.String(30), nullable=False),
        sa.Column(
            "valuation_eligible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("issuer_name", sa.Text()),
        sa.Column("maturity_date", sa.Date()),
        sa.Column("yield_type_raw", sa.Text()),
        sa.Column("security_type_raw", sa.Text()),
        sa.Column("group_code", sa.Integer()),
        sa.Column("bist_security_type_code", sa.String(20)),
        sa.Column("canonical_fields_json", sa.JSON(), nullable=False),
        sa.Column("semantic_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "source_file_id",
            "source_row_number",
            name="uq_instrument_version_source_row",
        ),
    )
    op.create_index("ix_instrument_versions_instrument", "instrument_versions", ["instrument_id"])
    op.create_index("ix_instrument_versions_source", "instrument_versions", ["source_file_id"])
    op.create_index("ix_instrument_versions_published", "instrument_versions", ["is_published"])
    op.create_index("ix_instrument_versions_maturity", "instrument_versions", ["maturity_date"])
    op.create_index("ix_instrument_versions_fingerprint", "instrument_versions", ["semantic_fingerprint"])

    op.create_table(
        "instrument_term_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instrument_version_id",
            sa.Integer(),
            sa.ForeignKey("instrument_versions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("parser_version", sa.String(50), nullable=False),
        sa.Column("ast_schema_version", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("remarks_raw", sa.Text()),
        sa.Column("remarks_normalized", sa.Text()),
        sa.Column("ast_json", sa.JSON(), nullable=False),
    )
    op.create_index("ix_instrument_term_rules_status", "instrument_term_rules", ["status"])

    op.create_table(
        "instrument_conflicts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("isin", sa.String(12), nullable=False),
        sa.Column("conflict_type", sa.String(50), nullable=False),
        sa.Column("source_row_numbers_json", sa.JSON(), nullable=False),
        sa.Column("differences_json", sa.JSON(), nullable=False),
        sa.Column("resolution_status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "source_file_id",
            "isin",
            "conflict_type",
            name="uq_instrument_conflict",
        ),
    )
    op.create_index("ix_instrument_conflicts_isin", "instrument_conflicts", ["isin"])

    op.create_table(
        "benchmark_observations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("benchmark", sa.String(20), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=False),
        sa.Column("published_annual_rate_pct", sa.Numeric(12, 6)),
        sa.Column("annual_rate_decimal", sa.Numeric(18, 12)),
        sa.Column("index_value", sa.Numeric(24, 10)),
        sa.Column("next_business_day_gap", sa.Integer()),
        sa.Column("period_return", sa.Numeric(24, 16)),
        sa.Column(
            "rate_source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
        ),
        sa.Column(
            "index_source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
        ),
        sa.Column("rate_source_row", sa.Integer()),
        sa.Column("index_source_row", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "benchmark",
            "observation_date",
            name="uq_benchmark_observation",
        ),
    )
    op.create_index(
        "ix_benchmark_observation_lookup",
        "benchmark_observations",
        ["benchmark", "observation_date"],
        unique=True,
    )

    op.create_table(
        "benchmark_validation_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("benchmark", sa.String(20), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=False),
        sa.Column("previous_observation_date", sa.Date(), nullable=False),
        sa.Column("next_observation_date", sa.Date(), nullable=False),
        sa.Column("expected_index_value", sa.Numeric(28, 16), nullable=False),
        sa.Column("actual_index_value", sa.Numeric(24, 10), nullable=False),
        sa.Column("absolute_error", sa.Numeric(28, 18), nullable=False),
        sa.Column("tolerance", sa.Numeric(28, 18), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column(
            "rate_source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "index_source_file_id",
            sa.Integer(),
            sa.ForeignKey("source_files.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "benchmark",
            "observation_date",
            "rate_source_file_id",
            "index_source_file_id",
            name="uq_benchmark_validation_source",
        ),
    )
    op.create_index(
        "ix_benchmark_validation_lookup",
        "benchmark_validation_results",
        ["benchmark", "observation_date"],
    )
    op.create_index(
        "ix_benchmark_validation_passed",
        "benchmark_validation_results",
        ["passed"],
    )


def downgrade() -> None:
    op.drop_table("benchmark_validation_results")
    op.drop_table("benchmark_observations")
    op.drop_table("instrument_conflicts")
    op.drop_table("instrument_term_rules")
    op.drop_table("instrument_versions")
    op.drop_table("instruments")
    op.drop_table("bist_instrument_classification_versions")
    op.drop_table("bist_group_code_versions")
    op.drop_table("import_diagnostics")
    op.drop_table("source_notes")
    op.drop_table("raw_workbook_rows")
    op.drop_table("import_runs")
    op.drop_table("source_files")
