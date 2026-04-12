from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CalculationRequest(BaseModel):
    bond_id: int
    calc_date: date | None = None


class CalculationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bond_id: int
    calc_date: date
    dirty_price: Decimal
    accrued_interest: Decimal
    yield_to_maturity: Decimal
    spread: Decimal | None
    modified_duration: Decimal | None
    macaulay_duration: Decimal | None
    created_at: datetime


class CalculationSummary(BaseModel):
    isin_code: str
    bond_type: str
    maturity_date: date
    clean_price: Decimal
    dirty_price: Decimal
    accrued_interest: Decimal
    ytm: Decimal
    spread: Decimal | None
