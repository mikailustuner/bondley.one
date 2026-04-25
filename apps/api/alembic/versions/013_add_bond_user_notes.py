"""add bond_user_notes table

Revision ID: 013
Revises: 012
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bond_user_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("isin_code", sa.String(30), nullable=False),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "isin_code", name="uq_bond_user_notes_user_isin"),
    )
    op.create_index("ix_bond_user_notes_isin_code", "bond_user_notes", ["isin_code"])


def downgrade() -> None:
    op.drop_index("ix_bond_user_notes_isin_code", table_name="bond_user_notes")
    op.drop_table("bond_user_notes")
