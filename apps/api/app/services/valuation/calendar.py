from __future__ import annotations

import calendar as month_calendar
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum

from dateutil.relativedelta import relativedelta

from app.services.valuation.errors import ValuationError, ValuationFailureCode


class BusinessDayConvention(StrEnum):
    NONE = "NONE"
    FOLLOWING = "FOLLOWING"
    MODIFIED_FOLLOWING = "MODIFIED_FOLLOWING"
    PRECEDING = "PRECEDING"


class ScheduleMethod(StrEnum):
    EXPLICIT = "EXPLICIT"
    SINGLE_PAYMENT = "SINGLE_PAYMENT"
    FIXED_DAY_ANCHORED = "FIXED_DAY_ANCHORED"
    CALENDAR_MONTH_ANCHORED = "CALENDAR_MONTH_ANCHORED"
    MATURITY_BACKWARD = "MATURITY_BACKWARD"


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


@dataclass(frozen=True)
class ScheduleInference:
    dates: tuple[date, ...]
    method: ScheduleMethod
    confidence: str
    expected_payment_count: int
    assumptions: tuple[str, ...] = ()


def _is_month_end(value: date) -> bool:
    return value.day == month_calendar.monthrange(value.year, value.month)[1]


def _shift_months(value: date, months: int, preserve_month_end: bool) -> date:
    shifted = value + relativedelta(months=months)
    if preserve_month_end and _is_month_end(value):
        return shifted.replace(
            day=month_calendar.monthrange(shifted.year, shifted.month)[1]
        )
    return shifted


