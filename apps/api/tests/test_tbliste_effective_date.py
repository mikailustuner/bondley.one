from datetime import date

from app.services.bist_ingestion.import_service import (
    resolve_tbliste_effective_date,
)


def test_pre_cutoff_filename_is_capped_to_previous_business_day():
    effective_date, origin = resolve_tbliste_effective_date(
        date(2026, 7, 27),
        date(2026, 7, 24),
    )

    assert effective_date == date(2026, 7, 24)
    assert origin == "CUTOFF_CAPPED_SOURCE_FILENAME"


def test_after_cutoff_filename_keeps_current_business_date():
    effective_date, origin = resolve_tbliste_effective_date(
        date(2026, 7, 27),
        date(2026, 7, 27),
    )

    assert effective_date == date(2026, 7, 27)
    assert origin == "SOURCE_FILENAME"


def test_older_filename_remains_stale_instead_of_being_relabelled():
    effective_date, origin = resolve_tbliste_effective_date(
        date(2026, 7, 23),
        date(2026, 7, 24),
    )

    assert effective_date == date(2026, 7, 23)
    assert origin == "SOURCE_FILENAME"

