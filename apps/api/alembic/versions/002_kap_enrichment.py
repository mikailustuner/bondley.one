"""KAP disclosure enrichment and derived contract terms

Revision ID: 002_kap_enrichment
Revises: 001_initial_production
Create Date: 2026-07-27
"""

from alembic import op

from app.models.kap_ingestion import (
    KapCouponEvent,
    KapDerivedTerm,
    KapDisclosure,
    KapIngestionState,
)


revision = "002_kap_enrichment"
down_revision = "001_initial_production"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    KapDisclosure.__table__.create(bind=bind, checkfirst=True)
    KapCouponEvent.__table__.create(bind=bind, checkfirst=True)
    KapDerivedTerm.__table__.create(bind=bind, checkfirst=True)
    KapIngestionState.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    KapIngestionState.__table__.drop(bind=bind, checkfirst=True)
    KapDerivedTerm.__table__.drop(bind=bind, checkfirst=True)
    KapCouponEvent.__table__.drop(bind=bind, checkfirst=True)
    KapDisclosure.__table__.drop(bind=bind, checkfirst=True)
