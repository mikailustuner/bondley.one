"""
Tahvil hesaplama metrikleri: TLREF formulleri, kupon donemi, kirli fiyat, birikmis faiz,
YTM, durasyon, konveksite, oran degisimi. Bond modeli (tbliste) ile uyumlu.

Gun sayimi: Hesaplamalar 365 gun yili ve gercek gun sayimi (Act) ile yapilir.
Bond.day_count_convention (30/360 vb.) su an kullanilmaz; ileride eklenebilir.
"""

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import json
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FACE_VALUE
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.calculation import Calculation
from app.models.tlref_rate import TLREFRate
from app.services.bond_calculator import BondCalculator

logger = logging.getLogger(__name__)

# coupon_frequency string -> (period_days, frequency_per_year)
# -1 sentinel = "Tek Kupon": actual duration computed from bond dates at call site
COUPON_FREQUENCY_MAP = [
    (r"tek\s*kupon|tek\s*öd|tek\s*od|single", (-1, 1)),
    (r"6\s*ayda|yar[iı]?\s*y[iı]l|6\s*ay|semi[- ]?annu", (182, 2)),
    (r"y[iı]ll[iı]k|yillik|1\s*yil|yilda\s*1|annu", (365, 1)),
    (r"3\s*ayda|3\s*ay|[üu]ç\s*ay|quarter", (91, 4)),
    (r"12\s*ayda|12\s*ay", (365, 1)),
    (r"ayda\s*bir|ayl[iı]k|monthly", (30, 12)),
]


def parse_coupon_frequency(coupon_frequency: str | None, bond: "Bond" = None) -> tuple[int, int]:
    """
    coupon_frequency string -> (period_days, frequency_per_year).
    Varsayilan: 6 ayda bir -> (182, 2).
    Eğer bilinmiyorsa ve kısa vadeli ise (<= 400 gün) -> (91, 4) varsayılır.
    """
    period_days, freq = 0, 0
    if coupon_frequency and str(coupon_frequency).strip():
        s = str(coupon_frequency).strip().lower()
        for pattern, (p_days, f) in COUPON_FREQUENCY_MAP:
            if re.search(pattern, s, re.IGNORECASE):
                period_days, freq = p_days, f
                break
    
    if freq >= 1:
        return period_days, freq
        
    # Fallback logic
    if bond and bond.first_issue_date and bond.maturity_date:
        total_days = (bond.maturity_date - bond.first_issue_date).days
        if 0 < total_days <= 400:
            return 91, 4
    return 182, 2


def get_current_coupon_period(
    first_issue_date: date | None,
    next_coupon_date: date | None,
    maturity_date: date | None,
    period_days: int,
    settlement_date: date,
) -> tuple[date | None, date | None]:
    """
    Yerlesim tarihi icin cari kupon donemi baslangic ve bitis tarihlerini dondurur.
    next_coupon_date bir sonraki kupon odeme gunu; donem bitisi = next_coupon_date,
    donem basi = next_coupon_date - period_days.
    """
    if not next_coupon_date:
        if not first_issue_date or not maturity_date or period_days <= 0:
            return None, None
        # Donemleri first_issue_date'den itibaren uret, settlement'i iceren donemi bul
        start = first_issue_date
        while start + timedelta(days=period_days) <= settlement_date:
            start = start + timedelta(days=period_days)
        end = start + timedelta(days=period_days)
        if end > maturity_date:
            end = maturity_date
        return start, end
    period_end = next_coupon_date
    period_start = period_end - timedelta(days=period_days)
    if first_issue_date and period_start < first_issue_date:
        period_start = first_issue_date
    return period_start, period_end


def annual_reference_rate(
    tlref_start: Decimal, tlref_end: Decimal, period_days: int
) -> Decimal | None:
    """
    Yillik Gosterge Faiz Orani =
    (TLREF_donem_sonu / TLREF_donem_basi - 1) * (365 / Kupon_Donem_Gun_Sayisi)
    """
    if not tlref_start or tlref_start <= 0 or period_days <= 0:
        return None
    growth = tlref_end / tlref_start
    periodic_return = growth - Decimal("1")
    annual_factor = Decimal("365") / Decimal(str(period_days))
    rate = periodic_return * annual_factor
    return rate.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


