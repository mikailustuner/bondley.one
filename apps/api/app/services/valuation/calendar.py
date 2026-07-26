from __future__ import annotations

import calendar as month_calendar
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import StrEnum

from dateutil.relativedelta import relativedelta

from app.services.valuation.errors import ValuationError, ValuationFailureCode


class BusinessDayConvention(StrEnum):
    NONE = "NONE"
    FOLLOWING = "FOLLOWING"
    MODIFIED_FOLLOWING = "MODIFIED_FOLLOWING"
    PRECEDING = "PRECEDING"


@dataclass(frozen=True)
class BusinessCalendar:
    holidays: frozenset[date] = field(default_factory=frozenset)
    weekend: frozenset[int] = field(default_factory=lambda: frozenset({5, 6}))
    version: str = "TR-BUSINESS-CALENDAR-v1"

    def is_business_day(self, value: date) -> bool:
        return value.weekday() not in self.weekend and value not in self.holidays

    def adjust(
        self,
        value: date,
        convention: BusinessDayConvention = BusinessDayConvention.NONE,
    ) -> date:
        if convention == BusinessDayConvention.NONE or self.is_business_day(value):
            return value
        direction = -1 if convention == BusinessDayConvention.PRECEDING else 1
        adjusted = value
        while not self.is_business_day(adjusted):
            adjusted += timedelta(days=direction)
        if (
            convention == BusinessDayConvention.MODIFIED_FOLLOWING
            and adjusted.month != value.month
        ):
            return self.adjust(value, BusinessDayConvention.PRECEDING)
        return adjusted


def _is_month_end(value: date) -> bool:
    return value.day == month_calendar.monthrange(value.year, value.month)[1]


def _shift_months(value: date, months: int, preserve_month_end: bool) -> date:
    shifted = value + relativedelta(months=months)
    if preserve_month_end and _is_month_end(value):
        return shifted.replace(
            day=month_calendar.monthrange(shifted.year, shifted.month)[1]
        )
    return shifted


def coupon_schedule(
    *,
    issue_date: date,
    maturity_date: date,
    frequency: int,
    next_coupon_date: date | None = None,
    explicit_coupon_dates: tuple[date, ...] = (),
    business_calendar: BusinessCalendar | None = None,
    business_day_convention: BusinessDayConvention = BusinessDayConvention.NONE,
) -> list[date]:
    if issue_date >= maturity_date:
        raise ValuationError(
            ValuationFailureCode.INVALID_SCHEDULE,
            "İhraç tarihi vadeden önce olmalıdır.",
        )
    if frequency <= 0:
        raise ValuationError(
            ValuationFailureCode.INVALID_SCHEDULE,
            "Kupon sıklığı pozitif olmalıdır.",
        )

    if explicit_coupon_dates:
        dates = sorted(set(explicit_coupon_dates))
        if dates[-1] != maturity_date:
            dates.append(maturity_date)
        if any(value <= issue_date or value > maturity_date for value in dates):
            raise ValuationError(
                ValuationFailureCode.INVALID_SCHEDULE,
                "Açık kupon tarihleri ihraç-vade aralığı dışında.",
            )
    else:
        if 12 % frequency:
            raise ValuationError(
                ValuationFailureCode.MISSING_SCHEDULE,
                (
                    f"Yılda {frequency} kupon ay bazlı tekil üretilemez; "
                    "açık kupon tarihleri gereklidir."
                ),
            )
        months = 12 // frequency
        dates: list[date] = []
        if next_coupon_date is not None:
            if not issue_date < next_coupon_date <= maturity_date:
                raise ValuationError(
                    ValuationFailureCode.INVALID_SCHEDULE,
                    "Sonraki kupon tarihi ihraç-vade aralığında olmalıdır.",
                )
            preserve_month_end = _is_month_end(next_coupon_date)
            cursor = next_coupon_date
            while cursor < maturity_date:
                dates.append(cursor)
                cursor = _shift_months(cursor, months, preserve_month_end)
            dates.append(maturity_date)
        else:
            preserve_month_end = _is_month_end(maturity_date)
            backwards = [maturity_date]
            cursor = maturity_date
            while True:
                previous = _shift_months(cursor, -months, preserve_month_end)
                if previous <= issue_date:
                    break
                backwards.append(previous)
                cursor = previous
            dates = sorted(backwards)

    calendar = business_calendar or BusinessCalendar()
    adjusted = [
        calendar.adjust(value, business_day_convention)
        for value in dates
    ]
    if len(set(adjusted)) != len(adjusted):
        raise ValuationError(
            ValuationFailureCode.INVALID_SCHEDULE,
            "İş günü düzeltmesi iki kuponu aynı tarihe taşıdı.",
        )
    return adjusted
