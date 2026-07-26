from datetime import date, datetime, time, timezone

from app.core.time import BistBusinessCalendar, TURKEY_TZ, parse_holiday_list


def local(year: int, month: int, day: int, hour: int, minute: int = 0):
    return datetime(year, month, day, hour, minute, tzinfo=TURKEY_TZ)


def test_sunday_resolves_to_friday():
    calendar = BistBusinessCalendar()
    result = calendar.resolve_expected_source_date(local(2026, 7, 26, 12))
    assert result.requested_business_date == date(2026, 7, 24)
    assert result.reason == "NON_BUSINESS_DAY"


def test_monday_before_publication_resolves_to_friday():
    calendar = BistBusinessCalendar(publication_ready_time=time(16, 15))
    result = calendar.resolve_expected_source_date(local(2026, 7, 27, 10))
    assert result.requested_business_date == date(2026, 7, 24)
    assert result.reason == "BEFORE_PUBLICATION_CUTOFF"


def test_business_day_after_publication_resolves_to_today():
    calendar = BistBusinessCalendar(publication_ready_time=time(16, 15))
    result = calendar.resolve_expected_source_date(local(2026, 7, 27, 16, 16))
    assert result.requested_business_date == date(2026, 7, 27)


def test_configured_exchange_holiday_is_skipped():
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list("2026-07-27")
    )
    result = calendar.resolve_expected_source_date(local(2026, 7, 27, 18))
    assert result.requested_business_date == date(2026, 7, 24)


def test_utc_boundary_is_converted_to_turkey_before_date_resolution():
    calendar = BistBusinessCalendar(publication_ready_time=time(0, 0))
    utc_value = datetime(2026, 7, 26, 22, 30, tzinfo=timezone.utc)
    result = calendar.resolve_expected_source_date(utc_value)
    assert result.local_now.date() == date(2026, 7, 27)
    assert result.requested_business_date == date(2026, 7, 27)


def test_fixed_national_holiday_is_not_a_business_day():
    calendar = BistBusinessCalendar()
    assert not calendar.is_business_day(date(2026, 10, 29))
