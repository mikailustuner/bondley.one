from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from typing import Any, Literal

from app.services.valuation.errors import ValuationError, ValuationFailureCode


CouponRateStatus = Literal["PUBLISHED", "CALCULATED_FINAL", "INDICATIVE"]
CouponRateConfidence = Literal["SOURCE_PUBLISHED", "EXACT_CONTRACT", "ASSUMPTION_REQUIRED"]
SpreadAnnuality = Literal["ANNUAL_SIMPLE", "PERIODIC", "UNKNOWN"]

RATE_QUANTUM = Decimal("0.0000000001")


@dataclass(frozen=True)
class CouponRateMetrics:
    """Canonical coupon-rate representations.

    All rate values are decimals: ``0.05`` means 5%. ``periodic_coupon_rate``
    is the amount paid per nominal unit for the complete coupon period.
    """

    periodic_coupon_rate: Decimal
    annual_simple_rate: Decimal
    annual_compound_rate: Decimal
    status: CouponRateStatus
    confidence: CouponRateConfidence
    is_final: bool
    period_start: date
    period_end: date
    coupon_frequency: int
    full_period_year_fraction: Decimal
    calculation_as_of: date
    calculation_method: str
    reference_period_return: Decimal | None = None
    projected_reference_period_return: Decimal | None = None
    annualized_reference_rate: Decimal | None = None
    full_period_days: int | None = None
    elapsed_projection_days: int | None = None
    spread_decimal: Decimal = Decimal("0")
    spread_annuality: SpreadAnnuality = "UNKNOWN"
    start_index_value: Decimal | None = None
    end_index_value: Decimal | None = None
    start_index_date: date | None = None
    end_index_date: date | None = None
    assumptions: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in asdict(self).items():
            if isinstance(value, Decimal):
                result[key] = str(value)
            elif isinstance(value, date):
                result[key] = value.isoformat()
            elif isinstance(value, tuple):
                result[key] = list(value)
            else:
                result[key] = value
        return result


