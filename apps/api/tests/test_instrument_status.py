from datetime import date

from app.core.instrument_status import (
    is_instrument_active,
    matches_instrument_status,
)


TODAY = date(2026, 7, 30)


def test_instrument_remains_active_through_maturity_date():
    assert is_instrument_active(TODAY, current_date=TODAY) is True
    assert matches_instrument_status(
        TODAY,
        current_date=TODAY,
        status="active",
    )


def test_trfmngf72629_moves_to_archive_day_after_maturity():
    maturity_date = date(2026, 7, 29)

    assert is_instrument_active(maturity_date, current_date=TODAY) is False
    assert matches_instrument_status(
        maturity_date,
        current_date=TODAY,
        status="matured",
    )
    assert not matches_instrument_status(
        maturity_date,
        current_date=TODAY,
        status="active",
    )


def test_unknown_maturity_is_active_and_all_includes_every_status():
    assert is_instrument_active(None, current_date=TODAY) is True
    assert matches_instrument_status(
        None,
        current_date=TODAY,
        status="active",
    )
    assert matches_instrument_status(
        date(2026, 7, 29),
        current_date=TODAY,
        status="all",
    )
