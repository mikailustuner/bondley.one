"""add published_annual_rate_pct to tlref_rates

Revision ID: 009
Revises: 008
Create Date: 2026-04-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        f"SELECT 1 FROM information_schema.columns "
        f"WHERE table_name='{table_name}' AND column_name='{column_name}'"
    ))
    return res.scalar() is not None


def upgrade() -> None:
    if not _column_exists('tlref_rates', 'published_annual_rate_pct'):
        op.add_column(
            'tlref_rates',
            sa.Column('published_annual_rate_pct', sa.Numeric(10, 4), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('tlref_rates', 'published_annual_rate_pct')
