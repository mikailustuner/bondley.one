from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from enum import StrEnum
from typing import Any

from app.services.valuation.accrual import calculate_accrual
from app.services.valuation.calendar import (
    BusinessCalendar,
    BusinessDayConvention,
    current_coupon_period,
    infer_coupon_schedule,
)
from app.services.valuation.coupon_rates import CouponRateMetrics, from_annual_simple_coupon
from app.services.valuation.day_count import DayCountConvention, parse_day_count, year_fraction
from app.services.valuation.errors import ValuationError, ValuationFailureCode
from app.services.valuation.formula_catalog import FORMULA_CATALOG


class RateType(StrEnum):
    FIXED = "FIXED"
    FLOATING = "FLOATING"
    TLREF = "TLREF"
    TLREFK = "TLREFK"
    CPI = "CPI"


class QuoteType(StrEnum):
    CLEAN_PRICE = "CLEAN_PRICE"
    DIRTY_PRICE = "DIRTY_PRICE"
    ANNUAL_YIELD = "ANNUAL_YIELD"


@dataclass(frozen=True)
class BenchmarkInput:
    name: str
    observation_date: date
    annual_rate_decimal: Decimal
    source_file_id: int | None = None
    source_row: int | None = None


@dataclass(frozen=True)
class PriceInput:
    quote_type: QuoteType
    value: Decimal
    source: str = "USER_INPUT"


@dataclass(frozen=True)
class InstrumentTerms:
    isin: str
    issue_date: date
    maturity_date: date
    coupon_frequency: int
    annual_coupon_rate: Decimal | None
    rate_type: RateType = RateType.FIXED
    benchmark_spread_decimal: Decimal = Decimal("0")
    nominal: Decimal = Decimal("100")
    day_count: DayCountConvention | str = DayCountConvention.ACT_365F
    next_coupon_date: date | None = None
    explicit_coupon_dates: tuple[date, ...] = ()
    business_day_convention: BusinessDayConvention = BusinessDayConvention.NONE
    parse_status: str = "EXACT"
    formula_code: str = "BAP_DISCOUNTED_CASH_FLOW"
    source_file_id: int | None = None
    source_row: int | None = None
    parser_version: str | None = None
    coupon_rate_metrics: CouponRateMetrics | None = None
    valuation_assumptions: tuple[str, ...] = ()


@dataclass(frozen=True)
class CashFlow:
    payment_date: date
    coupon_amount: Decimal
    principal_amount: Decimal
    total_amount: Decimal
    accrual_start: date
    accrual_end: date
    year_fraction: Decimal
    rate_status: str
    discount_time: Decimal | None = None
    present_value: Decimal | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            key: (value.isoformat() if isinstance(value, date) else str(value))
            for key, value in asdict(self).items()
            if value is not None
        }


@dataclass
class ValuationResult:
    engine_version: str
    settlement_date: date
    quote_type: QuoteType
    quote_value: Decimal
    quote_source: str
    clean_price: Decimal
    dirty_price: Decimal
    clean_price_origin: str
    dirty_price_origin: str
    accrued_amount: Decimal
    accrued_method: str
    annual_yield: Decimal | None
    ytm_status: str
    ytm_failure_code: str | None
    ytm_message: str | None
    macaulay_duration: Decimal | None
    modified_duration: Decimal | None
    convexity: Decimal | None
    effective_coupon_rate: Decimal
    periodic_coupon_rate: Decimal
    annual_simple_coupon_rate: Decimal
    annual_compound_coupon_rate: Decimal
    coupon_rate_status: str
    coupon_rate_confidence: str
    coupon_rate_is_final: bool
    valuation_kind: str
    cash_flow_rate_policy: str
    valuation_assumptions: tuple[str, ...]
    cash_flows: list[CashFlow]
    intermediates: dict[str, Any] = field(default_factory=dict)
    provenance: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        def decimal_or_none(value: Decimal | None) -> str | None:
            return str(value) if value is not None else None

        return {
            "engine_version": self.engine_version,
            "settlement_date": self.settlement_date.isoformat(),
            "quote_type": self.quote_type.value,
            "quote_value": str(self.quote_value),
            "quote_source": self.quote_source,
            "clean_price": str(self.clean_price),
            "dirty_price": str(self.dirty_price),
            "clean_price_origin": self.clean_price_origin,
            "dirty_price_origin": self.dirty_price_origin,
            "accrued_amount": str(self.accrued_amount),
            "accrued_method": self.accrued_method,
            "annual_yield": decimal_or_none(self.annual_yield),
            "ytm_status": self.ytm_status,
            "ytm_failure_code": self.ytm_failure_code,
            "ytm_message": self.ytm_message,
            "macaulay_duration": decimal_or_none(self.macaulay_duration),
            "modified_duration": decimal_or_none(self.modified_duration),
            "convexity": decimal_or_none(self.convexity),
            "effective_coupon_rate": str(self.effective_coupon_rate),
            "periodic_coupon_rate": str(self.periodic_coupon_rate),
            "annual_simple_coupon_rate": str(self.annual_simple_coupon_rate),
            "annual_compound_coupon_rate": str(self.annual_compound_coupon_rate),
            "coupon_rate_status": self.coupon_rate_status,
            "coupon_rate_confidence": self.coupon_rate_confidence,
            "coupon_rate_is_final": self.coupon_rate_is_final,
            "valuation_kind": self.valuation_kind,
            "cash_flow_rate_policy": self.cash_flow_rate_policy,
            "valuation_assumptions": list(self.valuation_assumptions),
            "cash_flows": [item.to_dict() for item in self.cash_flows],
            "intermediates": self.intermediates,
            "provenance": self.provenance,
        }


