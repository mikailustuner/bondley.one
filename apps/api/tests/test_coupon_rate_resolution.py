import asyncio
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.api.v2.verified import (
    _next_business_day,
    _on_or_previous_business_day,
    _resolve_coupon_rate_metrics,
)
from app.services.valuation.engine import RateType


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
    assert result.annual_simple_rate == Decimal("0.4757251343")
    assert result.annual_compound_rate == Decimal("0.5323037352")
    assert result.status == "INDICATIVE"
    assert result.confidence == "ASSUMPTION_REQUIRED"


def test_index_coupon_resolution_returns_none_when_no_period_time_has_elapsed():
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
            benchmark_input=None,
        )
    )

    assert result is None
