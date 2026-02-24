"""
Tahvil hesaplama metrikleri: TLREF formulleri, kupon donemi, kirli fiyat, birikmis faiz,
YTM, durasyon, konveksite, oran degisimi. Bond modeli (tbliste) ile uyumlu.

Gun sayimi: Hesaplamalar 365 gun yili ve gercek gun sayimi (Act) ile yapilir.
Bond.day_count_convention (30/360 vb.) su an kullanilmaz; ileride eklenebilir.
"""

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FACE_VALUE
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.tlref_rate import TLREFRate
from app.services.bond_calculator import BondCalculator

logger = logging.getLogger(__name__)

# coupon_frequency string -> (period_days, frequency_per_year)
COUPON_FREQUENCY_MAP = [
    (r"6\s*ayda|yar[iı]?\s*y[iı]l|6\s*ay", (182, 2)),
    (r"y[iı]ll[iı]k|yillik|1\s*yil|yilda\s*1", (365, 1)),
    (r"3\s*ayda|3\s*ay|quarter", (91, 4)),
    (r"12\s*ayda|12\s*ay", (365, 1)),
    (r"ayda\s*bir|ayl[iı]k", (30, 12)),
]


def parse_coupon_frequency(coupon_frequency: str | None) -> tuple[int, int]:
    """
    coupon_frequency string -> (period_days, frequency_per_year).
    Varsayilan: 6 ayda bir -> (182, 2).
    """
    if not coupon_frequency or not str(coupon_frequency).strip():
        return 182, 2
    s = str(coupon_frequency).strip().lower()
    for pattern, (period_days, freq) in COUPON_FREQUENCY_MAP:
        if re.search(pattern, s, re.IGNORECASE):
            return period_days, freq
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


def annual_coupon_rate(annual_reference: Decimal | None, spread: Decimal | None) -> Decimal | None:
    """Yillik Kupon Faiz Orani = Yillik Gosterge + Yillik Basit Ek Getiri (spread)."""
    if annual_reference is None:
        return None
    spread_val = spread if spread is not None else Decimal("0")
    return (annual_reference + spread_val).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


def periodic_coupon_rate(annual_coupon: Decimal | None, period_days: int) -> Decimal | None:
    """Donemsel Kupon Faiz Orani = Yillik Kupon * (Kupon Donem Gun Sayisi / 365)."""
    if annual_coupon is None or period_days <= 0:
        return None
    return (annual_coupon * Decimal(str(period_days)) / Decimal("365")).quantize(
        Decimal("0.00000001"), rounding=ROUND_HALF_UP
    )


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


def bond_to_calculator_inputs(bond: Bond) -> tuple[date, date, Decimal, int] | None:
    """
    Bond -> (issue_date, maturity_date, coupon_rate, coupon_frequency_int).
    Eksik zorunlu alan varsa None. Donus tipi None degilse tarihler kesin dolu.
    """
    issue_date = bond.first_issue_date
    maturity_date = bond.maturity_date
    if not issue_date or not maturity_date:
        return None
    period_days, freq = parse_coupon_frequency(bond.coupon_frequency)
    coupon_rate = _coupon_rate_to_decimal(bond.next_coupon_rate)
    return (issue_date, maturity_date, coupon_rate, freq)


