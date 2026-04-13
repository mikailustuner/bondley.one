"""add_email_verified

Revision ID: 004_add_email_verified
Revises: 003_add_onboarding
Create Date: 2026-04-13

Adds is_email_verified column to users table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004_add_email_verified'
down_revision: Union[str, None] = '003_add_onboarding'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safty check: only add if not exists
    conn = op.get_bind()
    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_email_verified'"
    ))
    if res.scalar() is None:
        op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('users', 'is_email_verified')