def _spread_to_decimal(spread: Decimal | None) -> Decimal:
    """
    Spread'i ondaliga cevirir. DB'de yuzde olarak saklanabilir (2.5 = %2.5);
    |spread| > 1 ise yuzde kabul edilip 100'e bolunur, aksi halde ondalik varsayilir.
    """
    if spread is None:
        return Decimal("0")
    s = Decimal(str(spread))
    if abs(s) >= 1:
        return s / Decimal("100")
    return s


def _extract_spread_from_remarks(remarks: str | None) -> Decimal | None:
    """
    Ultra-robust scanner for spread patterns in BIST remarks.
    Handles:
    - TLREF + %1,25 / TLREF+%3,75
    - 250 Baz Puan / 150 bp / 70bps / 150 Bbs / 150 BPS
    - TLREF endeks değişimi + 400 puan
    - TLREF + 100 bp (75 Baz Puan)
    """
    if not remarks:
        return None
        
    # Normalize: Turkish chars, lower case, comma to dot
    s = remarks.lower().replace("ı", "i").replace("ü", "u").replace("ç", "c").replace("ş", "s").replace("ö", "o").replace("ğ", "g")
    s = s.replace(",", ".")
    
    # Priority 1: Match percentages (e.g. %1.25 or + 1.25%)
    # Matches: %1.25, % 1.25, + %1.25, + 1.25%
    pct_match = re.search(r'%\s*(\d+\.?\d*)|\+\s*(\d+\.?\d*)\s*%', s)
    if pct_match:
        val = pct_match.group(1) or pct_match.group(2)
        try:
            return Decimal(val) / Decimal("100")
        except: pass

    # Priority 2: Match basis points (e.g. 250 bp, 500 bps, 75 baz puan, 400 puan)
    # Matches: 250 bp, 250bps, 150 bbs, 100 baz puan, 400 puan
    bp_match = re.search(r'(\d+\.?\d*)\s*(?:baz|bp|bps|bbs|puan)', s)
    if bp_match:
        try:
            return Decimal(bp_match.group(1)) / Decimal("10000")
        except: pass
        
    # Priority 3: Match simple formula patterns if no explicit unit found
    # Matches: tlref + 1.25, tlref+2.50
    formula_match = re.search(r'tlref\s*(?:k|endeks|endeksi|degisimi)?\s*\+\s*(\d+\.?\d*)', s)
    if formula_match:
        try:
            return Decimal(formula_match.group(1)) / Decimal("100")
        except: pass
        
    return None


def annual_coupon_rate(annual_reference: Decimal | None, spread: Decimal | None) -> Decimal | None:
    """Yillik Kupon Faiz Orani = Yillik Gosterge + Yillik Basit Ek Getiri (spread).
    annual_reference ondalik; spread DB'de yuzde olabileceginden normalize edilir."""
    if annual_reference is None:
        return None
    spread_val = _spread_to_decimal(spread)
    return (annual_reference + spread_val).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


def periodic_coupon_rate(annual_coupon: Decimal | None, period_days: int) -> Decimal | None:
    """Donemsel Kupon Faiz Orani = Yillik Kupon * (Kupon Donem Gun Sayisi / 365)."""
    if annual_coupon is None or period_days <= 0:
        return None
    return (annual_coupon * Decimal(str(period_days)) / Decimal("365")).quantize(
        Decimal("0.00000001"), rounding=ROUND_HALF_UP
    )


