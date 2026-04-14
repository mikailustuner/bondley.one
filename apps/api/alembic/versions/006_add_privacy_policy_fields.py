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


def upgrade() -> None:
    op.add_column("users", sa.Column("privacy_policy_accepted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("privacy_policy_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "privacy_policy_accepted_at")
    op.drop_column("users", "privacy_policy_accepted")
