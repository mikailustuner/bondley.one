from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class TLREFRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rate_date: date
    rate_value: Decimal
    isin: str
    source: str
    created_at: datetime


class TLREFRateListResponse(BaseModel):
    items: list[TLREFRateResponse]
    total: int
