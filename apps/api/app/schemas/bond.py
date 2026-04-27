from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BondResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isin_code: str
    issuer: str | None = None
    fund_user: str | None = None
    source_institution: str | None = None
    issuance_type: str | None = None
    yield_type: str | None = None
    security_type: str | None = None
    coupon_frequency: str | None = None
    currency: str = "TRY"
    group_code: int | None = None
    first_issue_date: date | None = None
    maturity_date: date | None = None
    days_to_maturity: int | None = None
    total_issue_amount: Decimal | None = None
    last_issue_date_text: str | None = None
    last_issue_price: Decimal | None = None
    last_issue_yield: Decimal | None = None
    first_issue_yield: Decimal | None = None
    next_coupon_date: date | None = None
    next_coupon_rate: Decimal | None = None
    spread: Decimal | None = None
    first_issue_price: Decimal | None = None
    quotation_method: str | None = None
    accrued_interest_text: str | None = None
    clean_price_text: str | None = None
    dirty_price_formula: str | None = None
    settlement_price_formula: str | None = None
    yield_formula: str | None = None
    compound_yield_formula: str | None = None
    day_count_convention: str | None = None
    remarks: str | None = None
    brokerage: str | None = None
    security_type_detail: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class BondListItem(BaseModel):
    """Lightweight bond record for list views."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    isin_code: str
    issuer: str | None = None
    fund_user: str | None = None
    source_institution: str | None = None
    yield_type: str | None = None
    security_type: str | None = None
    currency: str = "TRY"
    maturity_date: date | None = None
    days_to_maturity: int | None = None
    last_issue_price: Decimal | None = None
    last_issue_yield: Decimal | None = None
    next_coupon_rate: Decimal | None = None
    spread: Decimal | None = None
    day_count_convention: str | None = None
    remarks: str | None = None
    is_active: bool = True


class BondListResponse(BaseModel):
    items: list[BondListItem]
    total: int


class FavoriteListResponse(BaseModel):
    """Kullanıcının favori tahvil listesi."""
    items: list[BondListItem]


class AddFavoriteRequest(BaseModel):
    isin_code: str


class BondCalculatedMetrics(BaseModel):
    """Tahvil detayinda gosterilen hesaplanan metrikler (TLREF, kirli fiyat, YTM, vb.)."""

    annual_reference_rate: float | None = None
    annual_coupon_rate: float | None = None
    periodic_coupon_rate: float | None = None
    annual_compound_coupon_rate: float | None = None
    accrued_interest: float
    dirty_price: float
    clean_price_used: float
    rate_change_today_pct: float | None = None
    yield_to_maturity: float | None = None
    spread: float | None = None
    contractual_spread: float | None = None
    remarks: str | None = None
    modified_duration: float | None = None
    macaulay_duration: float | None = None
    convexity: float | None = None
    coupon_payment_amount: float | None = None
    period_days: int | None = None
    next_coupon_date: str | None = None
    return_to_date_pct: float | None = None
    return_to_date_used_fallback_price: bool = False
    used_fallback_market_data: bool = False
    market_data_date: str | None = None
    tlref_rate_date: str | None = None
    is_theoretical: bool = False


class BondDetailWithMetrics(BondResponse):
    """Tahvil detay + hesaplanan metrikler (GET /bonds/{isin})."""

    calculated_metrics: BondCalculatedMetrics | None = None
    is_favorite: bool = False
    kap_data: dict | None = None
    kap_disclosures: list[dict] | None = None
    data_conflicts: list[dict] | None = None
    data_sources: list[dict] | None = None


class BondScenarioResponse(BaseModel):
    """TLREF şoku senaryosu: mevcut YTM/fiyat + şok sonrası tahmini değerler."""

    current_ytm: float
    current_dirty_price: float
    shock_bp: int
    new_ytm_approx: float
    new_dirty_price_approx: float
    price_change_pct: float
    modified_duration: float | None = None


class BondStatsResponse(BaseModel):
    total_bonds: int
    by_security_type: dict[str, int]
    by_currency: dict[str, int]
    by_yield_type: dict[str, int]
    avg_days_to_maturity: float | None = None
    by_maturity_bucket: dict[str, int] = {}


class YieldCurvePoint(BaseModel):
    isin_code: str
    issuer: str | None = None
    days_to_maturity: int
    ytm_pct: float
    yield_type: str | None = None
    security_type: str | None = None


class YieldCurveResponse(BaseModel):
    items: list[YieldCurvePoint]


class BondNoteResponse(BaseModel):
    isin_code: str
    note_text: str
    updated_at: datetime


class BondNoteUpsert(BaseModel):
    note_text: str
