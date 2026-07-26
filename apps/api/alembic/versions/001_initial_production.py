"""clean verified production schema

Revision ID: 001_initial_production
Revises:
Create Date: 2026-07-26

This is the intentionally squashed pre-production baseline. Deployments that
used the retired legacy schema must be recreated from a verified backup rather
than stamped onto this revision.
"""

from alembic import op

from app.core.base import Base
import app.models  # noqa: F401


revision = "001_initial_production"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision is the immutable pre-production snapshot of the retained
    # model metadata. Future schema changes must use new Alembic revisions.
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=False)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=True)
