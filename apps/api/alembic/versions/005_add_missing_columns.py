"""add_missing_columns

Revision ID: 005_add_missing_columns
Revises: 004_add_email_verified
Create Date: 2026-04-13

Adds fund_user and source_institution to bonds table.
Ensures is_email_verified exists in users table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005_add_missing_columns'
down_revision: Union[str, None] = '004_add_email_verified'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        f"SELECT 1 FROM information_schema.columns WHERE table_name='{table_name}' AND column_name='{column_name}'"
    ))
    return res.scalar() is not None


def upgrade() -> None:
    # 1. Check/Add users.is_email_verified
    if not _column_exists('users', 'is_email_verified'):
        op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 2. Check/Add bonds.fund_user
    if not _column_exists('bonds', 'fund_user'):
        op.add_column('bonds', sa.Column('fund_user', sa.String(255), nullable=True))

    # 3. Check/Add bonds.source_institution
    if not _column_exists('bonds', 'source_institution'):
        op.add_column('bonds', sa.Column('source_institution', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('bonds', 'source_institution')
    op.drop_column('bonds', 'fund_user')
    op.drop_column('users', 'is_email_verified')
