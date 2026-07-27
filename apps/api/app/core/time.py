from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


TURKEY_TIMEZONE_NAME = "Europe/Istanbul"
TURKEY_TZ = ZoneInfo(TURKEY_TIMEZONE_NAME)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def turkey_now() -> datetime:
    return utc_now().astimezone(TURKEY_TZ)


def turkey_today() -> date:
    return turkey_now().date()


def parse_holiday_list(value: str) -> frozenset[date]:
    if not value.strip():
        return frozenset()
    holidays: set[date] = set()
    for raw in value.split(","):
        candidate = raw.strip()
        if candidate:
            holidays.add(date.fromisoformat(candidate))
    return frozenset(holidays)


def parse_local_time(value: str) -> time:
    try:
        hour, minute = value.strip().split(":", maxsplit=1)
        return time(hour=int(hour), minute=int(minute))
    except (TypeError, ValueError) as exc:
        raise ValueError("Time must use HH:MM format") from exc


@dataclass(frozen=True)
class BusinessDateResolution:
    local_now: datetime
    requested_business_date: date
    reason: str
    publication_ready_time: time


class BistBusinessCalendar:
    """BIST-oriented date resolver using Turkey local time.

    Fixed full-day national holidays are included. Religious holidays and
    exchange-specific closures must be supplied through ``extra_holidays`` so
    the deployment can use the official annual BIST calendar.
    """

    _FIXED_HOLIDAYS = {
        (1, 1),
        (4, 23),
        (5, 1),
        (5, 19),
        (7, 15),
        (8, 30),
        (10, 29),
    }

    def __init__(
        self,
        *,
        extra_holidays: frozenset[date] | set[date] | None = None,
        publication_ready_time: time = time(16, 5),
    ) -> None:
        self.extra_holidays = frozenset(extra_holidays or ())
        self.publication_ready_time = publication_ready_time

    def is_business_day(self, candidate: date) -> bool:
        if candidate.weekday() >= 5:
            return False
        if (candidate.month, candidate.day) in self._FIXED_HOLIDAYS:
            return False
        return candidate not in self.extra_holidays

    def previous_business_day(self, candidate: date) -> date:
        current = candidate - timedelta(days=1)
        while not self.is_business_day(current):
            current -= timedelta(days=1)
        return current

    def resolve_expected_source_date(
        self,
        now: datetime | None = None,
    ) -> BusinessDateResolution:
        local_now = (now or turkey_now()).astimezone(TURKEY_TZ)
        local_date = local_now.date()
        if not self.is_business_day(local_date):
            return BusinessDateResolution(
                local_now=local_now,
                requested_business_date=self.previous_business_day(local_date),
                reason="NON_BUSINESS_DAY",
                publication_ready_time=self.publication_ready_time,
            )
        if local_now.timetz().replace(tzinfo=None) < self.publication_ready_time:
            return BusinessDateResolution(
                local_now=local_now,
                requested_business_date=self.previous_business_day(local_date),
                reason="BEFORE_PUBLICATION_CUTOFF",
                publication_ready_time=self.publication_ready_time,
            )
        return BusinessDateResolution(
            local_now=local_now,
            requested_business_date=local_date,
            reason="CURRENT_BUSINESS_DAY_AFTER_CUTOFF",
            publication_ready_time=self.publication_ready_time,
        )
