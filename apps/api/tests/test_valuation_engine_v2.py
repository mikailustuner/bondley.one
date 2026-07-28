from datetime import date
from decimal import Decimal

import pytest

from app.services.valuation.calendar import (
    ScheduleMethod,
    coupon_schedule,
    current_coupon_period,
    infer_coupon_schedule,
)
from app.services.valuation.day_count import year_fraction
from app.services.valuation.engine import (
    BenchmarkInput,
    InstrumentTerms,
    PriceInput,
    QuoteType,
    RateType,
    ValuationEngine,
)
from app.services.valuation.errors import ValuationError, ValuationFailureCode
from app.services.valuation.formula_catalog import FORMULA_CATALOG


def _fixed_terms(**overrides) -> InstrumentTerms:
    values = {
        "isin": "TRTEST000044",
        "issue_date": date(2025, 1, 31),
        "maturity_date": date(2027, 1, 31),
        "coupon_frequency": 2,
        "annual_coupon_rate": Decimal("0.10"),
        "next_coupon_date": date(2025, 7, 31),
    }
    values.update(overrides)
    return InstrumentTerms(**values)


def test_schedule_uses_calendar_months_and_preserves_month_end():
    assert coupon_schedule(
        issue_date=date(2025, 1, 31),
        maturity_date=date(2026, 1, 31),
        frequency=2,
        next_coupon_date=date(2025, 7, 31),
    ) == [date(2025, 7, 31), date(2026, 1, 31)]


def test_current_period_is_derived_backwards_from_next_coupon_anchor():
    payment_dates = coupon_schedule(
        issue_date=date(2024, 10, 8),
        maturity_date=date(2026, 10, 8),
        frequency=4,
        next_coupon_date=date(2026, 10, 8),
    )
    assert current_coupon_period(
        issue_date=date(2024, 10, 8),
        settlement_date=date(2026, 7, 24),
        payment_dates=payment_dates,
        frequency=4,
        next_coupon_date=date(2026, 10, 8),
    ) == (date(2026, 7, 8), date(2026, 10, 8))


def test_current_period_backward_derivation_preserves_month_end():
    payment_dates = coupon_schedule(
        issue_date=date(2024, 2, 29),
        maturity_date=date(2026, 8, 31),
        frequency=2,
        next_coupon_date=date(2026, 8, 31),
    )
    assert current_coupon_period(
        issue_date=date(2024, 2, 29),
        settlement_date=date(2026, 7, 24),
        payment_dates=payment_dates,
        frequency=2,
        next_coupon_date=date(2026, 8, 31),
    ) == (date(2026, 2, 28), date(2026, 8, 31))


def test_trfturk42710_schedule_is_inferred_as_four_91_day_payments():
    schedule = infer_coupon_schedule(
        issue_date=date(2026, 4, 17),
        maturity_date=date(2027, 4, 16),
        frequency=4,
        next_coupon_date=date(2026, 10, 16),
    )

    assert schedule.dates == (
        date(2026, 7, 17),
        date(2026, 10, 16),
        date(2027, 1, 15),
        date(2027, 4, 16),
    )
    assert schedule.method == ScheduleMethod.FIXED_DAY_ANCHORED
    assert schedule.confidence == "EXACT_DERIVATION"
    assert schedule.expected_payment_count == 4


def test_trsvestk2610_schedule_uses_maturity_as_final_stub():
    schedule = infer_coupon_schedule(
        issue_date=date(2025, 10, 27),
        maturity_date=date(2026, 11, 5),
        frequency=4,
        next_coupon_date=date(2026, 7, 28),
    )

    assert schedule.dates == (
        date(2026, 1, 27),
        date(2026, 4, 28),
        date(2026, 7, 28),
        date(2026, 11, 5),
    )
    assert schedule.method == ScheduleMethod.FIXED_DAY_ANCHORED


def test_irregular_frequency_requires_explicit_dates():
    with pytest.raises(ValuationError) as captured:
        coupon_schedule(
            issue_date=date(2025, 1, 1),
            maturity_date=date(2026, 1, 1),
            frequency=5,
        )
    assert captured.value.code == ValuationFailureCode.MISSING_SCHEDULE


