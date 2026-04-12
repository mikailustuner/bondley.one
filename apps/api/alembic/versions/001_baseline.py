"""baseline

Revision ID: 001_baseline
Revises:
Create Date: 2025-02-22

Mevcut şemayı versiyonlamak için boş revision. Mevcut DB'de:
  alembic stamp 001_baseline
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
