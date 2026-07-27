import asyncio
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.api.v2.verified import (
    _next_business_day,
    _on_or_previous_business_day,
    _resolve_coupon_rate_metrics,
)
from app.services.bist_ingestion.remarks_parser import RemarksParser
from app.services.valuation.engine import BenchmarkInput, RateType


class _IndexSession:
    def __init__(self, *observations):
        self.observations = list(observations)

    async def scalar(self, _query):
        return self.observations.pop(0)


def test_index_projection_business_day_boundaries_cover_weekends():
    assert _next_business_day(date(2026, 7, 24)) == date(2026, 7, 27)
    assert _on_or_previous_business_day(date(2026, 7, 26)) == date(2026, 7, 24)


def test_index_coupon_resolution_uses_schedule_and_official_index_observations():
    result = asyncio.run(
        _resolve_coupon_rate_metrics(
            _IndexSession(
                SimpleNamespace(
                    observation_date=date(2026, 1, 30),
                    index_value=Decimal("5288.00445"),
                ),
                SimpleNamespace(
                    observation_date=date(2026, 7, 24),
                    index_value=Decimal("6388.49162"),
                ),
            ),
            fields={
                "next_coupon_date": "2026-07-28",
                "next_coupon_rate_pct": "0.0",
                "day_count_convention": "ACTACT",
            },
            ast={
                "benchmark_mode": "INDEX_CHANGE",
                "spread_annuality": "UNKNOWN",
                "spreads": [{"decimal": "0.05"}],
                "observation_lags": [],
            },
            rate_type=RateType.TLREF,
            issue_date=date(2026, 1, 30),
            maturity_date=date(2026, 7, 28),
            coupon_frequency=2,
            settlement_date=date(2026, 7, 24),
            explicit_coupon_dates=(),
            benchmark_input=None,
        )
    )

    assert result is not None
    assert result.period_start == date(2026, 1, 30)
    assert result.period_end == date(2026, 7, 28)
    assert result.periodic_coupon_rate == Decimal("0.2378625672")
    assert result.annual_simple_rate == Decimal("0.4850270224")
    assert result.annual_compound_rate == Decimal("0.5451438646")
    assert result.status == "INDICATIVE"
    assert result.confidence == "ASSUMPTION_REQUIRED"


def test_index_coupon_resolution_uses_rate_proxy_when_no_index_time_has_elapsed():
    result = asyncio.run(
        _resolve_coupon_rate_metrics(
            _IndexSession(
                SimpleNamespace(
                    observation_date=date(2026, 1, 30),
                    index_value=Decimal("5288.00445"),
                ),
                SimpleNamespace(
                    observation_date=date(2026, 1, 30),
                    index_value=Decimal("5288.00445"),
                ),
            ),
            fields={
                "next_coupon_date": "2026-07-30",
                "next_coupon_rate_pct": "0.0",
                "day_count_convention": "ACTACT",
            },
            ast={
                "benchmark_mode": "INDEX_CHANGE",
                "spread_annuality": "ANNUAL_SIMPLE",
                "spreads": [{"decimal": "0.05"}],
                "observation_lags": [],
            },
            rate_type=RateType.TLREF,
            issue_date=date(2025, 7, 30),
            maturity_date=date(2027, 7, 30),
            coupon_frequency=2,
            settlement_date=date(2026, 1, 30),
            explicit_coupon_dates=(),
            benchmark_input=BenchmarkInput(
                name="TLREF",
                observation_date=date(2026, 1, 30),
                annual_rate_decimal=Decimal("0.399410"),
            ),
        )
    )

    assert result is not None
    assert result.status == "INDICATIVE"
    assert result.annual_simple_rate == Decimal("0.4494100000")
    assert result.periodic_coupon_rate == Decimal("0.2228581096")
    assert result.assumptions == ("INDEX_CHANGE_UNAVAILABLE_TLREF_RATE_PROXY",)


def test_trfdvys42711_period_start_proxy_uses_tlref_plus_annual_spread():
    ast = RemarksParser().parse(
        "BİST TLREF Endeksi Değişimi +%3,75 Ek Getiri",
        isin="TRFDVYS42711",
        yield_type="Değişken / Variable-TLREF e Dayalı/Indexed to TLREF",
    ).ast
    result = asyncio.run(
        _resolve_coupon_rate_metrics(
            _IndexSession(
                SimpleNamespace(
                    observation_date=date(2026, 7, 24),
                    index_value=Decimal("6388.49162"),
                ),
                SimpleNamespace(
                    observation_date=date(2026, 7, 24),
                    index_value=Decimal("6388.49162"),
                ),
            ),
            fields={
                "next_coupon_date": "2026-10-26",
                "next_coupon_rate_pct": "0.0",
                "day_count_convention": "ACTACT",
            },
            ast=ast,
            rate_type=RateType.TLREF,
            issue_date=date(2026, 4, 27),
            maturity_date=date(2027, 4, 2),
            coupon_frequency=4,
            settlement_date=date(2026, 7, 27),
            explicit_coupon_dates=(),
            benchmark_input=BenchmarkInput(
                name="TLREF",
                observation_date=date(2026, 7, 24),
                annual_rate_decimal=Decimal("0.399410"),
            ),
        )
    )

    assert result is not None
    assert result.period_start == date(2026, 7, 27)
    assert result.period_end == date(2026, 10, 26)
    assert result.annual_simple_rate == Decimal("0.4369100000")
    assert result.periodic_coupon_rate == Decimal("0.1089282466")
    assert result.assumptions == ("INDEX_CHANGE_UNAVAILABLE_TLREF_RATE_PROXY",)
