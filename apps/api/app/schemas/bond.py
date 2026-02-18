from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BondResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isin_code: str
    issuer: str | None = None
    issuance_type: str | None = None
    yield_type: str | None = None
    security_type: str | None = None
    coupon_frequency: str | None = None
    currency: str = "TRY"
    group_code: int | None = None
    first_issue_date: date | None = None
    maturity_date: date | None = None
    days_to_maturity: int | None = None
    total_issue_amount: Decimal | None = None
    last_issue_date_text: str | None = None
    last_issue_price: Decimal | None = None
    last_issue_yield: Decimal | None = None
    first_issue_yield: Decimal | None = None
    next_coupon_date: date | None = None
    next_coupon_rate: Decimal | None = None
    spread: Decimal | None = None
    first_issue_price: Decimal | None = None
    quotation_method: str | None = None
    accrued_interest_text: str | None = None
    clean_price_text: str | None = None
    dirty_price_formula: str | None = None
    settlement_price_formula: str | None = None
    yield_formula: str | None = None
    compound_yield_formula: str | None = None
    day_count_convention: str | None = None
    remarks: str | None = None
    brokerage: str | None = None
    security_type_detail: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class BondListItem(BaseModel):
    """Lightweight bond record for list views."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    isin_code: str
    issuer: str | None = None
    yield_type: str | None = None
    security_type: str | None = None
    currency: str = "TRY"
    maturity_date: date | None = None
    days_to_maturity: int | None = None
    last_issue_price: Decimal | None = None
    last_issue_yield: Decimal | None = None
    next_coupon_rate: Decimal | None = None
    day_count_convention: str | None = None
    is_active: bool = True


class BondListResponse(BaseModel):
    items: list[BondListItem]
    total: int


class BondStatsResponse(BaseModel):
    total_bonds: int
    by_security_type: dict[str, int]
    by_currency: dict[str, int]
    by_yield_type: dict[str, int]
    avg_days_to_maturity: float | None = None
