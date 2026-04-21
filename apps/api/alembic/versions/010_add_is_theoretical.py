"""add is_theoretical to calculations

Revision ID: 010
Revises: 009
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '010'
down_revision: Union[str, None] = '009'
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
    if not _column_exists('calculations', 'is_theoretical'):
        op.add_column(
            'calculations',
            sa.Column('is_theoretical', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        )


def downgrade() -> None:
    if _column_exists('calculations', 'is_theoretical'):
        op.drop_column('calculations', 'is_theoretical')