def test_day_count_golden_values():
    start = date(2024, 1, 1)
    end = date(2025, 1, 1)
    assert year_fraction(start, end, "ACT/365F") == Decimal("366") / Decimal("365")
    assert year_fraction(start, end, "ACT/ACT ISDA") == Decimal("1")
    assert year_fraction(date(2025, 1, 30), date(2025, 7, 30), "30E/360") == Decimal("0.5")
    assert year_fraction(start, end, "ACTACT") == Decimal("1")
    assert year_fraction(start, end, "ACT365") == Decimal("366") / Decimal("365")
    assert year_fraction(date(2025, 1, 30), date(2025, 7, 30), "EU30360") == Decimal("0.5")


def test_price_yield_round_trip_and_risk_metrics():
    engine = ValuationEngine()
    from_yield = engine.value(
        _fixed_terms(),
        settlement_date=date(2025, 2, 3),
        price_input=PriceInput(QuoteType.ANNUAL_YIELD, Decimal("0.12")),
    )
    from_clean = engine.value(
        _fixed_terms(),
        settlement_date=date(2025, 2, 3),
        price_input=PriceInput(QuoteType.CLEAN_PRICE, from_yield.clean_price),
    )
    assert abs(from_clean.annual_yield - Decimal("0.12")) <= Decimal("0.00000001")
    assert from_clean.modified_duration > 0
    assert from_clean.convexity > 0
    assert abs(from_clean.dirty_price - from_yield.dirty_price) <= Decimal("0.00000001")
    assert from_yield.periodic_coupon_rate == Decimal("0.0495890411")
    assert from_yield.annual_simple_coupon_rate == Decimal("0.1000000000")
    assert from_yield.annual_compound_coupon_rate == Decimal("0.1025212302")
    assert from_yield.cash_flows[0].coupon_amount == Decimal("4.9589041100")
    assert from_yield.dirty_price_origin == "CALCULATED_FROM_YIELD"
    assert from_yield.clean_price_origin == "DERIVED_DIRTY_MINUS_ACCRUED"
    assert from_clean.clean_price_origin == "INPUT_QUOTE"
    assert from_clean.dirty_price_origin == "DERIVED_CLEAN_PLUS_ACCRUED"
    assert from_clean.accrued_method == "BIST_BAP_4_1_PERIODIC_PRORATION"


def test_fixed_coupon_accrual_uses_bist_ggs_over_dgs_not_year_fraction_ratio():
    result = ValuationEngine().value(
        _fixed_terms(
            issue_date=date(2024, 7, 31),
            maturity_date=date(2025, 7, 31),
            next_coupon_date=date(2025, 1, 31),
            day_count="ACTACT",
        ),
        settlement_date=date(2024, 12, 31),
        price_input=PriceInput(QuoteType.DIRTY_PRICE, Decimal("100")),
    )

    expected_accrued = (
        Decimal("100")
        * result.periodic_coupon_rate
        * Decimal(153)
        / Decimal(184)
    )
    assert result.accrued_amount == expected_accrued.quantize(Decimal("0.00000001"))
    assert result.intermediates["accrual"]["inputs"]["ggs"] == 153
    assert result.intermediates["accrual"]["inputs"]["dgs"] == 184


def test_next_coupon_anchor_does_not_accrue_from_original_issue_date():
    result = ValuationEngine().value(
        _fixed_terms(
            issue_date=date(2024, 10, 8),
            maturity_date=date(2026, 10, 8),
            coupon_frequency=4,
            next_coupon_date=date(2026, 10, 8),
        ),
        settlement_date=date(2026, 7, 24),
        price_input=PriceInput(QuoteType.ANNUAL_YIELD, Decimal("0.12")),
    )

    assert result.cash_flows[0].accrual_start == date(2026, 7, 8)
    assert result.cash_flows[0].coupon_amount == Decimal("2.5205479500")
    assert result.periodic_coupon_rate == Decimal("0.0252054795")


def test_missing_price_is_typed_failure_not_zero():
    with pytest.raises(ValuationError) as captured:
        ValuationEngine().value(
            _fixed_terms(),
            settlement_date=date(2025, 2, 3),
            price_input=None,
        )
    assert captured.value.code == ValuationFailureCode.PRICE_REQUIRED


def test_discounted_single_payment_instrument_has_only_redemption_cash_flow():
    result = ValuationEngine().value(
        InstrumentTerms(
            isin="TRB170327T15",
            issue_date=date(2026, 4, 8),
            maturity_date=date(2027, 3, 17),
            coupon_frequency=1,
            annual_coupon_rate=Decimal("0"),
            rate_type=RateType.FIXED,
            formula_code="BAP_FIXED_RATE",
        ),
        settlement_date=date(2026, 7, 27),
        price_input=PriceInput(QuoteType.DIRTY_PRICE, Decimal("95")),
    )

    assert len(result.cash_flows) == 1
    assert result.cash_flows[0].coupon_amount == Decimal("0")
    assert result.cash_flows[0].principal_amount == Decimal("100")
    assert result.cash_flows[0].payment_date == date(2027, 3, 17)
    assert result.annual_yield > 0


