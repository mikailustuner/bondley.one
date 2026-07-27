"""ISIN-targeted KAP backfill queue

Revision ID: 003_kap_backfill_queue
Revises: 002_kap_enrichment
Create Date: 2026-07-27
"""

from alembic import op

from app.models.kap_ingestion import KapBackfillRequest


revision = "003_kap_backfill_queue"
down_revision = "002_kap_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    KapBackfillRequest.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    KapBackfillRequest.__table__.drop(bind=op.get_bind(), checkfirst=True)
