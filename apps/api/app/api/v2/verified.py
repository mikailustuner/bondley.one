from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.time import turkey_today, utc_now
from app.core.time import BistBusinessCalendar, parse_holiday_list
from app.models.bist_ingestion import (
    BenchmarkObservation,
    BootstrapRun,
    ImportDiagnostic,
    ImportRun,
    Instrument,
    InstrumentTermRule,
    InstrumentVersion,
    SourceFile,
)
from app.models.user import User
from app.models.valuation import (
    InstrumentUserNote,
    PriceObservation,
    UserFavoriteInstrument,
    ValuationRequestRecord,
    ValuationResultRecord,
)
from app.schemas.valuation_v2 import (
    ImportTrigger,
    InstrumentListResponse,
    InstrumentNoteUpdate,
    ValuationCreate,
    ValuationResponse,
)
from app.services.bist_ingestion.import_service import VerifiedBistImportService
from app.services.bist_ingestion.bootstrap import (
    BootstrapAlreadyRunning,
    VerifiedBistBootstrapService,
)
from app.services.valuation.engine import (
    BenchmarkInput,
    InstrumentTerms,
    PriceInput,
    QuoteType,
    RateType,
    ValuationEngine,
)
from app.services.valuation.calendar import coupon_schedule, current_coupon_period
from app.services.valuation.coupon_rates import (
    CouponRateMetrics,
    from_annual_simple_coupon,
    from_index_change,
    from_periodic_coupon,
)
from app.services.valuation.day_count import parse_day_count, year_fraction
from app.services.valuation.errors import ValuationError
from app.services.metrics_service import MetricsService


router = APIRouter()
settings = get_settings()


def _require_read_enabled() -> None:
    if not settings.VALUATION_V2_READ_ENABLED:
        raise HTTPException(status_code=503, detail="Verified v2 read path is disabled")


def _decimal(value: Any) -> Decimal | None:
    if value in (None, "", "-"):
        return None
    try:
        return Decimal(str(value).replace(",", "."))
    except InvalidOperation:
        return None


def _date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _rate_type(isin: str, ast: dict[str, Any]) -> RateType:
    names = {item.get("name") for item in ast.get("benchmarks", [])}
    if isin.startswith("TRD") or names & {"TLREFK_RATE", "BIST_TLREFK_INDEX"}:
        return RateType.TLREFK
    if names & {"TLREF_RATE", "BIST_TLREF_INDEX"}:
        return RateType.TLREF
    if "CPI_REFERENCE_INDEX" in names:
        return RateType.CPI
    return RateType.FIXED


def _formula_code(rate_type: RateType) -> str:
    return {
        RateType.FIXED: "BAP_FIXED_RATE",
        RateType.TLREF: "BAP_TLREF",
        RateType.TLREFK: "BAP_TLREFK",
        RateType.CPI: "BAP_CPI_LINKED",
    }[rate_type]


def _spread(ast: dict[str, Any]) -> Decimal:
    explicit = [
        _decimal(item.get("decimal"))
        for item in ast.get("spreads", [])
        if item.get("decimal") is not None
    ]
    return next((item for item in explicit if item is not None), Decimal("0"))


def _coupon_period(
    *,
    issue_date: date,
    maturity_date: date,
    coupon_frequency: int,
    next_coupon_date: date | None,
    settlement_date: date,
    day_count: str | None,
    explicit_coupon_dates: tuple[date, ...],
) -> tuple[date, date, Decimal]:
    dates = coupon_schedule(
        issue_date=issue_date,
        maturity_date=maturity_date,
        frequency=coupon_frequency,
        next_coupon_date=next_coupon_date,
        explicit_coupon_dates=explicit_coupon_dates,
    )
    period_start, period_end = current_coupon_period(
        issue_date=issue_date,
        settlement_date=settlement_date,
        payment_dates=dates,
        frequency=coupon_frequency,
        next_coupon_date=next_coupon_date,
    )
    factor = year_fraction(period_start, period_end, parse_day_count(day_count))
    return period_start, period_end, factor


def _observation_lag(ast: dict[str, Any]) -> int:
    lags = {
        int(item["lag_business_days"])
        for item in ast.get("observation_lags", [])
        if item.get("lag_business_days") is not None
    }
    return next(iter(lags)) if len(lags) == 1 else 0


def _lagged_business_date(boundary: date, lag: int) -> date:
    if lag <= 0:
        return boundary
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary
    for _ in range(lag):
        target = calendar.previous_business_day(target)
    return target


def _next_business_day(boundary: date) -> date:
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary + timedelta(days=1)
    while not calendar.is_business_day(target):
        target += timedelta(days=1)
    return target


def _on_or_previous_business_day(boundary: date) -> date:
    calendar = BistBusinessCalendar(
        extra_holidays=parse_holiday_list(settings.BIST_HOLIDAYS)
    )
    target = boundary
    while not calendar.is_business_day(target):
        target -= timedelta(days=1)
    return target


