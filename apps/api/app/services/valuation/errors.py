from __future__ import annotations

from enum import StrEnum
from typing import Any


class ValuationFailureCode(StrEnum):
    PRICE_REQUIRED = "PRICE_REQUIRED"
    INVALID_PRICE = "INVALID_PRICE"
    INVALID_SETTLEMENT_DATE = "INVALID_SETTLEMENT_DATE"
    MISSING_SCHEDULE = "MISSING_SCHEDULE"
    INVALID_SCHEDULE = "INVALID_SCHEDULE"
    MISSING_COUPON_RATE = "MISSING_COUPON_RATE"
    MISSING_BENCHMARK = "MISSING_BENCHMARK"
    BENCHMARK_MISMATCH = "BENCHMARK_MISMATCH"
    MISSING_CPI_RATIO = "MISSING_CPI_RATIO"
    AMBIGUOUS_TERMS = "AMBIGUOUS_TERMS"
    UNSUPPORTED_FORMULA = "UNSUPPORTED_FORMULA"
    UNSUPPORTED_DAY_COUNT = "UNSUPPORTED_DAY_COUNT"
    NO_ROOT = "NO_ROOT"
    NUMERIC_FAILURE = "NUMERIC_FAILURE"


class ValuationError(ValueError):
    def __init__(
        self,
        code: ValuationFailureCode,
        message: str,
        *,
        context: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.context = context or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code.value,
            "message": str(self),
            "context": self.context,
        }
