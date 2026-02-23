"""add_user_mfa_fields

Revision ID: 002_add_user_mfa
Revises: 001_baseline
Create Date: 2025-02-22

User tablosuna MFA alanları ve user_mfa_backup_codes tablosu.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002_add_user_mfa"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Idempotent: skip if column exists (e.g. after create_all)
    if not _column_exists(conn, "users", "mfa_enabled"):
        op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    if not _column_exists(conn, "users", "mfa_secret_encrypted"):
        op.add_column("users", sa.Column("mfa_secret_encrypted", sa.String(255), nullable=True))

    if not _table_exists(conn, "user_mfa_backup_codes"):
        op.create_table(
            "user_mfa_backup_codes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code_hash", sa.String(64), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("idx_user_mfa_backup_codes_user_id", "user_mfa_backup_codes", ["user_id"])


def _table_exists(conn, table: str) -> bool:
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"
    ), {"t": table})
    return r.scalar() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return r.scalar() is not None


def downgrade() -> None:
    op.drop_index("idx_user_mfa_backup_codes_user_id", table_name="user_mfa_backup_codes", if_exists=True)
    op.drop_table("user_mfa_backup_codes")
    op.drop_column("users", "mfa_secret_encrypted")
    op.drop_column("users", "mfa_enabled")