def _rounded_positive(value: Decimal) -> int:
    return max(1, int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def _expected_payment_count(
    issue_date: date,
    maturity_date: date,
    frequency: int,
) -> int:
    tenor_days = Decimal((maturity_date - issue_date).days)
    return _rounded_positive(tenor_days * Decimal(frequency) / Decimal("365"))


def _anchored_candidate(
    *,
    issue_date: date,
    maturity_date: date,
    next_coupon_date: date,
    expected_count: int,
    nominal_period_days: int,
    shift,
) -> list[date]:
    cursor = next_coupon_date
    backwards: list[date] = []
    for _ in range(expected_count + 1):
        if cursor <= issue_date:
            break
        backwards.append(cursor)
        cursor = shift(cursor, -1)

    minimum_stub_days = max(1, nominal_period_days // 2)
    dates = sorted(
        {
            value
            for value in backwards
            if issue_date < value < maturity_date
            and (value - issue_date).days >= minimum_stub_days
        }
    )
    if len(dates) > expected_count - 1:
        dates = dates[-(expected_count - 1) :]

    cursor = dates[-1] if dates else next_coupon_date
    while len(dates) < expected_count - 1:
        following = shift(cursor, 1)
        if following >= maturity_date:
            break
        if following not in dates:
            dates.append(following)
        cursor = following

    return sorted(set(dates + [maturity_date]))


def _candidate_score(
    *,
    dates: list[date],
    issue_date: date,
    maturity_date: date,
    next_coupon_date: date,
    expected_count: int,
    expected_first_date: date,
) -> int:
    score = abs(len(dates) - expected_count) * 10_000
    if next_coupon_date not in dates:
        score += 5_000
    if not dates or dates[-1] != maturity_date:
        score += 5_000
    if dates:
        score += abs((dates[0] - expected_first_date).days)
    return score


def infer_coupon_schedule(
    *,
    issue_date: date,
    maturity_date: date,
    frequency: int,
    next_coupon_date: date | None = None,
    explicit_coupon_dates: tuple[date, ...] = (),
    business_calendar: BusinessCalendar | None = None,
    business_day_convention: BusinessDayConvention = BusinessDayConvention.NONE,
) -> ScheduleInference:
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
        method = ScheduleMethod.EXPLICIT
        confidence = "SOURCE_PUBLISHED"
        assumptions: tuple[str, ...] = ()
        expected_count = len(dates)
    else:
        expected_count = _expected_payment_count(issue_date, maturity_date, frequency)
        if expected_count == 1:
            dates = [maturity_date]
            method = ScheduleMethod.SINGLE_PAYMENT
            confidence = "EXACT_DERIVATION"
            assumptions = ()
        elif next_coupon_date is not None:
            if not issue_date < next_coupon_date <= maturity_date:
                raise ValuationError(
                    ValuationFailureCode.INVALID_SCHEDULE,
                    "Sonraki kupon tarihi ihraç-vade aralığında olmalıdır.",
                )
            nominal_days = _rounded_positive(Decimal("365") / Decimal(frequency))
            day_candidate = _anchored_candidate(
                issue_date=issue_date,
                maturity_date=maturity_date,
                next_coupon_date=next_coupon_date,
                expected_count=expected_count,
                nominal_period_days=nominal_days,
                shift=lambda value, direction: value
                + timedelta(days=direction * nominal_days),
            )
            day_score = _candidate_score(
                dates=day_candidate,
                issue_date=issue_date,
                maturity_date=maturity_date,
                next_coupon_date=next_coupon_date,
                expected_count=expected_count,
                expected_first_date=issue_date + timedelta(days=nominal_days),
            )

            candidates = [
                (
                    day_score,
                    ScheduleMethod.FIXED_DAY_ANCHORED,
                    day_candidate,
                )
            ]
            if 12 % frequency == 0:
                months = 12 // frequency
                preserve_month_end = _is_month_end(next_coupon_date)
                month_candidate = _anchored_candidate(
                    issue_date=issue_date,
                    maturity_date=maturity_date,
                    next_coupon_date=next_coupon_date,
                    expected_count=expected_count,
                    nominal_period_days=nominal_days,
                    shift=lambda value, direction: _shift_months(
                        value,
                        direction * months,
                        preserve_month_end,
                    ),
                )
                candidates.append(
                    (
                        _candidate_score(
                            dates=month_candidate,
                            issue_date=issue_date,
                            maturity_date=maturity_date,
                            next_coupon_date=next_coupon_date,
                            expected_count=expected_count,
                            expected_first_date=_shift_months(
                                issue_date,
                                months,
                                _is_month_end(issue_date),
                            ),
                        ),
                        ScheduleMethod.CALENDAR_MONTH_ANCHORED,
                        month_candidate,
                    )
                )
            score, method, dates = min(
                candidates,
                key=lambda item: (
                    item[0],
                    0 if item[1] == ScheduleMethod.FIXED_DAY_ANCHORED else 1,
                ),
            )
            confidence = "EXACT_DERIVATION" if score == 0 else "INFERRED"
            assumptions = (
                f"COUPON_SCHEDULE_{method.value}",
                f"EXPECTED_PAYMENT_COUNT_{expected_count}",
            )
        else:
            if 12 % frequency:
                raise ValuationError(
                    ValuationFailureCode.MISSING_SCHEDULE,
                    (
                        f"Yılda {frequency} kupon, sonraki kupon tarihi veya "
                        "açık takvim olmadan tekil üretilemez."
                    ),
                )
            months = 12 // frequency
            preserve_month_end = _is_month_end(maturity_date)
            backwards = [maturity_date]
            cursor = maturity_date
            while len(backwards) < expected_count:
                previous = _shift_months(cursor, -months, preserve_month_end)
                if previous <= issue_date:
                    break
                backwards.append(previous)
                cursor = previous
            dates = sorted(backwards)
            method = ScheduleMethod.MATURITY_BACKWARD
            confidence = "INFERRED"
            assumptions = (
                "COUPON_SCHEDULE_MATURITY_BACKWARD",
                f"EXPECTED_PAYMENT_COUNT_{expected_count}",
            )

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
    return ScheduleInference(
        dates=tuple(adjusted),
        method=method,
        confidence=confidence,
        expected_payment_count=expected_count,
        assumptions=assumptions,
    )


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
    return list(
        infer_coupon_schedule(
            issue_date=issue_date,
            maturity_date=maturity_date,
            frequency=frequency,
            next_coupon_date=next_coupon_date,
            explicit_coupon_dates=explicit_coupon_dates,
            business_calendar=business_calendar,
            business_day_convention=business_day_convention,
        ).dates
    )


def current_coupon_period(
    *,
    issue_date: date,
    settlement_date: date,
    payment_dates: list[date],
    frequency: int,
    next_coupon_date: date | None = None,
) -> tuple[date, date]:
    """Return the accrual period containing ``settlement_date``.

    A published next-coupon anchor only generates future cash flows. When that
    date is the first item in ``payment_dates``, derive the preceding coupon
    boundary by the same calendar-month convention instead of incorrectly
    treating the original issue date as the current period start.
    """
    try:
        position = next(
            index
            for index, payment_date in enumerate(payment_dates)
            if payment_date > settlement_date
        )
    except StopIteration as exc:
        raise ValuationError(
            ValuationFailureCode.INVALID_SETTLEMENT_DATE,
            "Valör tarihinde gelecekte kupon ödemesi bulunmuyor.",
        ) from exc

    period_end = payment_dates[position]
    if position > 0:
        return payment_dates[position - 1], period_end
    if next_coupon_date is None or period_end != next_coupon_date:
        return issue_date, period_end
    if 12 % frequency:
        raise ValuationError(
            ValuationFailureCode.MISSING_SCHEDULE,
            (
                f"Yılda {frequency} kupon için cari dönem başlangıcı "
                "açık kupon tarihleri olmadan belirlenemez."
            ),
        )

    previous = _shift_months(
        period_end,
        -(12 // frequency),
        _is_month_end(period_end),
    )
    return max(issue_date, previous), period_end
