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


def test_trfturk42710_kap_coupon_uses_actual_91_day_annualization():
    """KAP golden: 17.04.2026-17.07.2026, 75m nominal, %11.0918."""
    result = from_periodic_coupon(
        periodic_coupon_rate=Decimal("0.110918"),
        period_start=date(2026, 4, 17),
        period_end=date(2026, 7, 17),
        coupon_frequency=4,
        full_period_year_fraction=Decimal("91") / Decimal("365"),
        calculation_as_of=date(2026, 7, 16),
    )

    assert result.periodic_coupon_rate == Decimal("0.1109180000")
    assert result.annual_simple_rate == Decimal("0.4448908791")
    assert result.annual_compound_rate == Decimal("0.5248601486")
    assert Decimal("75000000") * result.periodic_coupon_rate == Decimal(
        "8318850.0000000000"
    )


def test_trfturk42710_t_minus_one_tlref_indexes_reproduce_kap_coupon():
    result = from_index_change(
        start_index_value=Decimal("5720.26231"),
        end_index_value=Decimal("6319.08861"),
        start_index_date=date(2026, 4, 16),
        end_index_date=date(2026, 7, 16),
        period_start=date(2026, 4, 17),
        period_end=date(2026, 7, 17),
        coupon_frequency=4,
        full_period_year_fraction=Decimal("91") / Decimal("365"),
        full_period_days=91,
        elapsed_projection_days=91,
        spread_decimal=Decimal("0.025"),
        spread_annuality="ANNUAL_SIMPLE",
        calculation_as_of=date(2026, 7, 16),
        is_final=True,
    )

    assert result.periodic_coupon_rate == Decimal("0.1109179886")
    assert result.annual_simple_rate == Decimal("0.4448908334")
    assert result.annual_compound_rate == Decimal("0.5248600859")
    assert result.status == "CALCULATED_FINAL"
    assert (result.periodic_coupon_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("11.0918")


def test_trfdvys42711_t_minus_one_indexes_reproduce_kap_coupon():
    """KAP golden: 27.04.2026-27.07.2026, annual %3.75 spread."""
    result = from_index_change(
        start_index_value=Decimal("5783.07346"),
        end_index_value=Decimal("6388.49162"),
        start_index_date=date(2026, 4, 24),
        end_index_date=date(2026, 7, 24),
        period_start=date(2026, 4, 27),
        period_end=date(2026, 7, 27),
        coupon_frequency=4,
        full_period_year_fraction=Decimal("91") / Decimal("365"),
        full_period_days=91,
        elapsed_projection_days=91,
        spread_decimal=Decimal("0.0375"),
        spread_annuality="ANNUAL_SIMPLE",
        calculation_as_of=date(2026, 7, 24),
        is_final=True,
    )

    assert (result.periodic_coupon_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("11.4037")
    assert (result.annual_simple_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("45.7402")
    assert (result.annual_compound_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("54.2106")
    published_periodic_rate = Decimal("0.114037")
    assert Decimal("512300000") * published_periodic_rate == Decimal(
        "58421155.100000"
    )


def test_trsvestk2610_published_coupon_matches_kap_annual_equivalents():
    result = from_periodic_coupon(
        periodic_coupon_rate=Decimal("0.114685"),
        period_start=date(2026, 4, 28),
        period_end=date(2026, 7, 28),
        coupon_frequency=4,
        full_period_year_fraction=Decimal("91") / Decimal("365"),
        calculation_as_of=date(2026, 7, 27),
    )

    assert (result.annual_simple_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("46.0000")
    assert (result.annual_compound_rate * Decimal("100")).quantize(
        Decimal("0.0001")
    ) == Decimal("54.5706")


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
    assert result.annual_simple_rate == Decimal("0.4850270224")
    assert result.annual_compound_rate == Decimal("0.5451438646")
    assert result.status == "INDICATIVE"
    assert result.confidence == "ASSUMPTION_REQUIRED"
