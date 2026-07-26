from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from app.services.valuation.errors import ValuationError, ValuationFailureCode


class DayCountConvention(StrEnum):
    ACT_365F = "ACT/365F"
    ACT_360 = "ACT/360"
    ACT_ACT_ISDA = "ACT/ACT ISDA"
    THIRTY_360_US = "30/360 US"
    THIRTY_E_360 = "30E/360"


ALIASES = {
    "ACT/365": DayCountConvention.ACT_365F,
    "ACT365": DayCountConvention.ACT_365F,
    "ACTUAL/365": DayCountConvention.ACT_365F,
    "ACTUAL/365 FIXED": DayCountConvention.ACT_365F,
    "ACT/360": DayCountConvention.ACT_360,
    "ACTUAL/360": DayCountConvention.ACT_360,
    "ACT/ACT": DayCountConvention.ACT_ACT_ISDA,
    "ACTACT": DayCountConvention.ACT_ACT_ISDA,
    "ACTUAL/ACTUAL": DayCountConvention.ACT_ACT_ISDA,
    "ACTUAL/ACTUAL ISDA": DayCountConvention.ACT_ACT_ISDA,
    "30/360": DayCountConvention.THIRTY_360_US,
    "30/360 US": DayCountConvention.THIRTY_360_US,
    "30E/360": DayCountConvention.THIRTY_E_360,
    "EU30360": DayCountConvention.THIRTY_E_360,
    "EUROPEAN 30/360": DayCountConvention.THIRTY_E_360,
}


def parse_day_count(value: str | DayCountConvention | None) -> DayCountConvention:
    if isinstance(value, DayCountConvention):
        return value
    normalized = (value or "ACT/365F").strip().upper()
    try:
        return DayCountConvention(normalized)
    except ValueError:
        convention = ALIASES.get(normalized)
        if convention is None:
            raise ValuationError(
                ValuationFailureCode.UNSUPPORTED_DAY_COUNT,
                f"Desteklenmeyen gün sayım konvansiyonu: {value}",
            )
        return convention


def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def year_fraction(
    start: date,
    end: date,
    convention: str | DayCountConvention | None,
) -> Decimal:
    if end < start:
        return -year_fraction(end, start, convention)
    if end == start:
        return Decimal("0")

    parsed = parse_day_count(convention)
    actual_days = Decimal((end - start).days)
    if parsed == DayCountConvention.ACT_365F:
        return actual_days / Decimal("365")
    if parsed == DayCountConvention.ACT_360:
        return actual_days / Decimal("360")
    if parsed == DayCountConvention.THIRTY_E_360:
        d1 = min(start.day, 30)
        d2 = min(end.day, 30)
        days = (end.year - start.year) * 360 + (end.month - start.month) * 30 + d2 - d1
        return Decimal(days) / Decimal("360")
    if parsed == DayCountConvention.THIRTY_360_US:
        d1 = 30 if start.day == 31 else start.day
        d2 = 30 if end.day == 31 and d1 == 30 else end.day
        days = (end.year - start.year) * 360 + (end.month - start.month) * 30 + d2 - d1
        return Decimal(days) / Decimal("360")

    cursor = start
    result = Decimal("0")
    while cursor < end:
        boundary = min(end, date(cursor.year + 1, 1, 1))
        denominator = Decimal("366" if _is_leap(cursor.year) else "365")
        result += Decimal((boundary - cursor).days) / denominator
        cursor = boundary
    return result
