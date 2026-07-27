from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ValuationCreate(BaseModel):
    isin: str = Field(min_length=12, max_length=12)
    settlement_date: date
    quote_type: Literal["CLEAN_PRICE", "DIRTY_PRICE", "ANNUAL_YIELD"]
    quote_value: Decimal = Field(gt=0)
    quote_source: Literal["USER_INPUT", "SYSTEM_NOMINAL_100"] = "USER_INPUT"
    quote_date: date | None = None
    cpi_ratio: Decimal | None = Field(default=None, gt=0)
    explicit_coupon_dates: list[date] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_system_nominal_quote(self) -> "ValuationCreate":
        if self.quote_source == "SYSTEM_NOMINAL_100" and (
            self.quote_type not in {"CLEAN_PRICE", "DIRTY_PRICE"}
            or self.quote_value != Decimal("100")
        ):
            raise ValueError(
                "SYSTEM_NOMINAL_100 yalnız CLEAN_PRICE/DIRTY_PRICE ve 100 değeriyle kullanılabilir."
            )
        return self


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
