"""Add sukuk fields to kap_disclosure_details

Revision ID: 008
Revises: 007
Create Date: 2026-04-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    res = conn.execute(sa.text(
        f"SELECT 1 FROM information_schema.columns WHERE table_name='{table_name}' AND column_name='{column_name}'"
    ))
    return res.scalar() is not None


def upgrade() -> None:
    # Check and add fund_user to kap_disclosure_details
    if not _column_exists('kap_disclosure_details', 'fund_user'):
        op.add_column('kap_disclosure_details', sa.Column('fund_user', sa.String(length=255), nullable=True))

    # Check and add source_institution to kap_disclosure_details
    if not _column_exists('kap_disclosure_details', 'source_institution'):
        op.add_column('kap_disclosure_details', sa.Column('source_institution', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('kap_disclosure_details', 'source_institution')
    op.drop_column('kap_disclosure_details', 'fund_user')