def _decimal(value: Decimal | str | int, name: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValuationError(
            ValuationFailureCode.NUMERIC_FAILURE,
            f"{name} sayısal değil.",
        ) from exc
    if not result.is_finite():
        raise ValuationError(
            ValuationFailureCode.NUMERIC_FAILURE,
            f"{name} sonlu olmalıdır.",
        )
    return result


def _validate_period(
    period_start: date,
    period_end: date,
    coupon_frequency: int,
    full_period_year_fraction: Decimal,
) -> tuple[int, Decimal]:
    factor = _decimal(full_period_year_fraction, "full_period_year_fraction")
    if period_end <= period_start or coupon_frequency <= 0 or factor <= 0:
        raise ValuationError(
            ValuationFailureCode.INVALID_SCHEDULE,
            "Kupon dönemi, sıklığı ve gün sayım kesri pozitif olmalıdır.",
        )
    return coupon_frequency, factor


def annual_compound_equivalent(
    periodic_rate: Decimal,
    coupon_frequency: int,
) -> Decimal:
    periodic = _decimal(periodic_rate, "periodic_coupon_rate")
    if coupon_frequency <= 0 or Decimal("1") + periodic <= 0:
        raise ValuationError(
            ValuationFailureCode.NUMERIC_FAILURE,
            "Bileşik oran için kupon sıklığı ve bileşik tabanı pozitif olmalıdır.",
        )
    with localcontext() as context:
        context.prec = 40
        result = (Decimal("1") + periodic) ** coupon_frequency - Decimal("1")
    return result.quantize(RATE_QUANTUM)


def from_periodic_coupon(
    *,
    periodic_coupon_rate: Decimal,
    period_start: date,
    period_end: date,
    coupon_frequency: int,
    full_period_year_fraction: Decimal,
    calculation_as_of: date,
    status: CouponRateStatus = "PUBLISHED",
    confidence: CouponRateConfidence = "SOURCE_PUBLISHED",
    is_final: bool = True,
    assumptions: tuple[str, ...] = (),
) -> CouponRateMetrics:
    frequency, factor = _validate_period(
        period_start,
        period_end,
        coupon_frequency,
        full_period_year_fraction,
    )
    periodic = _decimal(periodic_coupon_rate, "periodic_coupon_rate")
    annual_simple = periodic * Decimal(frequency)
    return CouponRateMetrics(
        periodic_coupon_rate=periodic.quantize(RATE_QUANTUM),
        annual_simple_rate=annual_simple.quantize(RATE_QUANTUM),
        annual_compound_rate=annual_compound_equivalent(periodic, frequency),
        status=status,
        confidence=confidence,
        is_final=is_final,
        period_start=period_start,
        period_end=period_end,
        coupon_frequency=frequency,
        full_period_year_fraction=factor,
        calculation_as_of=calculation_as_of,
        calculation_method="BIST_BAP_PERIODIC_COUPON_ANNUALIZATION",
        assumptions=assumptions,
    )


def from_annual_simple_coupon(
    *,
    annual_simple_rate: Decimal,
    period_start: date,
    period_end: date,
    coupon_frequency: int,
    full_period_year_fraction: Decimal,
    calculation_as_of: date,
    status: CouponRateStatus = "INDICATIVE",
    confidence: CouponRateConfidence = "EXACT_CONTRACT",
    is_final: bool = False,
    assumptions: tuple[str, ...] = (),
) -> CouponRateMetrics:
    frequency, factor = _validate_period(
        period_start,
        period_end,
        coupon_frequency,
        full_period_year_fraction,
    )
    annual_simple = _decimal(annual_simple_rate, "annual_simple_rate")
    periodic = annual_simple / Decimal(frequency)
    return CouponRateMetrics(
        periodic_coupon_rate=periodic.quantize(RATE_QUANTUM),
        annual_simple_rate=annual_simple.quantize(RATE_QUANTUM),
        annual_compound_rate=annual_compound_equivalent(periodic, frequency),
        status=status,
        confidence=confidence,
        is_final=is_final,
        period_start=period_start,
        period_end=period_end,
        coupon_frequency=frequency,
        full_period_year_fraction=factor,
        calculation_as_of=calculation_as_of,
        calculation_method="BIST_BAP_ANNUAL_SIMPLE_TO_PERIODIC",
        assumptions=assumptions,
    )


def from_index_change(
    *,
    start_index_value: Decimal,
    end_index_value: Decimal,
    start_index_date: date,
    end_index_date: date,
    period_start: date,
    period_end: date,
    coupon_frequency: int,
    full_period_year_fraction: Decimal,
    full_period_days: int,
    elapsed_projection_days: int,
    spread_decimal: Decimal,
    spread_annuality: SpreadAnnuality,
    calculation_as_of: date,
    is_final: bool,
) -> CouponRateMetrics:
    frequency, full_factor = _validate_period(
        period_start,
        period_end,
        coupon_frequency,
        full_period_year_fraction,
    )
    start_index = _decimal(start_index_value, "start_index_value")
    end_index = _decimal(end_index_value, "end_index_value")
    spread = _decimal(spread_decimal, "spread_decimal")
    if (
        start_index <= 0
        or end_index <= 0
        or full_period_days <= 0
        or elapsed_projection_days <= 0
    ):
        raise ValuationError(
            ValuationFailureCode.NUMERIC_FAILURE,
            "Endeks değerleri ve dönem gün sayıları pozitif olmalıdır.",
        )

    assumptions: tuple[str, ...] = ()
    confidence: CouponRateConfidence = "EXACT_CONTRACT"
    effective_annuality = spread_annuality
    if spread_annuality == "UNKNOWN":
        # Unqualified market spreads are conventionally annual simple. The
        # assumption is never hidden: it lowers confidence and is serialized.
        effective_annuality = "ANNUAL_SIMPLE"
        confidence = "ASSUMPTION_REQUIRED"
        assumptions = ("UNQUALIFIED_SPREAD_TREATED_AS_ANNUAL_SIMPLE",)

    with localcontext() as context:
        context.prec = 40
        reference_period_return = end_index / start_index - Decimal("1")
        if is_final:
            projected_reference_return = reference_period_return
        else:
            projected_reference_return = (
                (end_index / start_index)
                ** (Decimal(full_period_days) / Decimal(elapsed_projection_days))
                - Decimal("1")
            )
        if effective_annuality == "PERIODIC":
            periodic_spread = spread
        else:
            periodic_spread = spread * full_factor
        periodic = projected_reference_return + periodic_spread
        annual_simple = periodic * Decimal(frequency)
        annualized_reference = projected_reference_return * Decimal(frequency)

    return CouponRateMetrics(
        periodic_coupon_rate=periodic.quantize(RATE_QUANTUM),
        annual_simple_rate=annual_simple.quantize(RATE_QUANTUM),
        annual_compound_rate=annual_compound_equivalent(periodic, frequency),
        status="CALCULATED_FINAL" if is_final else "INDICATIVE",
        confidence=confidence,
        is_final=is_final,
        period_start=period_start,
        period_end=period_end,
        coupon_frequency=frequency,
        full_period_year_fraction=full_factor,
        calculation_as_of=calculation_as_of,
        calculation_method="BIST_KYD_TLREF_INDEX_PERIOD_PROJECTION",
        reference_period_return=reference_period_return.quantize(RATE_QUANTUM),
        projected_reference_period_return=projected_reference_return.quantize(
            RATE_QUANTUM
        ),
        annualized_reference_rate=annualized_reference.quantize(RATE_QUANTUM),
        full_period_days=full_period_days,
        elapsed_projection_days=elapsed_projection_days,
        spread_decimal=spread.quantize(RATE_QUANTUM),
        spread_annuality=spread_annuality,
        start_index_value=start_index,
        end_index_value=end_index,
        start_index_date=start_index_date,
        end_index_date=end_index_date,
        assumptions=assumptions,
    )
