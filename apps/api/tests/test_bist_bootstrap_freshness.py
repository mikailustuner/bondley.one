from datetime import date

from app.services.bist_ingestion.bootstrap import tbliste_snapshot_is_current
from app.services.bist_ingestion.tbliste_parser import TblisteParser


def test_bootstrap_skips_current_parser_and_expected_business_date():
    assert tbliste_snapshot_is_current(
        parser_version=TblisteParser.VERSION,
        effective_date=date(2026, 7, 24),
        requested_business_date=date(2026, 7, 24),
    )


def test_bootstrap_reimports_after_cutoff_when_previous_day_is_stale():
    assert not tbliste_snapshot_is_current(
        parser_version=TblisteParser.VERSION,
        effective_date=date(2026, 7, 24),
        requested_business_date=date(2026, 7, 27),
    )


def test_bootstrap_reimports_same_snapshot_with_new_parser_version():
    assert not tbliste_snapshot_is_current(
        parser_version="tbliste-v2-1",
        effective_date=date(2026, 7, 24),
        requested_business_date=date(2026, 7, 24),
    )