async def _index_observation(
    db: AsyncSession,
    benchmark: str,
    target_date: date,
) -> BenchmarkObservation | None:
    return await db.scalar(
        select(BenchmarkObservation)
        .where(
            BenchmarkObservation.benchmark == benchmark,
            BenchmarkObservation.observation_date <= target_date,
            BenchmarkObservation.index_value.is_not(None),
        )
        .order_by(BenchmarkObservation.observation_date.desc())
        .limit(1)
    )


async def _resolve_coupon_rate_metrics(
    db: AsyncSession,
    *,
    fields: dict[str, Any],
    ast: dict[str, Any],
    rate_type: RateType,
    issue_date: date,
    maturity_date: date,
    coupon_frequency: int,
    settlement_date: date,
    explicit_coupon_dates: tuple[date, ...],
    benchmark_input: BenchmarkInput | None,
) -> CouponRateMetrics | None:
    if rate_type == RateType.CPI:
        return None

    next_coupon_date = _date(fields.get("next_coupon_date"))
    coupon_day_count = (
        "ACT/365F"
        if rate_type in {RateType.TLREF, RateType.TLREFK}
        else fields.get("day_count_convention")
    )
    try:
        period_start, period_end, full_factor = _coupon_period(
            issue_date=issue_date,
            maturity_date=maturity_date,
            coupon_frequency=coupon_frequency,
            next_coupon_date=next_coupon_date,
            settlement_date=settlement_date,
            day_count=coupon_day_count,
            explicit_coupon_dates=explicit_coupon_dates,
        )
    except ValuationError:
        # Coupon-rate enrichment must not mask the engine's typed schedule
        # failure or prevent valuation records from being persisted.
        return None
    published_coupon_pct = _decimal(fields.get("next_coupon_rate_pct"))
    if published_coupon_pct is not None and (
        published_coupon_pct > 0 or rate_type == RateType.FIXED
    ):
        return from_periodic_coupon(
            periodic_coupon_rate=published_coupon_pct / Decimal("100"),
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            calculation_as_of=settlement_date,
        )

    if ast.get("benchmark_mode") == "INDEX_CHANGE" and rate_type in {
        RateType.TLREF,
        RateType.TLREFK,
    }:
        benchmark_name = rate_type.value
        lag = _observation_lag(ast)
        start_target = _lagged_business_date(period_start, lag)
        required_end_target = _lagged_business_date(period_end, lag)
        start_observation = await _index_observation(db, benchmark_name, start_target)
        is_final = required_end_target <= settlement_date
        end_target = required_end_target if is_final else min(settlement_date, period_end)
        end_observation = await _index_observation(db, benchmark_name, end_target)
        if (
            start_observation is None
            or end_observation is None
            or start_observation.index_value is None
            or end_observation.index_value is None
            or end_observation.observation_date <= start_observation.observation_date
        ):
            return None
        if (
            is_final
            and end_observation.observation_date
            != _on_or_previous_business_day(required_end_target)
        ):
            is_final = False
        elapsed_projection_days = (
            _next_business_day(end_observation.observation_date)
            - _next_business_day(start_observation.observation_date)
        ).days
        if elapsed_projection_days <= 0:
            # There is no elapsed index return on the first day of a coupon
            # period, so an annualized indicative coupon cannot be calculated.
            return None
        annuality = str(ast.get("spread_annuality") or "UNKNOWN")
        if annuality not in {"ANNUAL_SIMPLE", "PERIODIC"}:
            annuality = "UNKNOWN"
        return from_index_change(
            start_index_value=start_observation.index_value,
            end_index_value=end_observation.index_value,
            start_index_date=start_observation.observation_date,
            end_index_date=end_observation.observation_date,
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            full_period_days=(period_end - period_start).days,
            elapsed_projection_days=elapsed_projection_days,
            spread_decimal=_spread(ast),
            spread_annuality=annuality,
            calculation_as_of=end_observation.observation_date,
            is_final=is_final,
        )

    if rate_type in {RateType.TLREF, RateType.TLREFK} and benchmark_input is not None:
        spread = _spread(ast)
        annuality = str(ast.get("spread_annuality") or "UNKNOWN")
        assumptions: tuple[str, ...] = ()
        if annuality == "PERIODIC":
            annual_spread = spread / full_factor
        else:
            annual_spread = spread
            if annuality == "UNKNOWN" and spread:
                assumptions = ("UNQUALIFIED_SPREAD_TREATED_AS_ANNUAL_SIMPLE",)
        return from_annual_simple_coupon(
            annual_simple_rate=benchmark_input.annual_rate_decimal + annual_spread,
            period_start=period_start,
            period_end=period_end,
            coupon_frequency=coupon_frequency,
            full_period_year_fraction=full_factor,
            calculation_as_of=benchmark_input.observation_date,
            status="INDICATIVE",
            confidence="ASSUMPTION_REQUIRED" if assumptions else "EXACT_CONTRACT",
            is_final=False,
            assumptions=assumptions,
        )
    return None


