"""add performance indexes for query optimization

Revision ID: 011
Revises: 010
Create Date: 2026-04-23

Indexes added:
- bonds: partial index on maturity_date WHERE is_active = TRUE (hot list query)
- bonds: GIN trigram indexes on isin_code, issuer (ILIKE search)
- user_alerts: composite (user_id, is_active) (Celery alert task every 15min)
- refresh_tokens: user_id, token_hash (auth hot path)
- bond_views: bond_id, user_id (analytics queries)
- user_mfa_backup_codes: user_id (MFA flow)
- user_metrics: composite (user_id, metric_date) (usage tracking)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '011'
down_revision: Union[str, None] = '010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {"name": index_name})
    return res.scalar() is not None


def _extension_exists(ext_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        "SELECT 1 FROM pg_extension WHERE extname = :name"
    ), {"name": ext_name})
    return res.scalar() is not None


def upgrade() -> None:
    # pg_trgm for ILIKE search indexes
    if not _extension_exists("pg_trgm"):
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # --- bonds ---
    # Partial index: covers the hot query pattern for all bond list views
    # WHERE is_active = TRUE AND (maturity_date IS NULL OR maturity_date >= today)
    # ORDER BY maturity_date ASC
    if not _index_exists("ix_bonds_active_maturity"):
        op.execute(
            "CREATE INDEX ix_bonds_active_maturity "
            "ON bonds(maturity_date ASC NULLS LAST) "
            "WHERE is_active = TRUE"
        )

    # Trigram indexes for ILIKE '%term%' search on isin_code and issuer
    if not _index_exists("ix_bonds_isin_trgm"):
        op.execute(
            "CREATE INDEX ix_bonds_isin_trgm "
            "ON bonds USING GIN (isin_code gin_trgm_ops)"
        )
    if not _index_exists("ix_bonds_issuer_trgm"):
        op.execute(
            "CREATE INDEX ix_bonds_issuer_trgm "
            "ON bonds USING GIN (issuer gin_trgm_ops)"
        )

    # --- user_alerts ---
    # Celery check-user-alerts task runs every 15 min filtering by (user_id, is_active)
    if not _index_exists("ix_user_alerts_user_active"):
        op.create_index(
            "ix_user_alerts_user_active",
            "user_alerts",
            ["user_id", "is_active"],
        )

    # --- refresh_tokens ---
    # Auth hot path: lookup by token_hash on every request, and by user_id for revocation
    if not _index_exists("ix_refresh_tokens_user_id"):
        op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    if not _index_exists("ix_refresh_tokens_token_hash"):
        op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])

    # --- bond_views ---
    # Analytics: "which bonds were most viewed" (bond_id) and "what did this user view" (user_id)
    if not _index_exists("ix_bond_views_bond_id"):
        op.create_index("ix_bond_views_bond_id", "bond_views", ["bond_id"])
    if not _index_exists("ix_bond_views_user_id"):
        op.create_index("ix_bond_views_user_id", "bond_views", ["user_id"])

    # --- user_mfa_backup_codes ---
    # MFA flow fetches all codes for a user to check against
    if not _index_exists("ix_user_mfa_backup_codes_user_id"):
        op.create_index(
            "ix_user_mfa_backup_codes_user_id",
            "user_mfa_backup_codes",
            ["user_id"],
        )

    # --- user_metrics ---
    # Usage tracking queries filter and upsert by (user_id, metric_date)
    if not _index_exists("ix_user_metrics_user_date"):
        op.create_index(
            "ix_user_metrics_user_date",
            "user_metrics",
            ["user_id", "metric_date"],
        )


def downgrade() -> None:
    for idx, tbl in [
        ("ix_user_metrics_user_date", "user_metrics"),
        ("ix_user_mfa_backup_codes_user_id", "user_mfa_backup_codes"),
        ("ix_bond_views_user_id", "bond_views"),
        ("ix_bond_views_bond_id", "bond_views"),
        ("ix_refresh_tokens_token_hash", "refresh_tokens"),
        ("ix_refresh_tokens_user_id", "refresh_tokens"),
        ("ix_user_alerts_user_active", "user_alerts"),
    ]:
        if _index_exists(idx):
            op.drop_index(idx, table_name=tbl)

    for idx in ["ix_bonds_issuer_trgm", "ix_bonds_isin_trgm", "ix_bonds_active_maturity"]:
        if _index_exists(idx):
            op.execute(f"DROP INDEX IF EXISTS {idx}")
