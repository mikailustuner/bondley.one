from datetime import date
from decimal import Decimal

import pytest

from app.api.v2.verified import (
    _coupon_frequency,
    _default_quote_type,
    _rate_type,
    _spread,
)
from app.services.bist_ingestion.remarks_parser import RemarksParser
from app.services.valuation.calendar import ScheduleMethod, infer_coupon_schedule
from app.services.valuation.coupon_rates import from_index_change
from app.services.valuation.engine import QuoteType, RateType
from app.services.valuation.engine import (
    BenchmarkInput,
    InstrumentTerms,
    PriceInput,
    ValuationEngine,
)


ACCURACY_MATRIX = [
    {
        "isin": "TRSVESTK2610",
        "issue": date(2025, 10, 27),
        "maturity": date(2026, 11, 5),
        "frequency": 4,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable",
        "remarks": "",
        "quote": "Temiz Fiyat/Clean Price",
        "rate_type": RateType.FLOATING,
        "spread": Decimal("0"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (date(2026, 7, 28), date(2026, 11, 5)),
    },
    {
        "isin": "TRSTISB72712",
        "issue": date(2017, 8, 8),
        "maturity": date(2027, 7, 27),
        "frequency": 4,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable",
        "remarks": "",
        "quote": "Temiz Fiyat/Clean Price",
        "rate_type": RateType.FLOATING,
        "spread": Decimal("0"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (
            date(2026, 7, 28),
            date(2026, 10, 27),
            date(2027, 1, 26),
            date(2027, 4, 27),
            date(2027, 7, 27),
        ),
    },
    {
        "isin": "TRFDEKO72613",
        "issue": date(2026, 1, 30),
        "maturity": date(2026, 7, 28),
        "frequency": 2,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
        "remarks": "BIST TLREF Endeksi Değişimi + %5",
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREF,
        "spread": Decimal("0.05"),
        "method": ScheduleMethod.SINGLE_PAYMENT,
        "future_from_2026_07_27": (date(2026, 7, 28),),
    },
    {
        "isin": "TRFBLKME2621",
        "issue": date(2026, 4, 30),
        "maturity": date(2026, 10, 26),
        "frequency": 4,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
        "remarks": "TLREF + 75bps",
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREF,
        "spread": Decimal("0.0075"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (date(2026, 7, 28), date(2026, 10, 26)),
    },
    {
        "isin": "TRFTURKE2617",
        "issue": date(2025, 11, 5),
        "maturity": date(2026, 10, 23),
        "frequency": 4,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
        "remarks": (
            "BIST TLREF Endeksi Değişimi + 425 baz puan ek getiri "
            "(ek getiri yıllıktır)"
        ),
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREF,
        "spread": Decimal("0.0425"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (date(2026, 7, 28), date(2026, 10, 23)),
    },
    {
        "isin": "TRDGLVK92627",
        "issue": date(2025, 9, 25),
        "maturity": date(2026, 9, 29),
        "frequency": 12,
        "next_coupon": date(2026, 7, 28),
        "yield_type": "Değişken / Variable-TLREFK e Dayalı/Indexed to TLREFK",
        "remarks": "TLREFK",
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREFK,
        "spread": Decimal("0"),
        "method": ScheduleMethod.CALENDAR_MONTH_ANCHORED,
        "future_from_2026_07_27": (
            date(2026, 7, 28),
            date(2026, 8, 28),
            date(2026, 9, 29),
        ),
    },
    {
        "isin": "TRSDVYS42714",
        "issue": date(2025, 4, 28),
        "maturity": date(2027, 4, 26),
        "frequency": 4,
        "next_coupon": date(2026, 10, 26),
        "yield_type": "Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
        "remarks": "BİST TLREF+550bp",
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREF,
        "spread": Decimal("0.055"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (
            date(2026, 10, 26),
            date(2027, 1, 25),
            date(2027, 4, 26),
        ),
    },
    {
        "isin": "TRFDVYS42711",
        "issue": date(2026, 4, 27),
        "maturity": date(2027, 4, 2),
        "frequency": 4,
        "next_coupon": date(2026, 10, 26),
        "yield_type": "Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
        "remarks": "BİST TLREF Endeksi Değişimi +%3,75 Ek Getiri",
        "quote": "Kirli Fiyat/Dirty Price",
        "rate_type": RateType.TLREF,
        "spread": Decimal("0.0375"),
        "method": ScheduleMethod.FIXED_DAY_ANCHORED,
        "future_from_2026_07_27": (
            date(2026, 10, 26),
            date(2027, 1, 25),
            date(2027, 4, 2),
        ),
    },
]


@pytest.mark.parametrize("case", ACCURACY_MATRIX, ids=lambda case: case["isin"])
def test_instrument_contract_and_schedule_matrix(case):
    parsed = RemarksParser().parse(
        case["remarks"],
        isin=case["isin"],
        spread_raw=None,
        yield_type=case["yield_type"],
    )
    fields = {
        "yield_type_raw": case["yield_type"],
        "quotation_method": case["quote"],
        "coupon_frequency_per_year": case["frequency"],
        "next_coupon_date": case["next_coupon"].isoformat(),
    }
    rate_type = _rate_type(case["isin"], parsed.ast, fields)
    schedule = infer_coupon_schedule(
        issue_date=case["issue"],
        maturity_date=case["maturity"],
        frequency=case["frequency"],
        next_coupon_date=case["next_coupon"],
    )
    future = tuple(
        payment
        for payment in schedule.dates
        if payment > date(2026, 7, 27)
    )

    assert rate_type == case["rate_type"]
    assert _spread(parsed.ast) == case["spread"]
    assert schedule.method == case["method"]
    assert future == case["future_from_2026_07_27"]
    assert _default_quote_type(fields) == (
        QuoteType.DIRTY_PRICE
        if "Kirli" in case["quote"]
        else QuoteType.CLEAN_PRICE
    )


@pytest.mark.parametrize(
    "fields",
    [
        {
            "yield_type_raw": "İskontolu / Discounted",
            "coupon_frequency_per_year": None,
        },
        {
            "yield_type_raw": "TÜFE'ye endeksli / Indexed to CPI",
            "related_security_raw": "TRT070727T13",
            "coupon_frequency_per_year": None,
        },
        {
            "yield_type_raw": "TÜFE'ye endeksli / Indexed to CPI",
            "coupon_frequency_per_year": None,
            "next_coupon_date": None,
        },
    ],
)
def test_discounted_and_separated_cash_flows_are_single_payment_instruments(fields):
    assert _coupon_frequency(fields) == 1
    assert _rate_type("TRT070727K12", {}, fields) == RateType.FIXED


def test_trfdvys42711_theoretical_dirty_100_scenario():
    result = ValuationEngine().value(
        InstrumentTerms(
            isin="TRFDVYS42711",
            issue_date=date(2026, 4, 27),
            maturity_date=date(2027, 4, 2),
            coupon_frequency=4,
            annual_coupon_rate=None,
            rate_type=RateType.TLREF,
            benchmark_spread_decimal=Decimal("0.0375"),
            day_count="ACTACT",
            next_coupon_date=date(2026, 10, 26),
            parse_status="AMBIGUOUS",
            formula_code="BAP_TLREF",
        ),
        settlement_date=date(2026, 7, 27),
        price_input=PriceInput(
            QuoteType.DIRTY_PRICE,
            Decimal("100"),
            source="SYSTEM_NOMINAL_100",
        ),
        benchmark=BenchmarkInput(
            name="TLREF",
            observation_date=date(2026, 7, 24),
            annual_rate_decimal=Decimal("0.399410"),
        ),
    )

    assert result.effective_coupon_rate == Decimal("0.4369100000")
    assert result.periodic_coupon_rate == Decimal("0.1089282466")
    assert result.annual_yield == Decimal("0.4384505560")
    assert [flow.payment_date for flow in result.cash_flows] == [
        date(2026, 10, 26),
        date(2027, 1, 25),
        date(2027, 4, 2),
    ]
    assert "SOURCE_TERMS_AMBIGUOUS" in result.valuation_assumptions


def test_trdqnbv82713_verified_spread_theoretical_dirty_100_scenario():
    coupon_metrics = from_index_change(
        start_index_value=Decimal("3641.86408"),
        end_index_value=Decimal("3951.11584"),
        start_index_date=date(2026, 5, 12),
        end_index_date=date(2026, 7, 24),
        period_start=date(2026, 5, 13),
        period_end=date(2026, 8, 12),
        coupon_frequency=4,
        full_period_year_fraction=Decimal(91) / Decimal(365),
        full_period_days=91,
        elapsed_projection_days=75,
        spread_decimal=Decimal("0.0115"),
        spread_annuality="ANNUAL_SIMPLE",
        calculation_as_of=date(2026, 7, 24),
        is_final=False,
    )
    result = ValuationEngine().value(
        InstrumentTerms(
            isin="TRDQNBV82713",
            issue_date=date(2025, 8, 13),
            maturity_date=date(2027, 8, 11),
            coupon_frequency=4,
            annual_coupon_rate=coupon_metrics.annual_simple_rate,
            rate_type=RateType.TLREFK,
            benchmark_spread_decimal=Decimal("0.0115"),
            day_count="ACTACT",
            next_coupon_date=date(2026, 8, 12),
            parse_status="AMBIGUOUS",
            formula_code="BAP_TLREFK",
            coupon_rate_metrics=coupon_metrics,
        ),
        settlement_date=date(2026, 7, 27),
        price_input=PriceInput(
            QuoteType.DIRTY_PRICE,
            Decimal("100"),
            source="SYSTEM_NOMINAL_100",
        ),
    )

    assert coupon_metrics.projected_reference_period_return == Decimal("0.1039443532")
    assert result.periodic_coupon_rate == Decimal("0.1068114765")
    assert result.annual_simple_coupon_rate == Decimal("0.4284196586")
    assert result.annual_compound_coupon_rate == Decimal("0.5023770495")
    assert result.accrued_amount == Decimal("8.72788022")
    assert result.clean_price == Decimal("91.27211978")
    assert result.accrued_method == "BIST_BAP_4_4_INDEX_CHANGE"
    assert result.dirty_price_origin == "INPUT_QUOTE"
    assert result.clean_price_origin == "DERIVED_DIRTY_MINUS_ACCRUED"
    assert result.intermediates["accrual"]["inputs"]["end_index_date"] == "2026-07-24"
    assert result.intermediates["accrual"]["inputs"]["observation_lag_business_days"] == 1
    assert result.annual_yield == Decimal("0.5433806412")
    assert "SOURCE_TERMS_AMBIGUOUS" in result.valuation_assumptions


def _trfmngf72629_terms() -> InstrumentTerms:
    coupon_metrics = from_index_change(
        start_index_value=Decimal("5795.74891"),
        end_index_value=Decimal("6402.46709"),
        start_index_date=date(2026, 4, 28),
        end_index_date=date(2026, 7, 28),
        period_start=date(2026, 4, 29),
        period_end=date(2026, 7, 29),
        coupon_frequency=4,
        full_period_year_fraction=Decimal(91) / Decimal(365),
        full_period_days=91,
        elapsed_projection_days=91,
        spread_decimal=Decimal("0.0375"),
        spread_annuality="ANNUAL_SIMPLE",
        calculation_as_of=date(2026, 7, 28),
        is_final=True,
    )
    return InstrumentTerms(
        isin="TRFMNGF72629",
        issue_date=date(2026, 1, 28),
        maturity_date=date(2026, 7, 29),
        coupon_frequency=4,
        annual_coupon_rate=coupon_metrics.annual_simple_rate,
        rate_type=RateType.TLREF,
        benchmark_spread_decimal=Decimal("0.0375"),
        day_count="ACTACT",
        next_coupon_date=date(2026, 7, 29),
        formula_code="BAP_TLREF",
        coupon_rate_metrics=coupon_metrics,
    )


def test_trfmngf72629_clean_100_one_day_to_maturity_golden_result():
    result = ValuationEngine().value(
        _trfmngf72629_terms(),
        settlement_date=date(2026, 7, 28),
        price_input=PriceInput(
            QuoteType.CLEAN_PRICE,
            Decimal("100"),
            source="SYSTEM_NOMINAL_100",
        ),
    )

    assert result.periodic_coupon_rate == Decimal("0.1140326251")
    assert result.annual_simple_coupon_rate == Decimal("0.4573836062")
    assert result.annual_compound_coupon_rate == Decimal("0.5420803387")
    assert result.accrued_amount == Decimal("11.27219657")
    assert result.clean_price == Decimal("100.00000000")
    assert result.dirty_price == Decimal("111.27219657")
    assert result.annual_yield == Decimal("0.4536019198")
    assert result.ytm_status == "CALCULATED"
    assert result.ytm_failure_code is None


def test_trfmngf72629_extreme_dirty_quote_keeps_partial_result_without_ytm():
    result = ValuationEngine().value(
        _trfmngf72629_terms(),
        settlement_date=date(2026, 7, 28),
        price_input=PriceInput(QuoteType.DIRTY_PRICE, Decimal("100")),
    )

    assert result.periodic_coupon_rate == Decimal("0.1140326251")
    assert result.accrued_amount == Decimal("11.27219657")
    assert result.clean_price == Decimal("88.72780343")
    assert result.dirty_price == Decimal("100.00000000")
    assert result.annual_yield is None
    assert result.macaulay_duration is None
    assert result.modified_duration is None
    assert result.convexity is None
    assert result.ytm_status == "UNAVAILABLE_OUT_OF_RANGE"
    assert result.ytm_failure_code == "NO_ROOT"
    assert "YTM_UNAVAILABLE_OUT_OF_SAFE_RANGE" in result.valuation_assumptions
    assert result.to_dict()["annual_yield"] is None
    assert result.to_dict()["cash_flows"][0].get("present_value") is None
