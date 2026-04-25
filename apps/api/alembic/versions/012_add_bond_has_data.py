"""add has_data flag to bonds for fast with_data_only filtering

Revision ID: 012
Revises: 011
Create Date: 2026-04-25

Replaces the expensive Bond.calculations.any() correlated subquery with a
simple boolean column that is set to TRUE after a calculation is written.

Deployment order: run migration first, then deploy updated application code.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '012'
down_revision: Union[str, None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'bonds',
        sa.Column('has_data', sa.Boolean(), server_default='false', nullable=False),
    )
    # Backfill existing bonds that already have calculations
    op.execute(
        "UPDATE bonds SET has_data = TRUE "
        "WHERE id IN (SELECT DISTINCT bond_id FROM calculations)"
    )
    # Partial index: only bonds where has_data=TRUE are queried in the list endpoint
    op.execute(
        "CREATE INDEX ix_bonds_has_data ON bonds(id) WHERE has_data = TRUE"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bonds_has_data")
    op.drop_column('bonds', 'has_data')