def test_ambiguous_terms_produce_theoretical_result_with_explicit_warning():
    result = ValuationEngine().value(
        _fixed_terms(parse_status="AMBIGUOUS"),
        settlement_date=date(2025, 2, 3),
        price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
    )

    assert result.valuation_kind == "THEORETICAL_YTM"
    assert "SOURCE_TERMS_AMBIGUOUS" in result.valuation_assumptions
    assert result.provenance["source_parse_status"] == "AMBIGUOUS"


def test_conflicting_terms_remain_blocked():
    with pytest.raises(ValuationError) as captured:
        ValuationEngine().value(
            _fixed_terms(parse_status="CONFLICTING"),
            settlement_date=date(2025, 2, 3),
            price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
        )
    assert captured.value.code == ValuationFailureCode.AMBIGUOUS_TERMS


def test_trd_tlrefk_is_strictly_separate_from_tlref():
    terms = _fixed_terms(
        isin="TRDTEST00045",
        rate_type=RateType.TLREFK,
        annual_coupon_rate=None,
        benchmark_spread_decimal=Decimal("0.0025"),
    )
    with pytest.raises(ValuationError) as captured:
        ValuationEngine().value(
            terms,
            settlement_date=date(2025, 2, 3),
            price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
            benchmark=BenchmarkInput("TLREF", date(2025, 2, 3), Decimal("0.40")),
        )
    assert captured.value.code == ValuationFailureCode.BENCHMARK_MISMATCH

    result = ValuationEngine().value(
        terms,
        settlement_date=date(2025, 2, 3),
        price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
        benchmark=BenchmarkInput("TLREFK", date(2025, 2, 3), Decimal("0.39")),
    )
    assert result.effective_coupon_rate == Decimal("0.3925000000")


def test_cpi_requires_explicit_ratio():
    terms = _fixed_terms(rate_type=RateType.CPI)
    with pytest.raises(ValuationError) as captured:
        ValuationEngine().value(
            terms,
            settlement_date=date(2025, 2, 3),
            price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
        )
    assert captured.value.code == ValuationFailureCode.MISSING_CPI_RATIO


@pytest.mark.parametrize(
    ("formula_code", "rate_type", "benchmark", "cpi_ratio"),
    [
        ("BAP_DISCOUNTED_CASH_FLOW", RateType.FIXED, None, None),
        ("BAP_FIXED_RATE", RateType.FIXED, None, None),
        (
            "BAP_FLOATING_RATE",
            RateType.TLREF,
            BenchmarkInput("TLREF", date(2025, 2, 3), Decimal("0.40")),
            None,
        ),
        (
            "BAP_TLREF",
            RateType.TLREF,
            BenchmarkInput("TLREF", date(2025, 2, 3), Decimal("0.40")),
            None,
        ),
        (
            "BAP_TLREFK",
            RateType.TLREFK,
            BenchmarkInput("TLREFK", date(2025, 2, 3), Decimal("0.39")),
            None,
        ),
        ("BAP_CPI_LINKED", RateType.CPI, None, Decimal("1.20")),
    ],
)
def test_every_catalog_formula_has_a_golden_execution(
    formula_code,
    rate_type,
    benchmark,
    cpi_ratio,
):
    terms = _fixed_terms(
        rate_type=rate_type,
        formula_code=formula_code,
        annual_coupon_rate=(
            None if rate_type in {RateType.TLREF, RateType.TLREFK} else Decimal("0.10")
        ),
    )
    result = ValuationEngine().value(
        terms,
        settlement_date=date(2025, 2, 3),
        price_input=PriceInput(QuoteType.CLEAN_PRICE, Decimal("100")),
        benchmark=benchmark,
        cpi_ratio=cpi_ratio,
    )
    assert result.provenance["formula_code"] == formula_code
    assert result.dirty_price > 0


def test_formula_catalog_and_engine_dispatch_are_in_sync():
    assert ValuationEngine.SUPPORTED_FORMULAS == frozenset(FORMULA_CATALOG)