async def get_tlref_annual_yield_for_date(db: AsyncSession, target_date: date) -> Decimal | None:
    """
    Hedef tarih icin TLREF yillik getiri: daily_rate * 365.
    rate_date <= target_date olan en son kaydin daily_rate'i kullanilir; yoksa None.
    """
    result = await db.execute(
        select(TLREFRate)
        .where(TLREFRate.rate_date <= target_date)
        .order_by(TLREFRate.rate_date.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.daily_rate is not None:
        return row.daily_rate * Decimal("365")
    return None


class BondMetricsService:
    """Tahvil metriklerini TLREF ve Bond verisiyle hesaplar."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tlref_for_business_day(self, target_date: date) -> Decimal | None:
        """
        target_date icin 'onceki is gunu' TLREF index_value.
        rate_date <= target_date olan en son kayit.
        """
        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.rate_date <= target_date)
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row.index_value if row else None

    async def get_latest_daily_rate(self) -> Decimal | None:
        """Son bilinen TLREF gunluk oran (daily_rate), yuzde icin kullanilir."""
        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.daily_rate.isnot(None))
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row.daily_rate if row else None

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
        period_days, freq_per_year = parse_coupon_frequency(bond.coupon_frequency)
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
        if clean_price is None:
            clean_price, market_data_date = await self.get_clean_price(bond.id, settlement_date)
            if clean_price is None:
                logger.warning(f"No market data for bond {bond.isin_code} on date {settlement_date} (no fallback available)")
                return None
            if market_data_date != settlement_date:
                used_fallback_market_data = True
                logger.info(f"Using fallback market data for {bond.isin_code}: requested {settlement_date}, using {market_data_date}")

        clean_price = Decimal(str(clean_price))

        # TLREF oranlari (donem basi/sonu onceki is gunu)
        # Not: TLREF için "önceki iş günü" mantığı kullanılıyor, bu yüzden None kontrolü yapmıyoruz
        # Eğer TLREF verisi yoksa, ilgili metrikler None olarak kalacak
        tlref_start = await self.get_tlref_for_business_day(period_start) if period_start else None
        tlref_end = await self.get_tlref_for_business_day(period_end) if period_end else None

        annual_ref = None
        annual_coupon = None
        periodic_coupon = None
        if tlref_start and tlref_end and period_days > 0:
            annual_ref = annual_reference_rate(tlref_start, tlref_end, period_days)
            annual_coupon = annual_coupon_rate(annual_ref, bond.spread)
            periodic_coupon = periodic_coupon_rate(annual_coupon, period_days)

        # Birikmis faiz: TLREF'li ise Donemsel Kupon * (gun gecen / period_days) * nominal; degilse sabit kupon
        accrued_interest = None
        last_coupon = period_start  # donem basi = son kupon tarihi
        if period_start and period_end and settlement_date >= period_start:
            days_in_period = (period_end - period_start).days
            days_passed = (settlement_date - period_start).days
            if days_in_period > 0 and 0 <= days_passed <= days_in_period:
                if periodic_coupon is not None:
                    accrued_interest = (
                        FACE_VALUE
                        * periodic_coupon
                        * Decimal(str(days_passed))
                        / Decimal(str(days_in_period))
                    )
                elif bond.next_coupon_rate is not None:
                    coupon_payment = FACE_VALUE * _coupon_rate_to_decimal(bond.next_coupon_rate) / Decimal(str(freq_per_year))
                    accrued_interest = (
                        coupon_payment
                        * Decimal(str(days_passed))
                        / Decimal(str(days_in_period))
                    )
                if accrued_interest is not None:
                    accrued_interest = accrued_interest.quantize(
                        Decimal("0.00000001"), rounding=ROUND_HALF_UP
                    )

        if accrued_interest is None:
            accrued_interest = Decimal("0")

        dirty_price = (clean_price + accrued_interest).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP
        )

        # Oran degisimi (gunluk TLREF)
        daily_rate_pct = None
        latest_daily = await self.get_latest_daily_rate()
        if latest_daily is not None:
            daily_rate_pct = (latest_daily * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )

        # YTM, spread, duration, convexity: BondCalculator ile (Bond alanlarini esle)
        ytm = None
        spread_bp = None
        modified_duration = None
        macaulay_duration = None
        convexity = None
        coupon_payment_amount = None

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
                ytm = calc.yield_to_maturity(clean_price, settlement_date)
                if bond.next_coupon_rate is not None:
                    coupon_payment_amount = (
                        FACE_VALUE * _coupon_rate_to_decimal(bond.next_coupon_rate) / Decimal(str(coupon_frequency_int))
                    ).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
                tlref_yield = await self._get_tlref_annual_yield(settlement_date)
                if tlref_yield is not None:
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
            "accrued_interest": float(accrued_interest),
            "dirty_price": float(dirty_price),
            "clean_price_used": float(clean_price),
            "rate_change_today_pct": float(daily_rate_pct) if daily_rate_pct is not None else None,
            "yield_to_maturity": float(ytm) if ytm is not None else None,
            "spread": float(spread_bp) if spread_bp is not None else None,
            "modified_duration": float(modified_duration) if modified_duration is not None else None,
            "macaulay_duration": float(macaulay_duration) if macaulay_duration is not None else None,
            "convexity": float(convexity) if convexity is not None else None,
            "coupon_payment_amount": float(coupon_payment_amount) if coupon_payment_amount is not None else None,
            "period_days": period_days,
            "next_coupon_date": bond.next_coupon_date.isoformat() if bond.next_coupon_date else None,
            "return_to_date_pct": return_to_date_pct,
            "return_to_date_used_fallback_price": return_to_date_used_fallback_price,
            "used_fallback_market_data": used_fallback_market_data,
            "market_data_date": market_data_date.isoformat() if market_data_date else None,
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

    async def _get_tlref_annual_yield(self, target_date: date) -> Decimal | None:
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
