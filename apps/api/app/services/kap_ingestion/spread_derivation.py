from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Mapping

from app.core.time import BistBusinessCalendar

SPREAD_DERIVATION_VERSION = "kap-spread-t1-v2"


def is_current_spread_derivation(
    *,
    confidence: str,
    observation_lag_business_days: int | None,
    evidence: Mapping[str, Any],
    expected_lag: int,
) -> bool:
    if confidence == "KAP_EXPLICIT":
        return True
    return (
        observation_lag_business_days == expected_lag
        and evidence.get("derivation_version") == SPREAD_DERIVATION_VERSION
    )


@dataclass(frozen=True)
class SpreadEvidence:
    spread_decimal: Decimal
    lag_business_days: int
    reconstructed_periodic_rate: Decimal
    error_decimal: Decimal
    period_days: int
    start_observation_date: date
    end_observation_date: date
    start_index: Decimal
    end_index: Decimal


def _exact_observation(
    observations: Mapping[date, Decimal],
    target: date,
) -> tuple[date, Decimal] | None:
    value = observations.get(target)
    if value is None:
        return None
    return target, value


def _lagged_business_day(
    boundary: date,
    lag: int,
    calendar: BistBusinessCalendar,
) -> date:
    selected = boundary
    for _ in range(lag):
        selected = calendar.previous_business_day(selected)
    return selected


def derive_annual_simple_spread(
    *,
    published_periodic_rate: Decimal,
    period_start: date,
    period_end: date,
    index_observations: Mapping[date, Decimal],
    candidate_lags: tuple[int, ...] = (1,),
    source_rounding_decimal_places: int = 6,
    business_calendar: BistBusinessCalendar | None = None,
) -> SpreadEvidence | None:
    """Derive and verify the annual simple spread reported by a KAP coupon.

    Candidates are quantized to one basis point because Turkish floating bond
    supplements ordinarily state annual simple extra yield at that precision.
    A candidate is accepted only if reconstructing the KAP periodic coupon fits
    inside half a unit of the published source's displayed precision.
    """

    days = (period_end - period_start).days
    if days <= 0:
        return None
    tolerance = Decimal(1).scaleb(-source_rounding_decimal_places) / Decimal("2")
    best: SpreadEvidence | None = None
    calendar = business_calendar or BistBusinessCalendar()
    for lag in candidate_lags:
        start = _exact_observation(
            index_observations,
            _lagged_business_day(period_start, lag, calendar),
        )
        end = _exact_observation(
            index_observations,
            _lagged_business_day(period_end, lag, calendar),
        )
        if start is None or end is None or end[0] <= start[0] or start[1] <= 0:
            continue
        index_return = end[1] / start[1] - Decimal("1")
        raw_spread = (published_periodic_rate - index_return) * Decimal("365") / Decimal(days)
        spread = raw_spread.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        reconstructed = index_return + spread * Decimal(days) / Decimal("365")
        error = abs(reconstructed - published_periodic_rate)
        evidence = SpreadEvidence(
            spread_decimal=spread,
            lag_business_days=lag,
            reconstructed_periodic_rate=reconstructed,
            error_decimal=error,
            period_days=days,
            start_observation_date=start[0],
            end_observation_date=end[0],
            start_index=start[1],
            end_index=end[1],
        )
        if best is None or evidence.error_decimal < best.error_decimal:
            best = evidence
    if best is None or best.error_decimal > tolerance:
        return None
    return best
