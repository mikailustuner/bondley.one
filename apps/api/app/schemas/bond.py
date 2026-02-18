from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BondBase(BaseModel):
    isin_code: str
    bond_type: str
    issue_date: date
    maturity_date: date
    coupon_rate: Decimal
    coupon_frequency: int = 2
    face_value: Decimal = Decimal("100.00")
    currency: str = "TRY"


class BondCreate(BondBase):
    pass


class BondUpdate(BaseModel):
    coupon_rate: Decimal | None = None
    is_active: bool | None = None
    face_value: Decimal | None = None


class BondResponse(BondBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BondListResponse(BaseModel):
    items: list[BondResponse]
    total: int
