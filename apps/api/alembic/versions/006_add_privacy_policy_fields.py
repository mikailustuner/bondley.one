"""Add privacy policy acceptance fields to users table

Revision ID: 006
Revises: 005
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005_add_missing_columns"
branch_labels = None
depends_on = None



def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        f"SELECT 1 FROM information_schema.columns WHERE table_name='{table_name}' AND column_name='{column_name}'"
    ))
    return res.scalar() is not None


def upgrade() -> None:
    if not _column_exists('users', 'privacy_policy_accepted'):
        op.add_column("users", sa.Column("privacy_policy_accepted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    if not _column_exists('users', 'privacy_policy_accepted_at'):
        op.add_column("users", sa.Column("privacy_policy_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "privacy_policy_accepted_at")
    op.drop_column("users", "privacy_policy_accepted")
