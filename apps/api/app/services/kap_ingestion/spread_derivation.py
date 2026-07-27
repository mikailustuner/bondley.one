from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Mapping


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


def _on_or_before(
    observations: Mapping[date, Decimal],
    target: date,
) -> tuple[date, Decimal] | None:
    candidates = sorted(day for day in observations if day <= target)
    if not candidates:
        return None
    selected = candidates[-1]
    return selected, observations[selected]


def _lagged_weekday(boundary: date, lag: int) -> date:
    selected = boundary
    for _ in range(lag):
        selected = selected.fromordinal(selected.toordinal() - 1)
        while selected.weekday() >= 5:
            selected = selected.fromordinal(selected.toordinal() - 1)
    return selected


def derive_annual_simple_spread(
    *,
    published_periodic_rate: Decimal,
    period_start: date,
    period_end: date,
    index_observations: Mapping[date, Decimal],
    candidate_lags: tuple[int, ...] = (0, 1, 2),
    source_rounding_decimal_places: int = 6,
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
    for lag in candidate_lags:
        start = _on_or_before(index_observations, _lagged_weekday(period_start, lag))
        end = _on_or_before(index_observations, _lagged_weekday(period_end, lag))
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
