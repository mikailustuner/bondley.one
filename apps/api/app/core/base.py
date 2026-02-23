"""SQLAlchemy DeclarativeBase. Import from here when you need Base without loading the async engine (e.g. Alembic env.py)."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