def annual_compound_coupon_rate(periodic_coupon: Decimal | None, period_days: int) -> Decimal | None:
    """Bileşik Getiri = (1 + Donemsel Kupon)^(365 / Donem Gun Sayisi) - 1."""
    if periodic_coupon is None or period_days <= 0:
        return None
    base = float(Decimal("1") + periodic_coupon)
    if base <= 0:
        return None
    compound = base ** (365.0 / period_days) - 1.0
    return Decimal(str(compound)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


def _coupon_rate_to_decimal(rate: Decimal | None) -> Decimal:
    """
    Kupon oranini kupon tutari formulu icin ondaliga cevirir.
    Veritabaninda yuzde (2.7958) veya ondalik (0.027958) saklanabiliyor; |rate| > 1 ise yuzde kabul edilir.
    """
    if rate is None:
        return Decimal("0")
    r = Decimal(str(rate))
    if abs(r) > 1:
        return r / Decimal("100")
    return r


def _is_tlref_indexed(bond: Bond) -> bool:
    """True if the bond's coupon is floating / TLREF-indexed."""
    text = " ".join(filter(None, [
        bond.yield_type or "",
        bond.yield_formula or "",
        bond.compound_yield_formula or "",
    ])).lower()
    return "tlref" in text or "değişken" in text or "degisken" in text or "floating" in text


def _resolve_period_days(bond: Bond, period_days: int) -> int:
    """Resolve -1 sentinel (Tek Kupon) to the actual bond duration in days."""
    if period_days == -1:
        if bond.first_issue_date and bond.maturity_date:
            return (bond.maturity_date - bond.first_issue_date).days
        return 365
    return period_days


def bond_to_calculator_inputs(bond: Bond) -> tuple[date, date, Decimal, int] | None:
    """
    Bond -> (issue_date, maturity_date, coupon_rate, coupon_frequency_int).
    """
    issue_date = bond.first_issue_date
    maturity_date = bond.maturity_date
    if not issue_date or not maturity_date:
        return None
        
    period_days, freq = parse_coupon_frequency(bond.coupon_frequency, bond)
    raw_rate = _coupon_rate_to_decimal(bond.next_coupon_rate)
    
    total_days = (maturity_date - issue_date).days
    
    # Radikal Düzeltme: Vadesi 1 yıldan kısa ve "Tek Kupon" (Bono) olanlar için frekans düzeltmesi.
    # Eğer kupon frekansı zaten 1 ise (Bono) veya "Tek Kupon" olarak işaretlenmişse freq=1 kalmalı.
    # Ancak çok kuponlu bir enstrüman ise (freq > 1), vadesi 365 günden az olsa bile (örn. 364 gün) frekansı koru.
    if total_days > 0 and total_days < 365 and freq == 1:
        # Oranı toplam vadeye göre yıllıklandır (%18.41 * 365 / 151 = %44.50)
        coupon_rate = raw_rate * Decimal("365") / Decimal(str(total_days))
        freq = 1
    else:
        # 1 yıldan uzun standart tahviller
        coupon_rate = raw_rate * Decimal(str(freq))
        
    return (issue_date, maturity_date, coupon_rate, freq)


async def get_tlref_annual_yield_for_date(
    db: AsyncSession, target_date: date
) -> tuple[Decimal | None, date | None]:
    """
    Hedef tarih icin TLREF yillik getiri: daily_rate * 365.
    rate_date <= target_date olan en son kaydin daily_rate'i kullanilir; yoksa None.
    """
    from app.core.cache import cache_get, cache_set
    cache_key = f"tlref_annual:{target_date.isoformat()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        data = json.loads(cached)
        rate = Decimal(data["rate"]) if data["rate"] else None
        rate_date = date.fromisoformat(data["date"]) if data["date"] else None
        return rate, rate_date

    result = await db.execute(
        select(TLREFRate)
        .where(TLREFRate.rate_date <= target_date)
        .order_by(TLREFRate.rate_date.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None, None
    if row.daily_rate is not None:
        rate = row.daily_rate * Decimal("365")
        await cache_set(
            cache_key,
            json.dumps({"rate": str(rate), "date": row.rate_date.isoformat()}),
            3600,
        )
        return rate, row.rate_date
    return None, row.rate_date


class BondMetricsService:
    """Tahvil metriklerini TLREF ve Bond verisiyle hesaplar."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tlref_for_business_day(self, target_date: date) -> Decimal | None:
        """
        target_date icin 'onceki is gunu' TLREF index_value.
        rate_date <= target_date olan en son kayit.
        """
        from app.core.cache import cache_get, cache_set
        cache_key = f"tlref_idx:{target_date.isoformat()}"
        cached = await cache_get(cache_key)
        if cached is not None:
            return Decimal(cached)

        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.rate_date < target_date)
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        val = row.index_value if row else None
        if val is not None:
            await cache_set(cache_key, str(val), 3600)
        return val

    async def get_latest_daily_rate(self) -> Decimal | None:
        """Son bilinen TLREF gunluk oran (daily_rate), yuzde icin kullanilir."""
        from app.core.cache import cache_get, cache_set
        cache_key = "tlref_daily_latest"
        cached = await cache_get(cache_key)
        if cached is not None:
            return Decimal(cached)

        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.daily_rate.isnot(None))
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        val = row.daily_rate if row else None
        if val is not None:
            await cache_set(cache_key, str(val), 3600)
        return val

    async def get_clean_price(self, bond_id: int, settlement_date: date) -> tuple[Decimal | None, date | None]:
        """Settlement tarihi icin market_data.clean_price; yoksa en son mevcut veriyi kullanir.
        Returns (clean_price, actual_data_date). actual_data_date settlement_date'ten farkliysa fallback kullanildi demektir."""
        # Oncelik: tam tarih eslesmesi
        result = await self.db.execute(
            select(MarketData.clean_price, MarketData.trade_date).where(
                MarketData.bond_id == bond_id,
                MarketData.trade_date == settlement_date,
            )
        )
        row = result.one_or_none()
        if row is not None and row[0] is not None:
            return Decimal(str(row[0])), row[1]

        # Fallback: en son mevcut market data (settlement_date'e en yakin onceki)
        fallback_result = await self.db.execute(
            select(MarketData.clean_price, MarketData.trade_date).where(
                MarketData.bond_id == bond_id,
                MarketData.trade_date < settlement_date,
                MarketData.clean_price.isnot(None),
            ).order_by(MarketData.trade_date.desc()).limit(1)
        )
        fallback_row = fallback_result.one_or_none()
        if fallback_row is not None and fallback_row[0] is not None:
            return Decimal(str(fallback_row[0])), fallback_row[1]

        return None, None

    async def compute_metrics(
        self,
        bond: Bond,
        settlement_date: date,
        clean_price_override: Decimal | None = None,
    ) -> dict | None:
        """
        Tek tahvil icin tum hesaplanan metrikleri uretir.
        Belirli tarih icin market_data yoksa None dondurur (varsayilan deger kullanmaz).
        clean_price: market_data'dan; override verilirse o kullanilir.
        """
        period_days, freq_per_year = parse_coupon_frequency(bond.coupon_frequency, bond)
        period_days = _resolve_period_days(bond, period_days)
        period_start, period_end = get_current_coupon_period(
            bond.first_issue_date,
            bond.next_coupon_date,
            bond.maturity_date,
            period_days,
            settlement_date,
        )

        # Belirli tarih icin market data kontrolu - yoksa fallback kullan
        clean_price = clean_price_override
        market_data_date = settlement_date
        used_fallback_market_data = False
        is_theoretical = False
        if clean_price is None:
            clean_price, market_data_date = await self.get_clean_price(bond.id, settlement_date)
            if clean_price is None:
                # Fallback: Yield-to-Price calculation
                stale_limit = 5
                limit_date = settlement_date - timedelta(days=stale_limit)
                fallback_calc = await self.db.execute(
                    select(Calculation)
                    .where(
                        Calculation.bond_id == bond.id,
                        Calculation.calc_date < settlement_date,
                        Calculation.calc_date >= limit_date,
                        Calculation.spread.isnot(None),
                    )
                    .order_by(Calculation.calc_date.desc())
                    .limit(1)
                )
                last_calc = fallback_calc.scalar_one_or_none()
                tlref_rate, _ = await get_tlref_annual_yield_for_date(self.db, settlement_date)
                
                theoretical_spread = None
                if last_calc and last_calc.spread is not None:
                    theoretical_spread = last_calc.spread
                elif bond.spread is not None:
                    theoretical_spread = _spread_to_decimal(bond.spread)

                if theoretical_spread is not None and tlref_rate:
                    theoretical_ytm = tlref_rate + theoretical_spread
                    inputs = bond_to_calculator_inputs(bond)
                    if inputs:
                        issue_date, maturity_date, coupon_rate, coupon_frequency_int = inputs
                        calc = BondCalculator(
                            isin=bond.isin_code,
                            issue_date=issue_date,
                            maturity_date=maturity_date,
                            coupon_rate=coupon_rate,
                            face_value=FACE_VALUE,
                            coupon_frequency=coupon_frequency_int,
                            next_coupon_date=bond.next_coupon_date,
                        )
                        try:
                            calc_price = calc.clean_price_from_yield(theoretical_ytm, settlement_date)
                            if calc_price > 0:
                                clean_price = calc_price
                                market_data_date = settlement_date
                                is_theoretical = True
                        except Exception as e:
                            logger.warning(f"Theoretical price calc failed in compute_metrics for {bond.isin_code}: {e}")

                if clean_price is None:
                    logger.warning(f"No market data or theoretical price for bond {bond.isin_code} on date {settlement_date}")
                    return None
            elif market_data_date != settlement_date:
                used_fallback_market_data = True
                logger.info(f"Using fallback market data for {bond.isin_code}: requested {settlement_date}, using {market_data_date}")

        clean_price = Decimal(str(clean_price))

        # Initialize BondCalculator early to use its logic for rates and periods
        calc = None
        inputs = bond_to_calculator_inputs(bond)
        if inputs:
            issue_date, maturity_date, coupon_rate, coupon_frequency_int = inputs
            try:
                calc = BondCalculator(
                    isin=bond.isin_code,
                    issue_date=issue_date,
                    maturity_date=maturity_date,
                    coupon_rate=coupon_rate,
                    face_value=FACE_VALUE,
                    coupon_frequency=coupon_frequency_int,
                    next_coupon_date=bond.next_coupon_date,
                )
            except Exception as e:
                logger.warning("BondCalculator init failed for %s: %s", bond.isin_code, e)

        annual_ref = None
        annual_coupon = None
        periodic_coupon = None
        compound_coupon = None

        # Resolve effective period for annualization
        # NOT: Override işlemi sadece "Tek Kupon" (freq_per_year=1 ve period_days >= total_days) durumunda yapılmalı.
        # Çok kuponlu tahvillerde (örn. 364 gün vadeli ama 4 kuponlu), annualization kupon dönemine (91 gün) göre yapılmalıdır.
        eff_period = period_days
        if bond.first_issue_date and bond.maturity_date:
            actual_days = (bond.maturity_date - bond.first_issue_date).days
            if 0 < actual_days < 365 and freq_per_year == 1:
                eff_period = actual_days

        if _is_tlref_indexed(bond):
            # Değişken faizli: dönem TLREF endeksi büyümesinden hesapla
            tlref_start = await self.get_tlref_for_business_day(period_start) if period_start else None
            tlref_end = await self.get_tlref_for_business_day(period_end) if period_end else None
            if tlref_start and tlref_end and eff_period > 0:
                annual_ref = annual_reference_rate(tlref_start, tlref_end, eff_period)
                
                # Use bond.spread, or try to extract from remarks if NULL
                active_spread = bond.spread
                if active_spread is None or active_spread == 0:
                    extracted = _extract_spread_from_remarks(bond.remarks)
                    if extracted is not None:
                        active_spread = extracted * Decimal("100") # Normalize back to percentage for annual_coupon_rate
                
                annual_coupon = annual_coupon_rate(annual_ref, active_spread)
                periodic_coupon = periodic_coupon_rate(annual_coupon, eff_period)
                compound_coupon = annual_compound_coupon_rate(periodic_coupon, eff_period)
                
                # RE-INITIALIZE BondCalculator with calculated rate if DB rate is 0 or missing
                # This ensures accrued_interest and other metrics use the current floating rate
                if annual_coupon and (not calc or coupon_rate == 0):
                    try:
                        # For calculator, we need the annual simple coupon rate
                        # If freq_per_year is 1, it's already annualized for the whole period
                        calc_coupon_rate = annual_coupon
                        calc = BondCalculator(
                            isin=bond.isin_code,
                            issue_date=bond.first_issue_date,
                            maturity_date=bond.maturity_date,
                            coupon_rate=calc_coupon_rate,
                            face_value=FACE_VALUE,
                            coupon_frequency=freq_per_year,
                            next_coupon_date=bond.next_coupon_date,
                        )
                    except Exception as e:
                        logger.warning("BondCalculator re-init failed: %s", e)
        else:
            # Sabit faizli: BondCalculator verisini veya DB'deki oranı kullan
            if calc:
                annual_coupon = calc.coupon_rate
                compound_coupon = calc.compound_coupon_rate()
                periodic_coupon = _coupon_rate_to_decimal(bond.next_coupon_rate)
            else:
                raw_periodic = _coupon_rate_to_decimal(bond.next_coupon_rate)
                if raw_periodic > 0 and eff_period > 0:
                    annual_coupon = (
                        raw_periodic * Decimal("365") / Decimal(str(eff_period))
                    ).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
                    periodic_coupon = raw_periodic
                    compound_coupon = annual_compound_coupon_rate(raw_periodic, eff_period)

        # Birikmis faiz and price initialization
        accrued_interest = Decimal("0")
        dirty_price = Decimal("0")

        # Oran degisimi (Temiz Fiyat uzerinden gunluk % degisim)
        daily_rate_pct = None
        yest_clean_price, _ = await self.get_clean_price(bond.id, settlement_date - timedelta(days=1))
        
        if yest_clean_price is not None and clean_price is not None and yest_clean_price > 0:
            daily_rate_pct = ((clean_price - yest_clean_price) / yest_clean_price * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )

        # YTM, spread, duration, convexity: BondCalculator ile (Bond alanlarini esle)
        ytm = None
        spread_bp = None
        modified_duration = None
        macaulay_duration = None
        convexity = None
        coupon_payment_amount = None
        tlref_rate_date = None

        if calc:
            try:
                ytm = calc.yield_to_maturity(clean_price, settlement_date)
                # Use BondCalculator's verified accrued interest and dirty price
                accrued_interest = calc.accrued_interest(settlement_date)
                dirty_price = calc.dirty_price(clean_price, settlement_date)
                
                if periodic_coupon is not None:
                    coupon_payment_amount = (
                        FACE_VALUE * periodic_coupon
                    ).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
                elif bond.next_coupon_rate is not None:
                    coupon_payment_amount = (
                        FACE_VALUE * _coupon_rate_to_decimal(bond.next_coupon_rate) / Decimal(str(calc.coupon_frequency))
                    ).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

                tlref_yield, tlref_rate_date = await self._get_tlref_annual_yield(settlement_date)
                # Fix C: ytm==0 ama nakit akisi varsa hesaplama basarisizdir; spread None kalsin.
                ytm_valid = ytm != 0 or not calc.generate_cash_flows(settlement_date)
                if tlref_yield is not None and ytm_valid:
                    spread_bp = calc.spread(ytm, tlref_yield)
                modified_duration = calc.modified_duration(clean_price, settlement_date)
                macaulay_duration = calc.macaulay_duration(clean_price, settlement_date)
                convexity = self._convexity(calc, clean_price, settlement_date)
            except Exception as e:
                logger.warning("BondCalculator metrics failed for %s: %s", bond.isin_code, e)

        # Bugüne kadar getiri: ihraçtan settlement'e, başlangıç fiyatı (last_issue_price veya 100) üzerinden
        return_to_date_pct = None
        return_to_date_used_fallback_price = False
        if bond.first_issue_date and (settlement_date - bond.first_issue_date).days > 0:
            start_price = (
                Decimal(str(bond.last_issue_price))
                if bond.last_issue_price is not None
                else Decimal("100")
            )
            return_to_date_used_fallback_price = bond.last_issue_price is None
            if coupon_payment_amount is not None:
                coupon_pay = Decimal(str(coupon_payment_amount))
            else:
                coupon_pay = (
                    FACE_VALUE
                    * _coupon_rate_to_decimal(bond.next_coupon_rate)
                    / Decimal(str(freq_per_year))
                )
            n_coupons = 0
            t = bond.first_issue_date
            while t + timedelta(days=period_days) <= settlement_date and (
                not bond.maturity_date or t < bond.maturity_date
            ):
                n_coupons += 1
                t = t + timedelta(days=period_days)
            coupons_received = coupon_pay * n_coupons
            total_return = (coupons_received + (clean_price - start_price)) / start_price
            return_to_date_pct = float(
                (total_return * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            )

        return {
            "annual_reference_rate": float(annual_ref) if annual_ref is not None else None,
            "annual_coupon_rate": float(annual_coupon) if annual_coupon is not None else None,
            "periodic_coupon_rate": float(periodic_coupon) if periodic_coupon is not None else None,
            "annual_compound_coupon_rate": float(compound_coupon) if compound_coupon is not None else None,
            "accrued_interest": float(accrued_interest),
            "dirty_price": float(dirty_price),
            "clean_price_used": float(clean_price),
            "rate_change_today_pct": float(daily_rate_pct) if daily_rate_pct is not None else None,
            "yield_to_maturity": float(ytm) if ytm is not None else None,
            "spread": float(spread_bp) if spread_bp is not None else None,
            "contractual_spread": float(active_spread) if active_spread is not None else None,
            "remarks": bond.remarks,
            "modified_duration": float(modified_duration) if modified_duration is not None else None,
            "macaulay_duration": float(macaulay_duration) if macaulay_duration is not None else None,
            "convexity": float(convexity) if convexity is not None else None,
            "coupon_payment_amount": float(coupon_payment_amount) if coupon_payment_amount is not None else None,
            "period_days": period_days,
            "next_coupon_date": (
                bond.maturity_date.isoformat()
                if bond.maturity_date and bond.first_issue_date
                and (bond.maturity_date - bond.first_issue_date).days < 365
                else (bond.next_coupon_date.isoformat() if bond.next_coupon_date else None)
            ),
            "return_to_date_pct": return_to_date_pct,
            "return_to_date_used_fallback_price": return_to_date_used_fallback_price,
            "used_fallback_market_data": used_fallback_market_data,
            "market_data_date": market_data_date.isoformat() if market_data_date else None,
            "tlref_rate_date": tlref_rate_date.isoformat() if tlref_rate_date else None,
            "is_theoretical": is_theoretical,
        }

    def compute_return_to_date_only(
        self,
        bond: Bond,
        settlement_date: date,
        clean_price: Decimal | float,
    ) -> tuple[float | None, bool]:
        """
        Sadece 'bugüne kadar getiri' metrigini hesaplar (stored calc path'inde kullanilir).
        Returns (return_to_date_pct, return_to_date_used_fallback_price).
        """
        return_to_date_pct = None
        return_to_date_used_fallback_price = False
        if not bond.first_issue_date or (settlement_date - bond.first_issue_date).days <= 0:
            return (None, False)
        clean_price_dec = Decimal(str(clean_price))
        period_days, freq_per_year = parse_coupon_frequency(bond.coupon_frequency)
        period_days = _resolve_period_days(bond, period_days)
        start_price = (
            Decimal(str(bond.last_issue_price))
            if bond.last_issue_price is not None
            else Decimal("100")
        )
        return_to_date_used_fallback_price = bond.last_issue_price is None
        coupon_pay = (
            FACE_VALUE
            * _coupon_rate_to_decimal(bond.next_coupon_rate)
            / Decimal(str(freq_per_year))
        )
        n_coupons = 0
        t = bond.first_issue_date
        while t + timedelta(days=period_days) <= settlement_date and (
            not bond.maturity_date or t < bond.maturity_date
        ):
            n_coupons += 1
            t = t + timedelta(days=period_days)
        coupons_received = coupon_pay * n_coupons
        total_return = (coupons_received + (clean_price_dec - start_price)) / start_price
        return_to_date_pct = float(
            (total_return * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )
        return (return_to_date_pct, return_to_date_used_fallback_price)

    async def _get_tlref_annual_yield(self, target_date: date) -> tuple[Decimal | None, date | None]:
        return await get_tlref_annual_yield_for_date(self.db, target_date)

    def _convexity(
        self, calc: BondCalculator, clean_price: Decimal, settlement_date: date
    ) -> Decimal | None:
        """
        Konveksite: fiyatin getiriye gore ikinci turevi.
        Sum( t*(t+1)*PV(CF_t) / (1+y)^2 ) / Price; t = period index (1,2,...), y = periyodik getiri.
        """
        try:
            d_price = calc.dirty_price(clean_price, settlement_date)
            cash_flows = calc.generate_cash_flows(settlement_date)
            ytm = calc.yield_to_maturity(clean_price, settlement_date)
            if not cash_flows or ytm == 0 or d_price == 0:
                return None
            periodic_yield = ytm / Decimal(str(calc.coupon_frequency))
            conv_sum = Decimal("0")
            for t, cf in enumerate(cash_flows, start=1):
                discount = (Decimal("1") + periodic_yield) ** t
                if discount != 0:
                    pv = cf.amount / discount
                    conv_sum += Decimal(str(t * (t + 1))) * pv / ((Decimal("1") + periodic_yield) ** 2)
            convexity = conv_sum / d_price
            return convexity.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        except Exception:
            return None