class ValuationEngine:
    VERSION = "valuation-engine-v3.1.0"
    SUPPORTED_FORMULAS = frozenset(FORMULA_CATALOG)
    PRICE_QUANTUM = Decimal("0.00000001")
    RATE_QUANTUM = Decimal("0.0000000001")

    def __init__(self, business_calendar: BusinessCalendar | None = None):
        self.business_calendar = business_calendar or BusinessCalendar()

    def value(
        self,
        terms: InstrumentTerms,
        *,
        settlement_date: date,
        price_input: PriceInput | None,
        benchmark: BenchmarkInput | None = None,
        cpi_ratio: Decimal | None = None,
    ) -> ValuationResult:
        self._validate(terms, settlement_date, price_input)
        convention = parse_day_count(terms.day_count)
        effective_rate, indexed_nominal = self._effective_rate_and_nominal(
            terms,
            benchmark,
            cpi_ratio,
        )
        schedule = infer_coupon_schedule(
            issue_date=terms.issue_date,
            maturity_date=terms.maturity_date,
            frequency=terms.coupon_frequency,
            next_coupon_date=terms.next_coupon_date,
            explicit_coupon_dates=terms.explicit_coupon_dates,
            business_calendar=self.business_calendar,
            business_day_convention=terms.business_day_convention,
        )
        dates = list(schedule.dates)
        coupon_metrics = terms.coupon_rate_metrics
        if coupon_metrics is None:
            period_start, period_end = current_coupon_period(
                issue_date=terms.issue_date,
                settlement_date=settlement_date,
                payment_dates=dates,
                frequency=terms.coupon_frequency,
                next_coupon_date=terms.next_coupon_date,
            )
            coupon_metrics = from_annual_simple_coupon(
                annual_simple_rate=effective_rate,
                period_start=period_start,
                period_end=period_end,
                coupon_frequency=terms.coupon_frequency,
                full_period_year_fraction=year_fraction(
                    period_start,
                    period_end,
                    convention,
                ),
                calculation_as_of=settlement_date,
                status="INDICATIVE",
                confidence="EXACT_CONTRACT",
                is_final=False,
            )
        all_flows = self._cash_flows(
            terms,
            dates,
            convention,
            effective_rate,
            indexed_nominal,
            settlement_date,
            coupon_metrics,
        )
        future_flows = [item for item in all_flows if item.payment_date > settlement_date]
        if not future_flows:
            raise ValuationError(
                ValuationFailureCode.INVALID_SETTLEMENT_DATE,
                "Valör tarihinde gelecekte nakit akışı bulunmuyor.",
            )
        accrual = calculate_accrual(
            nominal=indexed_nominal,
            settlement_date=settlement_date,
            convention=convention,
            rate_type=terms.rate_type.value,
            coupon_metrics=coupon_metrics,
        )
        accrued = accrual.amount
        assert price_input is not None
        quote_value = self._decimal(price_input.value, "quote_value")
        annual_yield: Decimal | None
        ytm_status = "CALCULATED"
        ytm_failure_code: str | None = None
        ytm_message: str | None = None
        if price_input.quote_type == QuoteType.CLEAN_PRICE:
            clean_price = quote_value
            dirty_price = clean_price + accrued
            clean_price_origin = "INPUT_QUOTE"
            dirty_price_origin = "DERIVED_CLEAN_PLUS_ACCRUED"
        elif price_input.quote_type == QuoteType.DIRTY_PRICE:
            dirty_price = quote_value
            clean_price = dirty_price - accrued
            dirty_price_origin = "INPUT_QUOTE"
            clean_price_origin = "DERIVED_DIRTY_MINUS_ACCRUED"
            if clean_price <= 0:
                raise ValuationError(
                    ValuationFailureCode.INVALID_PRICE,
                    "Kirli fiyat, işlemiş tutardan büyük olmalıdır.",
                )
        else:
            annual_yield = quote_value
            dirty_price, discounted = self._price_from_yield(
                future_flows,
                settlement_date,
                annual_yield,
                terms.coupon_frequency,
                convention,
            )
            clean_price = dirty_price - accrued
            dirty_price_origin = "CALCULATED_FROM_YIELD"
            clean_price_origin = "DERIVED_DIRTY_MINUS_ACCRUED"
            future_flows = discounted

        if price_input.quote_type != QuoteType.ANNUAL_YIELD:
            try:
                annual_yield = self._solve_yield(
                    future_flows,
                    settlement_date,
                    dirty_price,
                    terms.coupon_frequency,
                    convention,
                )
            except ValuationError as exc:
                if exc.code != ValuationFailureCode.NO_ROOT:
                    raise
                annual_yield = None
                ytm_status = "UNAVAILABLE_OUT_OF_RANGE"
                ytm_failure_code = exc.code.value
                ytm_message = (
                    "Bu fiyat ve nakit akışı için güvenli getiri aralığında "
                    "YTM kökü bulunamadı."
                )

        if annual_yield is not None:
            reconstructed_dirty, discounted = self._price_from_yield(
                future_flows,
                settlement_date,
                annual_yield,
                terms.coupon_frequency,
                convention,
            )
        else:
            reconstructed_dirty = dirty_price
            discounted = future_flows

        if (
            price_input.quote_type != QuoteType.ANNUAL_YIELD
            and annual_yield is not None
        ):
            supplied_dirty = (
                quote_value
                if price_input.quote_type == QuoteType.DIRTY_PRICE
                else quote_value + accrued
            )
            if abs(reconstructed_dirty - supplied_dirty) > Decimal("0.000001"):
                raise ValuationError(
                    ValuationFailureCode.NUMERIC_FAILURE,
                    "Fiyat-getiri round-trip toleransı aşıldı.",
                    context={
                        "supplied_dirty": str(supplied_dirty),
                        "reconstructed_dirty": str(reconstructed_dirty),
                    },
                )
            dirty_price = supplied_dirty
            clean_price = dirty_price - accrued

        if annual_yield is not None:
            macaulay, modified, convexity = self._risk_metrics(
                discounted,
                dirty_price,
                annual_yield,
                terms.coupon_frequency,
            )
        else:
            macaulay = modified = convexity = None
        valuation_assumptions = terms.valuation_assumptions
        if terms.parse_status == "AMBIGUOUS":
            valuation_assumptions += ("SOURCE_TERMS_AMBIGUOUS",)
        if annual_yield is None:
            valuation_assumptions += ("YTM_UNAVAILABLE_OUT_OF_SAFE_RANGE",)
        valuation_assumptions = tuple(dict.fromkeys(valuation_assumptions))
        return ValuationResult(
            engine_version=self.VERSION,
            settlement_date=settlement_date,
            quote_type=price_input.quote_type,
            quote_value=quote_value,
            quote_source=price_input.source,
            clean_price=clean_price.quantize(self.PRICE_QUANTUM),
            dirty_price=dirty_price.quantize(self.PRICE_QUANTUM),
            clean_price_origin=clean_price_origin,
            dirty_price_origin=dirty_price_origin,
            accrued_amount=accrued.quantize(self.PRICE_QUANTUM),
            accrued_method=accrual.method,
            annual_yield=(
                annual_yield.quantize(self.RATE_QUANTUM)
                if annual_yield is not None
                else None
            ),
            ytm_status=ytm_status,
            ytm_failure_code=ytm_failure_code,
            ytm_message=ytm_message,
            macaulay_duration=(
                macaulay.quantize(self.RATE_QUANTUM)
                if macaulay is not None
                else None
            ),
            modified_duration=(
                modified.quantize(self.RATE_QUANTUM)
                if modified is not None
                else None
            ),
            convexity=(
                convexity.quantize(self.RATE_QUANTUM)
                if convexity is not None
                else None
            ),
            effective_coupon_rate=effective_rate.quantize(self.RATE_QUANTUM),
            periodic_coupon_rate=coupon_metrics.periodic_coupon_rate,
            annual_simple_coupon_rate=coupon_metrics.annual_simple_rate,
            annual_compound_coupon_rate=coupon_metrics.annual_compound_rate,
            coupon_rate_status=coupon_metrics.status,
            coupon_rate_confidence=coupon_metrics.confidence,
            coupon_rate_is_final=coupon_metrics.is_final,
            valuation_kind="THEORETICAL_YTM",
            cash_flow_rate_policy=(
                "CONTRACTUAL_FIXED_RATE_BY_ACTUAL_PERIOD"
                if terms.rate_type == RateType.FIXED
                else "CURRENT_PERIOD_THEN_FLAT_ANNUAL_RATE_SCENARIO"
            ),
            valuation_assumptions=valuation_assumptions,
            cash_flows=discounted,
            intermediates={
                "day_count": convention.value,
                "coupon_schedule": [item.isoformat() for item in dates],
                "schedule_method": schedule.method.value,
                "schedule_confidence": schedule.confidence,
                "schedule_expected_payment_count": schedule.expected_payment_count,
                "schedule_assumptions": list(schedule.assumptions),
                "valuation_assumptions": list(valuation_assumptions),
                "frequency": terms.coupon_frequency,
                "indexed_nominal": str(indexed_nominal),
                "round_trip_tolerance": "0.000001",
                "coupon_rates": coupon_metrics.to_dict(),
                "accrual": {
                    "method": accrual.method,
                    "rate_decimal": str(accrual.rate_decimal),
                    "inputs": accrual.inputs,
                },
                "price_semantics": {
                    "quote_type": price_input.quote_type.value,
                    "quote_source": price_input.source,
                    "clean_price_origin": clean_price_origin,
                    "dirty_price_origin": dirty_price_origin,
                },
                "ytm": {
                    "status": ytm_status,
                    "failure_code": ytm_failure_code,
                    "message": ytm_message,
                    "safe_search_range": {
                        "lower": "-0.99",
                        "upper": "10",
                    },
                },
            },
            provenance={
                "instrument_source_file_id": terms.source_file_id,
                "instrument_source_row": terms.source_row,
                "source_parse_status": terms.parse_status,
                "parser_version": terms.parser_version,
                "formula_code": terms.formula_code,
                "calendar_version": self.business_calendar.version,
                "coupon_rate": coupon_metrics.to_dict(),
                "benchmark": (
                    {
                        "name": benchmark.name,
                        "observation_date": benchmark.observation_date.isoformat(),
                        "source_file_id": benchmark.source_file_id,
                        "source_row": benchmark.source_row,
                    }
                    if benchmark
                    else None
                ),
                "price_source": price_input.source,
            },
        )

    def _validate(
        self,
        terms: InstrumentTerms,
        settlement_date: date,
        price_input: PriceInput | None,
    ) -> None:
        if terms.parse_status in {"CONFLICTING", "REJECTED"}:
            raise ValuationError(
                ValuationFailureCode.AMBIGUOUS_TERMS,
                f"Enstrüman terimleri otomatik değerlemeye uygun değil: {terms.parse_status}",
            )
        formula = FORMULA_CATALOG.get(terms.formula_code)
        if formula is None:
            raise ValuationError(
                ValuationFailureCode.UNSUPPORTED_FORMULA,
                f"Desteklenmeyen formül kodu: {terms.formula_code}",
            )
        if terms.rate_type.value not in formula.supported_rate_types:
            raise ValuationError(
                ValuationFailureCode.UNSUPPORTED_FORMULA,
                (
                    f"{terms.formula_code} formülü {terms.rate_type.value} "
                    "oran türüyle uyumlu değil."
                ),
            )
        if not terms.issue_date <= settlement_date < terms.maturity_date:
            raise ValuationError(
                ValuationFailureCode.INVALID_SETTLEMENT_DATE,
                "Valör tarihi ihraç tarihi ile vade arasında olmalıdır.",
            )
        if price_input is None:
            raise ValuationError(
                ValuationFailureCode.PRICE_REQUIRED,
                "Temiz fiyat, kirli fiyat veya yıllık getiri açıkça girilmelidir.",
            )
        value = self._decimal(price_input.value, "quote_value")
        if value <= 0:
            raise ValuationError(
                ValuationFailureCode.INVALID_PRICE,
                "Fiyat/getiri girdisi pozitif olmalıdır.",
            )

    def _effective_rate_and_nominal(
        self,
        terms: InstrumentTerms,
        benchmark: BenchmarkInput | None,
        cpi_ratio: Decimal | None,
    ) -> tuple[Decimal, Decimal]:
        nominal = self._decimal(terms.nominal, "nominal")
        if terms.coupon_rate_metrics is not None:
            return (
                self._decimal(
                    terms.coupon_rate_metrics.annual_simple_rate,
                    "resolved_annual_simple_coupon_rate",
                ),
                nominal,
            )
        if terms.rate_type in {RateType.FIXED, RateType.FLOATING}:
            if terms.annual_coupon_rate is None:
                raise ValuationError(
                    ValuationFailureCode.MISSING_COUPON_RATE,
                    (
                        "Sabit kıymet için yıllık kupon oranı gerekli."
                        if terms.rate_type == RateType.FIXED
                        else "Değişken kıymet için yayımlanmış veya senaryo kupon oranı gerekli."
                    ),
                )
            return self._decimal(terms.annual_coupon_rate, "annual_coupon_rate"), nominal
        if terms.rate_type in {RateType.TLREF, RateType.TLREFK}:
            if benchmark is None:
                raise ValuationError(
                    ValuationFailureCode.MISSING_BENCHMARK,
                    f"{terms.rate_type.value} gözlemi gerekli.",
                )
            if benchmark.name != terms.rate_type.value:
                raise ValuationError(
                    ValuationFailureCode.BENCHMARK_MISMATCH,
                    f"{terms.rate_type.value} beklenirken {benchmark.name} verildi.",
                )
            rate = self._decimal(benchmark.annual_rate_decimal, "benchmark_rate")
            return rate + self._decimal(terms.benchmark_spread_decimal, "spread"), nominal
        if cpi_ratio is None:
            raise ValuationError(
                ValuationFailureCode.MISSING_CPI_RATIO,
                "TÜFE bağlantılı kıymet için doğrulanmış endeks oranı gerekli.",
            )
        if terms.annual_coupon_rate is None:
            raise ValuationError(
                ValuationFailureCode.MISSING_COUPON_RATE,
                "TÜFE bağlantılı kıymet için reel kupon oranı gerekli.",
            )
        ratio = self._decimal(cpi_ratio, "cpi_ratio")
        if ratio <= 0:
            raise ValuationError(
                ValuationFailureCode.MISSING_CPI_RATIO,
                "TÜFE endeks oranı pozitif olmalıdır.",
            )
        return self._decimal(terms.annual_coupon_rate, "annual_coupon_rate"), nominal * ratio

    @staticmethod
    def _cash_flows(
        terms: InstrumentTerms,
        dates: list[date],
        convention: DayCountConvention,
        annual_rate: Decimal,
        nominal: Decimal,
        settlement_date: date,
        coupon_metrics: CouponRateMetrics,
    ) -> list[CashFlow]:
        flows: list[CashFlow] = []
        accrual_start = terms.issue_date
        for payment_date in dates:
            fraction = year_fraction(accrual_start, payment_date, convention)
            if payment_date == coupon_metrics.period_end:
                coupon = nominal * coupon_metrics.periodic_coupon_rate
                rate_status = coupon_metrics.status
            else:
                coupon = nominal * annual_rate * fraction
                rate_status = (
                    "CONTRACTUAL"
                    if terms.rate_type == RateType.FIXED
                    else "SCENARIO"
                )
            principal = nominal if payment_date == dates[-1] else Decimal("0")
            flows.append(
                CashFlow(
                    payment_date=payment_date,
                    coupon_amount=coupon,
                    principal_amount=principal,
                    total_amount=coupon + principal,
                    accrual_start=accrual_start,
                    accrual_end=payment_date,
                    year_fraction=fraction,
                    rate_status=rate_status,
                )
            )
            accrual_start = payment_date
        return flows

    def _price_from_yield(
        self,
        flows: list[CashFlow],
        settlement_date: date,
        annual_yield: Decimal,
        frequency: int,
        convention: DayCountConvention,
    ) -> tuple[Decimal, list[CashFlow]]:
        annual_yield = self._decimal(annual_yield, "annual_yield")
        base = Decimal("1") + annual_yield / Decimal(frequency)
        if base <= 0:
            raise ValuationError(
                ValuationFailureCode.INVALID_PRICE,
                "Getiri iskonto tabanını sıfır veya negatif yaptı.",
            )
        price = Decimal("0")
        discounted: list[CashFlow] = []
        with localcontext() as context:
            context.prec = 34
            for flow in flows:
                years = year_fraction(settlement_date, flow.payment_date, convention)
                periods = years * Decimal(frequency)
                discount = context.power(base, periods)
                present_value = flow.total_amount / discount
                price += present_value
                discounted.append(
                    CashFlow(
                        **{
                            **asdict(flow),
                            "discount_time": periods,
                            "present_value": present_value,
                        }
                    )
                )
        return price, discounted

    def _solve_yield(
        self,
        flows: list[CashFlow],
        settlement_date: date,
        dirty_price: Decimal,
        frequency: int,
        convention: DayCountConvention,
    ) -> Decimal:
        low = Decimal("-0.99")
        high = Decimal("10")

        def residual(candidate: Decimal) -> Decimal:
            value, _ = self._price_from_yield(
                flows,
                settlement_date,
                candidate,
                frequency,
                convention,
            )
            return value - dirty_price

        f_low = residual(low)
        f_high = residual(high)
        if f_low == 0:
            return low
        if f_high == 0:
            return high
        if f_low * f_high > 0:
            raise ValuationError(
                ValuationFailureCode.NO_ROOT,
                "Belirlenen güvenli getiri aralığında fiyat kökü bulunamadı.",
                context={"lower": str(low), "upper": str(high)},
            )
        for _ in range(256):
            middle = (low + high) / Decimal("2")
            value = residual(middle)
            if abs(value) <= Decimal("0.000000000001"):
                return middle
            if f_low * value <= 0:
                high = middle
            else:
                low = middle
                f_low = value
        return (low + high) / Decimal("2")

    @staticmethod
    def _risk_metrics(
        flows: list[CashFlow],
        dirty_price: Decimal,
        annual_yield: Decimal,
        frequency: int,
    ) -> tuple[Decimal, Decimal, Decimal]:
        if dirty_price <= 0:
            raise ValuationError(
                ValuationFailureCode.NUMERIC_FAILURE,
                "Risk ölçüleri için pozitif kirli fiyat gerekli.",
            )
        weighted = Decimal("0")
        convex_weighted = Decimal("0")
        for flow in flows:
            assert flow.discount_time is not None and flow.present_value is not None
            years = flow.discount_time / Decimal(frequency)
            weighted += years * flow.present_value
            convex_weighted += years * (years + Decimal("1") / Decimal(frequency)) * flow.present_value
        macaulay = weighted / dirty_price
        base = Decimal("1") + annual_yield / Decimal(frequency)
        modified = macaulay / base
        convexity = convex_weighted / (dirty_price * base * base)
        return macaulay, modified, convexity

    @staticmethod
    def _decimal(value: Decimal | str | int, field_name: str) -> Decimal:
        try:
            parsed = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ValuationError(
                ValuationFailureCode.NUMERIC_FAILURE,
                f"{field_name} Decimal olarak çözümlenemedi.",
            )
        if not parsed.is_finite():
            raise ValuationError(
                ValuationFailureCode.NUMERIC_FAILURE,
                f"{field_name} sonlu olmalıdır.",
            )
        return parsed
