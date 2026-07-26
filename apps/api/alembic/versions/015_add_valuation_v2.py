"""add verified valuation v2 schema and preserve user relations

Revision ID: 015
Revises: 014
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_bond_instrument_map",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "bond_id",
            sa.Integer(),
            sa.ForeignKey("bonds.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "instrument_id",
            sa.Integer(),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "mapped_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.execute(
        """
        INSERT INTO legacy_bond_instrument_map (bond_id, instrument_id)
        SELECT b.id, i.id
        FROM bonds b
        JOIN instruments i ON i.isin = b.isin_code
        ON CONFLICT DO NOTHING
        """
    )

    op.create_table(
        "user_favorite_instruments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "instrument_id",
            sa.Integer(),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id",
            "instrument_id",
            name="uq_user_favorite_instruments_user_instrument",
        ),
    )
    op.create_index(
        "ix_user_favorite_instruments_user",
        "user_favorite_instruments",
        ["user_id"],
    )
    op.create_index(
        "ix_user_favorite_instruments_instrument",
        "user_favorite_instruments",
        ["instrument_id"],
    )
    op.execute(
        """
        INSERT INTO user_favorite_instruments (user_id, instrument_id)
        SELECT favorites.user_id, mapping.instrument_id
        FROM user_favorite_bonds favorites
        JOIN legacy_bond_instrument_map mapping ON mapping.bond_id = favorites.bond_id
        ON CONFLICT DO NOTHING
        """
    )

    op.create_table(
        "instrument_user_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "instrument_id",
            sa.Integer(),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id",
            "instrument_id",
            name="uq_instrument_user_notes_user_instrument",
        ),
    )
    op.create_index(
        "ix_instrument_user_notes_user",
        "instrument_user_notes",
        ["user_id"],
    )
    op.create_index(
        "ix_instrument_user_notes_instrument",
        "instrument_user_notes",
        ["instrument_id"],
    )
    op.execute(
        """
        INSERT INTO instrument_user_notes (user_id, instrument_id, note_text, created_at, updated_at)
        SELECT notes.user_id, instruments.id, notes.note_text, notes.created_at, notes.updated_at
        FROM bond_user_notes notes
        JOIN instruments ON instruments.isin = notes.isin_code
        ON CONFLICT DO NOTHING
        """
    )

    op.create_table(
        "price_observations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instrument_id",
            sa.Integer(),
            sa.ForeignKey("instruments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "instrument_version_id",
            sa.Integer(),
            sa.ForeignKey("instrument_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quote_type", sa.String(30), nullable=False),
        sa.Column("quote_value", sa.Numeric(28, 12), nullable=False),
        sa.Column("quote_date", sa.Date(), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(20), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("confidence", sa.String(30), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_price_observations_instrument", "price_observations", ["instrument_id"])
    op.create_index(
        "ix_price_observations_version",
        "price_observations",
        ["instrument_version_id"],
    )
    op.create_index("ix_price_observations_user", "price_observations", ["user_id"])

    op.create_table(
        "valuation_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instrument_version_id",
            sa.Integer(),
            sa.ForeignKey("instrument_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "price_observation_id",
            sa.Integer(),
            sa.ForeignKey("price_observations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("engine_version", sa.String(50), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_valuation_requests_version",
        "valuation_requests",
        ["instrument_version_id"],
    )
    op.create_index("ix_valuation_requests_user", "valuation_requests", ["user_id"])
    op.create_index("ix_valuation_requests_price", "valuation_requests", ["price_observation_id"])
    op.create_index("ix_valuation_requests_status", "valuation_requests", ["status"])

    op.create_table(
        "valuation_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("valuation_requests.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("failure_code", sa.String(50)),
        sa.Column("failure_message", sa.Text()),
        sa.Column("result_payload", sa.JSON()),
        sa.Column("intermediates", sa.JSON()),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_valuation_results_failure_code",
        "valuation_results",
        ["failure_code"],
    )

    op.create_table(
        "shadow_valuation_comparisons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instrument_version_id",
            sa.Integer(),
            sa.ForeignKey("instrument_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "valuation_request_id",
            sa.Integer(),
            sa.ForeignKey("valuation_requests.id", ondelete="SET NULL"),
        ),
        sa.Column("comparison_key", sa.String(100), nullable=False),
        sa.Column("legacy_payload", sa.JSON()),
        sa.Column("verified_payload", sa.JSON()),
        sa.Column("differences", sa.JSON(), nullable=False),
        sa.Column("classification", sa.String(40), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_shadow_comparison_version",
        "shadow_valuation_comparisons",
        ["instrument_version_id"],
    )
    op.create_index(
        "ix_shadow_comparison_request",
        "shadow_valuation_comparisons",
        ["valuation_request_id"],
    )
    op.create_index(
        "ix_shadow_comparison_key",
        "shadow_valuation_comparisons",
        ["comparison_key"],
    )
    op.create_index(
        "ix_shadow_comparison_classification",
        "shadow_valuation_comparisons",
        ["classification"],
    )


def downgrade() -> None:
    op.drop_table("shadow_valuation_comparisons")
    op.drop_table("valuation_results")
    op.drop_table("valuation_requests")
    op.drop_table("price_observations")
    op.drop_table("instrument_user_notes")
    op.drop_table("user_favorite_instruments")
    op.drop_table("legacy_bond_instrument_map")
