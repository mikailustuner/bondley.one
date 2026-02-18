from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class MarketDataCreate(BaseModel):
    bond_id: int
    trade_date: date
    clean_price: Decimal
    tlref_index: Decimal | None = None
    fark: Decimal | None = None
    volume: Decimal | None = None


class MarketDataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bond_id: int
    trade_date: date
    clean_price: Decimal
    tlref_index: Decimal | None
    fark: Decimal | None
    volume: Decimal | None
    created_at: datetime
