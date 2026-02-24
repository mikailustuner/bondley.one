"""add_onboarding_fields

Revision ID: 20260224_onboard
Revises:
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260224_onboard'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('department', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('job_title', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('usage_purpose', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('estimated_daily_views', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('profile_completed', sa.Boolean(), nullable=True, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('users', 'profile_completed')
    op.drop_column('users', 'estimated_daily_views')
    op.drop_column('users', 'usage_purpose')
    op.drop_column('users', 'job_title')
    op.drop_column('users', 'department')
