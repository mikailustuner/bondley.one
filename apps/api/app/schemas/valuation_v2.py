from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class ValuationCreate(BaseModel):
    isin: str = Field(min_length=12, max_length=12)
    settlement_date: date
    quote_type: Literal["CLEAN_PRICE", "DIRTY_PRICE", "ANNUAL_YIELD"]
    quote_value: Decimal = Field(gt=0)
    quote_date: date | None = None
    cpi_ratio: Decimal | None = Field(default=None, gt=0)
    explicit_coupon_dates: list[date] = Field(default_factory=list)


class ValuationResponse(BaseModel):
    request_id: int
    success: bool
    result: dict[str, Any] | None = None
    failure: dict[str, Any] | None = None


class InstrumentNoteUpdate(BaseModel):
    note_text: str = Field(min_length=1, max_length=10_000)


class InstrumentListResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    source: str = "BIST_TBLISTE_VERIFIED"


class ImportTrigger(BaseModel):
    source_url: str | None = None