def _instrument_payload(
    instrument: Instrument,
    version: InstrumentVersion,
    rule: InstrumentTermRule | None,
) -> dict[str, Any]:
    fields = version.canonical_fields_json
    ast = rule.ast_json if rule else {}
    maturity = version.maturity_date
    today = turkey_today()
    days_to_maturity = (maturity - today).days if maturity else None
    return {
        "id": instrument.id,
        "version_id": version.id,
        "isin": instrument.isin,
        "isin_code": instrument.isin,
        "instrument_family": instrument.instrument_family,
        "issuer": version.issuer_name,
        "issuer_name": version.issuer_name,
        "maturity_date": maturity.isoformat() if maturity else None,
        "days_to_maturity": days_to_maturity,
        "currency": fields.get("currency_or_unit") or "TRY",
        "security_type": version.security_type_raw,
        "yield_type": version.yield_type_raw,
        "coupon_frequency": fields.get("coupon_frequency_per_year"),
        "first_issue_date": fields.get("first_issue_date"),
        "next_coupon_date": fields.get("next_coupon_date"),
        "next_coupon_rate_pct": fields.get("next_coupon_rate_pct"),
        "next_coupon_rate": fields.get("next_coupon_rate_pct"),
        "group_code": version.group_code,
        "remarks_raw": fields.get("remarks_raw"),
        "remarks": fields.get("remarks_raw"),
        "issuance_type": fields.get("issuance_type_raw"),
        "quotation_method": fields.get("quotation_method"),
        "day_count_convention": fields.get("day_count_convention"),
        "total_issue_amount": fields.get("total_issue_amount_thousands"),
        "last_issue_price": None,
        "last_issue_yield": None,
        "first_issue_price": fields.get("first_issue_price"),
        "first_issue_yield": fields.get("first_issue_yield_annual_simple_pct"),
        "spread": None,
        "contractual_spread_decimal": str(_spread(ast)),
        "is_active": bool(maturity is None or maturity >= today),
        "calculated_metrics": None,
        "term_rule_ast": ast,
        "quality": {
            "parse_status": version.parse_status,
            "valuation_eligible": version.valuation_eligible,
            "diagnostics": ast.get("diagnostics", []),
        },
        "price_status": "SYSTEM_NOMINAL_100",
        "source": {
            "source_file_id": version.source_file_id,
            "source_row": version.source_row_number,
            "parser_version": rule.parser_version if rule else None,
            "ast_schema_version": rule.ast_schema_version if rule else None,
        },
        "fields": fields,
    }


async def _instrument_version(
    db: AsyncSession,
    isin: str,
) -> tuple[Instrument, InstrumentVersion, InstrumentTermRule | None] | None:
    result = await db.execute(
        select(Instrument, InstrumentVersion, InstrumentTermRule)
        .join(InstrumentVersion, InstrumentVersion.instrument_id == Instrument.id)
        .outerjoin(
            InstrumentTermRule,
            InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
        )
        .where(
            Instrument.isin == isin.upper(),
            InstrumentVersion.is_published.is_(True),
        )
        .order_by(
            InstrumentVersion.valuation_eligible.desc(),
            InstrumentVersion.id.desc(),
        )
        .limit(1)
    )
    return result.one_or_none()


