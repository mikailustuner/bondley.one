from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class TLREFRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rate_date: date
    index_value: Decimal
    daily_rate: Decimal | None = None
    published_annual_rate_pct: Decimal | None = None
    source: str
    created_at: datetime


class TLREFRateListResponse(BaseModel):
    items: list[TLREFRateResponse]
    total: int
