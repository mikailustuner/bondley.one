from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, localcontext
from typing import Any

from app.services.valuation.coupon_rates import CouponRateMetrics
from app.services.valuation.day_count import (
    DayCountConvention,
    annual_day_basis,
    day_count_days,
)
from app.services.valuation.errors import ValuationError, ValuationFailureCode


@dataclass(frozen=True)
class AccrualResult:
    amount: Decimal
    rate_decimal: Decimal
    method: str
    inputs: dict[str, Any]


def calculate_accrual(
    *,
    nominal: Decimal,
    settlement_date: date,
    convention: DayCountConvention,
    rate_type: str,
    coupon_metrics: CouponRateMetrics,
) -> AccrualResult:
    """Calculate accrued interest/rent independently from coupon projection.

    BIST BAP 4.1 prorates a periodic coupon with GGS/DGS. BIST BAP 4.4
    instead uses the index return realised through T-m plus the annual simple
    spread accrued through settlement. The latter must never be obtained by
    prorating a projected full-period coupon.
    """

    period_start = coupon_metrics.period_start
    period_end = coupon_metrics.period_end
    ggs = day_count_days(period_start, settlement_date, convention)
    dgs = day_count_days(period_start, period_end, convention)
    common_inputs: dict[str, Any] = {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "settlement_date": settlement_date.isoformat(),
        "ggs": ggs,
        "dgs": dgs,
        "day_count": convention.value,
    }
    if ggs <= 0:
        return AccrualResult(
            amount=Decimal("0"),
            rate_decimal=Decimal("0"),
            method="BIST_BAP_COUPON_BOUNDARY_ZERO",
            inputs=common_inputs,
        )
    if dgs <= 0:
        raise ValuationError(
            ValuationFailureCode.INVALID_SCHEDULE,
            "İşlemiş tutar için kupon dönemi gün sayısı pozitif olmalıdır.",
        )

    is_index_change = (
        rate_type in {"TLREF", "TLREFK"}
        and coupon_metrics.start_index_value is not None
        and coupon_metrics.end_index_value is not None
        and coupon_metrics.elapsed_projection_days is not None
        and coupon_metrics.elapsed_projection_days > 0
    )
    if is_index_change:
        start_index = coupon_metrics.start_index_value
        end_index = coupon_metrics.end_index_value
        assert start_index is not None
        assert end_index is not None
        assert coupon_metrics.elapsed_projection_days is not None
        if start_index <= 0 or end_index <= 0:
            raise ValuationError(
                ValuationFailureCode.NUMERIC_FAILURE,
                "İşlemiş tutar için endeks değerleri pozitif olmalıdır.",
            )
        eg = coupon_metrics.elapsed_projection_days
        with localcontext() as context:
            context.prec = 40
            index_coefficient = context.power(
                end_index / start_index,
                Decimal(ggs) / Decimal(eg),
            )
            realised_reference = index_coefficient - Decimal("1")
            if coupon_metrics.spread_annuality == "PERIODIC":
                spread_accrual = (
                    coupon_metrics.spread_decimal
                    * Decimal(ggs)
                    / Decimal(dgs)
                )
            else:
                ygs = annual_day_basis(convention)
                spread_accrual = (
                    coupon_metrics.spread_decimal
                    * Decimal(ggs)
                    / Decimal(ygs)
                )
            accrued_rate = realised_reference + spread_accrual
        inputs = {
            **common_inputs,
            "ygs": annual_day_basis(convention),
            "eg": eg,
            "observation_lag_business_days": (
                coupon_metrics.observation_lag_business_days
            ),
            "start_index_date": (
                coupon_metrics.start_index_date.isoformat()
                if coupon_metrics.start_index_date
                else None
            ),
            "end_index_date": (
                coupon_metrics.end_index_date.isoformat()
                if coupon_metrics.end_index_date
                else None
            ),
            "start_index_value": str(start_index),
            "end_index_value": str(end_index),
            "index_coefficient": str(index_coefficient),
            "realised_reference_rate": str(realised_reference),
            "spread_decimal": str(coupon_metrics.spread_decimal),
            "spread_annuality": coupon_metrics.spread_annuality,
            "spread_accrual_rate": str(spread_accrual),
        }
        return AccrualResult(
            amount=nominal * accrued_rate,
            rate_decimal=accrued_rate,
            method="BIST_BAP_4_4_INDEX_CHANGE",
            inputs=inputs,
        )

    fraction = min(Decimal(ggs) / Decimal(dgs), Decimal("1"))
    accrued_rate = coupon_metrics.periodic_coupon_rate * fraction
    return AccrualResult(
        amount=nominal * accrued_rate,
        rate_decimal=accrued_rate,
        method="BIST_BAP_4_1_PERIODIC_PRORATION",
        inputs={
            **common_inputs,
            "periodic_coupon_rate": str(coupon_metrics.periodic_coupon_rate),
            "accrual_fraction": str(fraction),
        },
    )
