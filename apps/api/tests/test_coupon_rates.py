from datetime import date
from decimal import Decimal

from app.services.valuation.coupon_rates import (
    from_index_change,
    from_periodic_coupon,
)


def test_published_periodic_coupon_has_simple_and_compound_equivalents():
    result = from_periodic_coupon(
        periodic_coupon_rate=Decimal("0.05"),
        period_start=date(2026, 1, 1),
        period_end=date(2026, 7, 2),
        coupon_frequency=2,
        full_period_year_fraction=Decimal("0.5"),
        calculation_as_of=date(2026, 6, 30),
    )

    assert result.periodic_coupon_rate == Decimal("0.0500000000")
    assert result.annual_simple_rate == Decimal("0.1000000000")
    assert result.annual_compound_rate == Decimal("0.1025000000")
    assert result.status == "PUBLISHED"
    assert result.is_final is True


def test_index_change_coupon_annualizes_reference_before_adding_annual_spread():
    result = from_index_change(
        start_index_value=Decimal("1000"),
        end_index_value=Decimal("1050"),
        start_index_date=date(2026, 1, 1),
        end_index_date=date(2026, 7, 2),
        period_start=date(2026, 1, 1),
        period_end=date(2026, 7, 2),
        coupon_frequency=2,
        full_period_year_fraction=Decimal("0.5"),
        full_period_days=182,
        elapsed_projection_days=182,
        spread_decimal=Decimal("0.02"),
        spread_annuality="ANNUAL_SIMPLE",
        calculation_as_of=date(2026, 7, 2),
        is_final=True,
    )

    assert result.reference_period_return == Decimal("0.0500000000")
    assert result.annualized_reference_rate == Decimal("0.1000000000")
    assert result.annual_simple_rate == Decimal("0.1200000000")
    assert result.periodic_coupon_rate == Decimal("0.0600000000")
    assert result.annual_compound_rate == Decimal("0.1236000000")
    assert result.status == "CALCULATED_FINAL"
    assert result.confidence == "EXACT_CONTRACT"


def test_periodic_spread_is_not_added_as_an_annual_spread():
    result = from_index_change(
        start_index_value=Decimal("1000"),
        end_index_value=Decimal("1050"),
        start_index_date=date(2026, 1, 1),
        end_index_date=date(2026, 7, 2),
        period_start=date(2026, 1, 1),
        period_end=date(2026, 7, 2),
        coupon_frequency=2,
        full_period_year_fraction=Decimal("0.5"),
        full_period_days=182,
        elapsed_projection_days=182,
        spread_decimal=Decimal("0.01"),
        spread_annuality="PERIODIC",
        calculation_as_of=date(2026, 7, 2),
        is_final=True,
    )

    assert result.annual_simple_rate == Decimal("0.1200000000")
    assert result.periodic_coupon_rate == Decimal("0.0600000000")


def test_unqualified_spread_is_visible_as_an_assumption():
    result = from_index_change(
        start_index_value=Decimal("1000"),
        end_index_value=Decimal("1010"),
        start_index_date=date(2026, 1, 1),
        end_index_date=date(2026, 4, 2),
        period_start=date(2026, 1, 1),
        period_end=date(2026, 7, 2),
        coupon_frequency=2,
        full_period_year_fraction=Decimal("0.5"),
        full_period_days=182,
        elapsed_projection_days=91,
        spread_decimal=Decimal("0.02"),
        spread_annuality="UNKNOWN",
        calculation_as_of=date(2026, 4, 2),
        is_final=False,
    )

    assert result.annualized_reference_rate == Decimal("0.0402000000")
    assert result.annual_simple_rate == Decimal("0.0602000000")
    assert result.periodic_coupon_rate == Decimal("0.0301000000")
    assert result.status == "INDICATIVE"
    assert result.confidence == "ASSUMPTION_REQUIRED"
    assert result.assumptions == ("UNQUALIFIED_SPREAD_TREATED_AS_ANNUAL_SIMPLE",)


def test_trfdeko72613_official_2026_07_24_inputs_are_reproducible():
    """Golden values from BIST tbliste and BIST TLREF index dated 24 July 2026."""
    result = from_index_change(
        start_index_value=Decimal("5288.00445"),
        end_index_value=Decimal("6388.49162"),
        start_index_date=date(2026, 1, 30),
        end_index_date=date(2026, 7, 24),
        period_start=date(2026, 1, 30),
        period_end=date(2026, 7, 28),
        coupon_frequency=2,
        full_period_year_fraction=Decimal("179") / Decimal("365"),
        full_period_days=179,
        elapsed_projection_days=175,
        spread_decimal=Decimal("0.05"),
        spread_annuality="UNKNOWN",
        calculation_as_of=date(2026, 7, 24),
        is_final=False,
    )

    assert result.periodic_coupon_rate == Decimal("0.2378625672")
    assert result.annual_simple_rate == Decimal("0.4757251343")
    assert result.annual_compound_rate == Decimal("0.5323037352")
    assert result.status == "INDICATIVE"
    assert result.confidence == "ASSUMPTION_REQUIRED"