@router.get("/instruments", response_model=InstrumentListResponse)
async def list_instruments(
    search: str | None = None,
    parse_status: str | None = None,
    valuation_eligible: bool | None = None,
    security_type: str | None = None,
    yield_type: str | None = None,
    currency: str | None = None,
    active_only: bool = True,
    maturity_within_days: int | None = Query(None, ge=1, le=36500),
    order_by: str = Query("isin", pattern="^(isin|issuer|maturity)$"),
    order_direction: str = Query("asc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=3000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    query = (
        select(Instrument, InstrumentVersion, InstrumentTermRule)
        .join(InstrumentVersion, InstrumentVersion.instrument_id == Instrument.id)
        .outerjoin(
            InstrumentTermRule,
            InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
        )
        .where(InstrumentVersion.is_published.is_(True))
    )
    if search:
        candidate = f"%{search.strip()}%"
        query = query.where(
            Instrument.isin.ilike(candidate) | InstrumentVersion.issuer_name.ilike(candidate)
        )
    if parse_status:
        query = query.where(InstrumentVersion.parse_status == parse_status.upper())
    if valuation_eligible is not None:
        query = query.where(InstrumentVersion.valuation_eligible.is_(valuation_eligible))
    if security_type:
        query = query.where(InstrumentVersion.security_type_raw == security_type)
    if yield_type:
        query = query.where(InstrumentVersion.yield_type_raw == yield_type)
    if currency:
        query = query.where(
            InstrumentVersion.canonical_fields_json["currency_or_unit"].as_string()
            == currency
        )
    today = turkey_today()
    if active_only:
        query = query.where(
            (InstrumentVersion.maturity_date.is_(None))
            | (InstrumentVersion.maturity_date >= today)
        )
    if maturity_within_days is not None:
        query = query.where(
            InstrumentVersion.maturity_date.between(
                today,
                today + timedelta(days=maturity_within_days),
            )
        )
    order_column = {
        "isin": Instrument.isin,
        "issuer": InstrumentVersion.issuer_name,
        "maturity": InstrumentVersion.maturity_date,
    }[order_by]
    direction = order_column.desc() if order_direction == "desc" else order_column.asc()
    rows = (
        await db.execute(query.order_by(direction, InstrumentVersion.id.desc()))
    ).all()
    unique: dict[int, tuple[Instrument, InstrumentVersion, InstrumentTermRule | None]] = {}
    for row in rows:
        unique.setdefault(row[0].id, row)
    selected = list(unique.values())
    return InstrumentListResponse(
        items=[
            _instrument_payload(instrument, version, rule)
            for instrument, version, rule in selected[skip : skip + limit]
        ],
        total=len(selected),
    )


@router.get("/instruments/{isin}")
async def get_instrument(
    isin: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    row = await _instrument_version(db, isin)
    if row is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    instrument, version, rule = row
    payload = _instrument_payload(instrument, version, rule)
    source = await db.get(SourceFile, version.source_file_id)
    if source is not None:
        payload["source"].update(
            {
                "filename": source.filename,
                "effective_date": (
                    source.effective_date.isoformat()
                    if source.effective_date
                    else None
                ),
                "requested_business_date": (
                    source.requested_business_date.isoformat()
                    if source.requested_business_date
                    else None
                ),
                "date_origin": source.date_origin,
                "freshness_status": source.freshness_status,
                "sha256": source.sha256,
            }
        )
    favorite = await db.scalar(
        select(UserFavoriteInstrument.id).where(
            UserFavoriteInstrument.user_id == user.id,
            UserFavoriteInstrument.instrument_id == instrument.id,
        )
    )
    note = await db.scalar(
        select(InstrumentUserNote.note_text).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument.id,
        )
    )
    payload["is_favorite"] = favorite is not None
    payload["note_text"] = note
    await MetricsService.track_instrument_view(
        db,
        instrument_id=instrument.id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return payload


@router.get("/benchmarks")
async def list_benchmarks(
    benchmark: str | None = None,
    limit: int = Query(100, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    query = select(BenchmarkObservation)
    if benchmark:
        query = query.where(BenchmarkObservation.benchmark == benchmark.upper())
    rows = (
        await db.execute(
            query.order_by(BenchmarkObservation.observation_date.desc()).limit(limit)
        )
    ).scalars()
    return {
        "items": [
            {
                "benchmark": item.benchmark,
                "observation_date": item.observation_date.isoformat(),
                "published_annual_rate_pct": (
                    str(item.published_annual_rate_pct)
                    if item.published_annual_rate_pct is not None
                    else None
                ),
                "annual_rate_decimal": (
                    str(item.annual_rate_decimal)
                    if item.annual_rate_decimal is not None
                    else None
                ),
                "index_value": str(item.index_value) if item.index_value is not None else None,
                "source_file_ids": [
                    value
                    for value in (item.rate_source_file_id, item.index_source_file_id)
                    if value is not None
                ],
            }
            for item in rows
        ]
    }


@router.get("/instrument-stats")
async def instrument_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    rows = (
        await db.execute(
            select(InstrumentVersion)
            .where(InstrumentVersion.is_published.is_(True))
            .order_by(InstrumentVersion.instrument_id, InstrumentVersion.id.desc())
        )
    ).scalars()
    unique: dict[int, InstrumentVersion] = {}
    for row in rows:
        unique.setdefault(row.instrument_id, row)
    versions = list(unique.values())

    def counts(field: str) -> dict[str, int]:
        result: dict[str, int] = {}
        for version in versions:
            value = version.canonical_fields_json.get(field)
            if value:
                result[str(value)] = result.get(str(value), 0) + 1
        return result

    maturity_days = [
        (item.maturity_date - turkey_today()).days
        for item in versions
        if item.maturity_date is not None
    ]
    return {
        "total_bonds": len(versions),
        "by_security_type": counts("security_type_raw"),
        "by_currency": counts("currency_or_unit"),
        "by_yield_type": counts("yield_type_raw"),
        "avg_days_to_maturity": (
            sum(maturity_days) / len(maturity_days) if maturity_days else None
        ),
        "price_policy": "SYSTEM_NOMINAL_100",
    }


@router.get("/instruments/{isin}/price-history")
async def instrument_price_history(
    isin: str,
    days: int = Query(90, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    rows = (
        await db.execute(
            select(PriceObservation)
            .where(
                PriceObservation.instrument_id == instrument_id,
                PriceObservation.user_id == user.id,
            )
            .order_by(PriceObservation.quote_date.desc())
            .limit(days)
        )
    ).scalars()
    return {
        "items": [
            {
                "date": item.quote_date.isoformat(),
                "clean_price": (
                    str(item.quote_value)
                    if item.quote_type == QuoteType.CLEAN_PRICE.value
                    else None
                ),
                "ytm": (
                    str(item.quote_value)
                    if item.quote_type == QuoteType.ANNUAL_YIELD.value
                    else None
                ),
                "quote_type": item.quote_type,
                "source": item.source_type,
            }
            for item in rows
        ]
    }


@router.get("/yield-curve")
async def verified_yield_curve(
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    return {
        "items": [],
        "status": "PRICE_REQUIRED",
        "message": "Açık kullanıcı fiyatı olmadan piyasa getiri eğrisi üretilmez.",
    }


@router.post("/valuations", response_model=ValuationResponse)
async def create_valuation(
    payload: ValuationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not settings.VALUATION_V2_WRITE_ENABLED:
        raise HTTPException(status_code=503, detail="Verified v2 write path is disabled")
    row = await _instrument_version(db, payload.isin)
    if row is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    instrument, version, rule = row
    fields = version.canonical_fields_json
    ast = rule.ast_json if rule else {}
    issue_date = _date(fields.get("first_issue_date"))
    maturity_date = version.maturity_date
    frequency = fields.get("coupon_frequency_per_year")
    if issue_date is None or maturity_date is None or not frequency:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Instrument schedule fields are incomplete",
        )
    rate_type = _rate_type(instrument.isin, ast)
    published_coupon_pct = _decimal(fields.get("next_coupon_rate_pct"))
    annual_coupon_rate = (
        published_coupon_pct / Decimal("100")
        if published_coupon_pct is not None
        else None
    )
    benchmark_input = None
    if rate_type in {RateType.TLREF, RateType.TLREFK}:
        benchmark_row = await db.scalar(
            select(BenchmarkObservation)
            .where(
                BenchmarkObservation.benchmark == rate_type.value,
                BenchmarkObservation.observation_date <= payload.settlement_date,
                BenchmarkObservation.annual_rate_decimal.is_not(None),
            )
            .order_by(BenchmarkObservation.observation_date.desc())
            .limit(1)
        )
        if benchmark_row is not None:
            benchmark_input = BenchmarkInput(
                name=benchmark_row.benchmark,
                observation_date=benchmark_row.observation_date,
                annual_rate_decimal=benchmark_row.annual_rate_decimal,
                source_file_id=benchmark_row.rate_source_file_id,
                source_row=benchmark_row.rate_source_row,
            )

    coupon_rate_metrics = await _resolve_coupon_rate_metrics(
        db,
        fields=fields,
        ast=ast,
        rate_type=rate_type,
        issue_date=issue_date,
        maturity_date=maturity_date,
        coupon_frequency=int(frequency),
        settlement_date=payload.settlement_date,
        explicit_coupon_dates=tuple(payload.explicit_coupon_dates),
        benchmark_input=benchmark_input,
    )
    if coupon_rate_metrics is not None:
        annual_coupon_rate = coupon_rate_metrics.annual_simple_rate

    price = PriceObservation(
        instrument_id=instrument.id,
        instrument_version_id=version.id,
        user_id=user.id,
        quote_type=payload.quote_type,
        quote_value=payload.quote_value,
        quote_date=payload.quote_date or turkey_today(),
        settlement_date=payload.settlement_date,
        currency=fields.get("currency_or_unit") or "TRY",
        source_type=payload.quote_source,
        confidence=(
            "SYSTEM_ASSUMPTION"
            if payload.quote_source == "SYSTEM_NOMINAL_100"
            else "USER_PROVIDED"
        ),
        raw_payload={
            "quote_type": payload.quote_type,
            "quote_value": str(payload.quote_value),
            "quote_source": payload.quote_source,
            "quote_date": (payload.quote_date or turkey_today()).isoformat(),
            "settlement_date": payload.settlement_date.isoformat(),
        },
    )
    db.add(price)
    await db.flush()
    request_record = ValuationRequestRecord(
        instrument_version_id=version.id,
        user_id=user.id,
        price_observation_id=price.id,
        engine_version=ValuationEngine.VERSION,
        request_payload=payload.model_dump(mode="json"),
        status="RUNNING",
    )
    db.add(request_record)
    await db.flush()

    terms = InstrumentTerms(
        isin=instrument.isin,
        issue_date=issue_date,
        maturity_date=maturity_date,
        coupon_frequency=int(frequency),
        annual_coupon_rate=annual_coupon_rate,
        rate_type=rate_type,
        benchmark_spread_decimal=_spread(ast),
        nominal=Decimal("100"),
        day_count=fields.get("day_count_convention") or "ACT/365F",
        next_coupon_date=_date(fields.get("next_coupon_date")),
        explicit_coupon_dates=tuple(payload.explicit_coupon_dates),
        parse_status=version.parse_status,
        formula_code=_formula_code(rate_type),
        source_file_id=version.source_file_id,
        source_row=version.source_row_number,
        parser_version=rule.parser_version if rule else None,
        coupon_rate_metrics=coupon_rate_metrics,
    )
    try:
        result = ValuationEngine().value(
            terms,
            settlement_date=payload.settlement_date,
            price_input=PriceInput(
                QuoteType(payload.quote_type),
                payload.quote_value,
                source=payload.quote_source,
            ),
            benchmark=benchmark_input,
            cpi_ratio=payload.cpi_ratio,
        )
        result_payload = result.to_dict()
        request_record.status = "COMPLETED"
        request_record.completed_at = utc_now()
        db.add(
            ValuationResultRecord(
                request_id=request_record.id,
                success=True,
                result_payload=result_payload,
                intermediates=result.intermediates,
                provenance=result.provenance,
            )
        )
        await db.commit()
        return ValuationResponse(
            request_id=request_record.id,
            success=True,
            result=result_payload,
        )
    except ValuationError as exc:
        request_record.status = "FAILED"
        request_record.completed_at = utc_now()
        failure = exc.to_dict()
        db.add(
            ValuationResultRecord(
                request_id=request_record.id,
                success=False,
                failure_code=exc.code.value,
                failure_message=str(exc),
                provenance={
                    "instrument_source_file_id": version.source_file_id,
                    "instrument_source_row": version.source_row_number,
                    "parser_version": rule.parser_version if rule else None,
                    "engine_version": ValuationEngine.VERSION,
                },
            )
        )
        await db.commit()
        return ValuationResponse(
            request_id=request_record.id,
            success=False,
            failure=failure,
        )


@router.get("/valuations/{request_id}", response_model=ValuationResponse)
async def get_valuation(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    row = (
        await db.execute(
            select(ValuationRequestRecord, ValuationResultRecord)
            .join(
                ValuationResultRecord,
                ValuationResultRecord.request_id == ValuationRequestRecord.id,
            )
            .where(
                ValuationRequestRecord.id == request_id,
                ValuationRequestRecord.user_id == user.id,
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Valuation not found")
    request_record, result = row
    return ValuationResponse(
        request_id=request_record.id,
        success=result.success,
        result=result.result_payload,
        failure=(
            {
                "code": result.failure_code,
                "message": result.failure_message,
                "context": {},
            }
            if not result.success
            else None
        ),
    )


@router.get("/favorites")
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    rows = (
        await db.execute(
            select(Instrument, InstrumentVersion, InstrumentTermRule)
            .join(
                UserFavoriteInstrument,
                UserFavoriteInstrument.instrument_id == Instrument.id,
            )
            .join(
                InstrumentVersion,
                InstrumentVersion.instrument_id == Instrument.id,
            )
            .outerjoin(
                InstrumentTermRule,
                InstrumentTermRule.instrument_version_id == InstrumentVersion.id,
            )
            .where(
                UserFavoriteInstrument.user_id == user.id,
                InstrumentVersion.is_published.is_(True),
            )
            .order_by(Instrument.isin, InstrumentVersion.id.desc())
        )
    ).all()
    unique: dict[int, tuple[Instrument, InstrumentVersion, InstrumentTermRule | None]] = {}
    for row in rows:
        unique.setdefault(row[0].id, row)
    details = [
        _instrument_payload(instrument, version, rule)
        for instrument, version, rule in unique.values()
    ]
    return {
        "items": [item["isin"] for item in details],
        "details": details,
        "total": len(details),
    }


@router.get("/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    today = turkey_today()
    version_rows = (
        await db.execute(
            select(InstrumentVersion)
            .where(InstrumentVersion.is_published.is_(True))
            .order_by(InstrumentVersion.instrument_id, InstrumentVersion.id.desc())
        )
    ).scalars()
    latest_versions: dict[int, InstrumentVersion] = {}
    for version in version_rows:
        latest_versions.setdefault(version.instrument_id, version)
    versions = list(latest_versions.values())
    isin_by_id = dict(
        (
            await db.execute(
                select(Instrument.id, Instrument.isin).where(
                    Instrument.id.in_([version.instrument_id for version in versions])
                )
            )
        ).all()
    ) if versions else {}
    favorite_count = (
        await db.scalar(
            select(func.count(UserFavoriteInstrument.id)).where(
                UserFavoriteInstrument.user_id == user.id
            )
        )
        or 0
    )
    benchmarks: dict[str, Any] = {}
    for name in ("TLREF", "TLREFK"):
        observation = await db.scalar(
            select(BenchmarkObservation)
            .where(BenchmarkObservation.benchmark == name)
            .order_by(BenchmarkObservation.observation_date.desc())
            .limit(1)
        )
        benchmarks[name] = (
            {
                "observation_date": observation.observation_date.isoformat(),
                "published_annual_rate_pct": (
                    str(observation.published_annual_rate_pct)
                    if observation.published_annual_rate_pct is not None
                    else None
                ),
                "index_value": (
                    str(observation.index_value)
                    if observation.index_value is not None
                    else None
                ),
            }
            if observation
            else None
        )
    latest_source = await db.scalar(
        select(SourceFile)
        .where(SourceFile.source_kind == "TBLISTE", SourceFile.status == "PUBLISHED")
        .order_by(SourceFile.effective_date.desc(), SourceFile.id.desc())
        .limit(1)
    )
    due = sorted(
        (
            version
            for version in versions
            if version.maturity_date is not None
            and today <= version.maturity_date <= today + timedelta(days=90)
        ),
        key=lambda version: version.maturity_date,
    )
    return {
        "as_of_date": today.isoformat(),
        "total_instruments": len(versions),
        "active_instruments": sum(
            version.maturity_date is None or version.maturity_date >= today
            for version in versions
        ),
        "valuation_eligible": sum(version.valuation_eligible for version in versions),
        "favorite_count": favorite_count,
        "benchmarks": benchmarks,
        "source": (
            {
                "filename": latest_source.filename,
                "effective_date": (
                    latest_source.effective_date.isoformat()
                    if latest_source.effective_date
                    else None
                ),
                "requested_business_date": (
                    latest_source.requested_business_date.isoformat()
                    if latest_source.requested_business_date
                    else None
                ),
                "freshness_status": latest_source.freshness_status,
                "date_origin": latest_source.date_origin,
            }
            if latest_source
            else None
        ),
        "maturing_soon": [
            {
                "isin": isin_by_id.get(version.instrument_id),
                "issuer": version.issuer_name,
                "maturity_date": version.maturity_date.isoformat(),
                "days_to_maturity": (version.maturity_date - today).days,
            }
            for version in due[:10]
        ],
    }


@router.post("/favorites/{isin}", status_code=201)
async def add_favorite(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument = await db.scalar(select(Instrument).where(Instrument.isin == isin.upper()))
    if instrument is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    existing = await db.scalar(
        select(UserFavoriteInstrument.id).where(
            UserFavoriteInstrument.user_id == user.id,
            UserFavoriteInstrument.instrument_id == instrument.id,
        )
    )
    if existing is None:
        db.add(UserFavoriteInstrument(user_id=user.id, instrument_id=instrument.id))
        await db.commit()
    return {"status": "favorite", "isin": instrument.isin}


@router.delete("/favorites/{isin}", status_code=204)
async def remove_favorite(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is not None:
        await db.execute(
            delete(UserFavoriteInstrument).where(
                UserFavoriteInstrument.user_id == user.id,
                UserFavoriteInstrument.instrument_id == instrument_id,
            )
        )
        await db.commit()


@router.put("/instruments/{isin}/note")
async def upsert_note(
    isin: str,
    payload: InstrumentNoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument = await db.scalar(select(Instrument).where(Instrument.isin == isin.upper()))
    if instrument is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    note = await db.scalar(
        select(InstrumentUserNote).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument.id,
        )
    )
    if note is None:
        note = InstrumentUserNote(
            user_id=user.id,
            instrument_id=instrument.id,
            note_text=payload.note_text,
        )
        db.add(note)
    else:
        note.note_text = payload.note_text
    await db.commit()
    return {"isin": instrument.isin, "note_text": note.note_text}


@router.get("/instruments/{isin}/note")
async def get_note(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_read_enabled()
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    note = await db.scalar(
        select(InstrumentUserNote).where(
            InstrumentUserNote.user_id == user.id,
            InstrumentUserNote.instrument_id == instrument_id,
        )
    )
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return {
        "isin_code": isin.upper(),
        "note_text": note.note_text,
        "updated_at": note.updated_at,
    }


@router.delete("/instruments/{isin}/note", status_code=204)
async def delete_note(
    isin: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instrument_id = await db.scalar(
        select(Instrument.id).where(Instrument.isin == isin.upper())
    )
    if instrument_id is not None:
        await db.execute(
            delete(InstrumentUserNote).where(
                InstrumentUserNote.user_id == user.id,
                InstrumentUserNote.instrument_id == instrument_id,
            )
        )
        await db.commit()


@router.get("/quality")
async def get_quality(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    _require_read_enabled()
    published = await db.scalar(
        select(func.count(InstrumentVersion.id)).where(
            InstrumentVersion.is_published.is_(True)
        )
    )
    eligible = await db.scalar(
        select(func.count(InstrumentVersion.id)).where(
            InstrumentVersion.is_published.is_(True),
            InstrumentVersion.valuation_eligible.is_(True),
        )
    )
    latest = await db.scalar(
        select(ImportRun).where(ImportRun.status == "PUBLISHED").order_by(
            ImportRun.finished_at.desc()
        )
    )
    latest_source = await db.scalar(
        select(SourceFile)
        .where(SourceFile.status == "PUBLISHED")
        .order_by(SourceFile.effective_date.desc(), SourceFile.id.desc())
        .limit(1)
    )
    latest_bootstrap = await db.scalar(
        select(BootstrapRun).order_by(BootstrapRun.id.desc()).limit(1)
    )
    return {
        "published_versions": published or 0,
        "valuation_eligible_versions": eligible or 0,
        "latest_import": (
            {
                "id": latest.id,
                "parser": latest.parser_name,
                "parser_version": latest.parser_version,
                "finished_at": latest.finished_at,
                "quality_report": latest.quality_report,
            }
            if latest
            else None
        ),
        "latest_source": (
            {
                "kind": latest_source.source_kind,
                "filename": latest_source.filename,
                "effective_date": (
                    latest_source.effective_date.isoformat()
                    if latest_source.effective_date
                    else None
                ),
                "freshness_status": latest_source.freshness_status,
            }
            if latest_source
            else None
        ),
        "bootstrap": (
            {
                "id": latest_bootstrap.id,
                "status": latest_bootstrap.status,
                "current_step": latest_bootstrap.current_step,
                "requested_business_date": latest_bootstrap.requested_business_date.isoformat(),
                "failure_code": latest_bootstrap.failure_code,
                "failure_message": latest_bootstrap.failure_message,
                "started_at": latest_bootstrap.started_at,
                "completed_at": latest_bootstrap.completed_at,
            }
            if latest_bootstrap
            else None
        ),
        "price_policy": "SYSTEM_NOMINAL_100",
    }


@router.get("/operations/imports")
async def import_operations(
    limit: int = Query(50, ge=1, le=250),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    runs = (
        await db.execute(
            select(ImportRun, SourceFile)
            .join(SourceFile, SourceFile.id == ImportRun.source_file_id)
            .order_by(ImportRun.id.desc())
            .limit(limit)
        )
    ).all()
    bootstraps = (
        await db.execute(
            select(BootstrapRun).order_by(BootstrapRun.id.desc()).limit(10)
        )
    ).scalars()
    return {
        "imports": [
            {
                "id": run.id,
                "status": run.status,
                "parser": run.parser_name,
                "parser_version": run.parser_version,
                "row_count": run.row_count,
                "instrument_count": run.instrument_count,
                "warning_count": run.warning_count,
                "error_count": run.error_count,
                "failure_message": run.failure_message,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "source": {
                    "id": source.id,
                    "kind": source.source_kind,
                    "filename": source.filename,
                    "effective_date": (
                        source.effective_date.isoformat()
                        if source.effective_date
                        else None
                    ),
                    "requested_business_date": (
                        source.requested_business_date.isoformat()
                        if source.requested_business_date
                        else None
                    ),
                    "freshness_status": source.freshness_status,
                    "sha256": source.sha256,
                },
            }
            for run, source in runs
        ],
        "bootstraps": [
            {
                "id": run.id,
                "status": run.status,
                "current_step": run.current_step,
                "attempt": run.attempt,
                "requested_business_date": run.requested_business_date.isoformat(),
                "source_file_ids": run.source_file_ids,
                "published_effective_dates": run.published_effective_dates,
                "failure_code": run.failure_code,
                "failure_message": run.failure_message,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
            }
            for run in bootstraps
        ],
    }


@router.post("/operations/bootstrap")
async def run_bootstrap(
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    try:
        result = await VerifiedBistBootstrapService(db, settings).run(force=force)
        return result.to_dict()
    except BootstrapAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/imports/review")
async def import_review(
    severity: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    _require_read_enabled()
    query = select(ImportDiagnostic).order_by(ImportDiagnostic.id.desc()).limit(limit)
    if severity:
        query = query.where(ImportDiagnostic.severity == severity.upper())
    rows = (await db.execute(query)).scalars()
    return {
        "items": [
            {
                "id": item.id,
                "import_run_id": item.import_run_id,
                "severity": item.severity,
                "code": item.code,
                "message": item.message,
                "sheet_name": item.sheet_name,
                "row_number": item.row_number,
                "column_number": item.column_number,
                "raw_fragment": item.raw_fragment,
                "context": item.context_json,
                "resolution_status": item.resolution_status,
            }
            for item in rows
        ]
    }


@router.post("/imports/tbliste")
async def import_tbliste(
    payload: ImportTrigger,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    service = VerifiedBistImportService(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
    calendar = VerifiedBistBootstrapService(db, settings).calendar
    requested_date = calendar.resolve_expected_source_date().requested_business_date
    return await service.import_tbliste(
        payload.source_url or settings.BIST_BOND_LIST_URL,
        requested_business_date=requested_date,
    )


@router.post("/imports/benchmarks/historical")
async def import_historical_benchmarks(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    service = VerifiedBistImportService(db, archive_root=settings.BIST_RAW_ARCHIVE_DIR)
    tlref = await service.import_benchmark_pair(
        "TLREF",
        rate_url=settings.BIST_TLREF_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREF_HISTORICAL_URL,
        historical=True,
    )
    tlrefk = await service.import_benchmark_pair(
        "TLREFK",
        rate_url=settings.BIST_TLREFK_RATE_HISTORICAL_URL,
        index_url=settings.BIST_TLREFK_INDEX_HISTORICAL_URL,
        historical=True,
    )
    return {"TLREF": tlref, "TLREFK": tlrefk}
