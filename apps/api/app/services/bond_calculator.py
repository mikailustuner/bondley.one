"""
Turk Devlet Tahvilleri icin finansal hesaplama motoru.

Tum hesaplamalarda Decimal aritmetigi kullanilir.
float donusumu yalnizca numpy_financial.irr() cagrisi icin yapilir
ve sonuc hemen Decimal'e geri cevirilir.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

import numpy_financial as npf


@dataclass
class BondCashFlow:
    payment_date: date
    amount: Decimal


class BondCalculator:
    COUPON_PERIOD_DAYS = 182

    def __init__(
        self,
        isin: str,
        issue_date: date,
        maturity_date: date,
        coupon_rate: Decimal,
        face_value: Decimal = Decimal("100"),
        coupon_frequency: int = 2,
    ):
        self.isin = isin
        self.issue_date = issue_date
        self.maturity_date = maturity_date
        self.coupon_rate = Decimal(str(coupon_rate))
        self.face_value = Decimal(str(face_value))
        self.coupon_frequency = coupon_frequency
        self.coupon_payment = (
            self.face_value * self.coupon_rate / Decimal(str(self.coupon_frequency))
        )

    def _last_coupon_date(self, settlement_date: date) -> date:
        """Son kupon odeme tarihini hesapla (settlement_date'den onceki en yakin kupon)."""
        coupon_dates = self._all_coupon_dates()
        last = self.issue_date
        for d in coupon_dates:
            if d > settlement_date:
                break
            last = d
        return last

    def _next_coupon_date(self, settlement_date: date) -> date:
        """Bir sonraki kupon odeme tarihini hesapla."""
        coupon_dates = self._all_coupon_dates()
        for d in coupon_dates:
            if d > settlement_date:
                return d
        return self.maturity_date

    def _all_coupon_dates(self) -> list[date]:
        """Ihrac tarihinden vadeye kadar tum kupon tarihlerini uret."""
        dates = []
        period_days = 365 // self.coupon_frequency
        current = self.issue_date + timedelta(days=period_days)
        while current <= self.maturity_date:
            dates.append(current)
            current += timedelta(days=period_days)
        if not dates or dates[-1] != self.maturity_date:
            dates.append(self.maturity_date)
        return dates

    def accrued_interest(self, settlement_date: date) -> Decimal:
        """
        Birikmis Faiz = C * (D_passed / D_period)

        C: Kupon odemesi
        D_passed: Son kupon tarihinden settlement_date'e gecen gun
        D_period: Iki kupon arasi toplam gun (Turkiye tahvilleri: 182)
        """
        last_coupon = self._last_coupon_date(settlement_date)
        days_passed = Decimal(str((settlement_date - last_coupon).days))
        period_days = Decimal(str(self.COUPON_PERIOD_DAYS))

        accrued = self.coupon_payment * (days_passed / period_days)
        return accrued.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def dirty_price(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Kirli Fiyat = Temiz Fiyat + Birikmis Faiz
        P_dirty = P_clean + (C * D_passed / D_period)
        """
        clean = Decimal(str(clean_price))
        accrued = self.accrued_interest(settlement_date)
        return (clean + accrued).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def generate_cash_flows(self, settlement_date: date) -> list[BondCashFlow]:
        """
        Gelecekteki nakit akislarini uret.
        Son kupon + anapara odemesini icerir.
        """
        flows: list[BondCashFlow] = []
        coupon_dates = self._all_coupon_dates()

        for i, coupon_date in enumerate(coupon_dates):
            if coupon_date <= settlement_date:
                continue

            is_last = coupon_date == self.maturity_date or i == len(coupon_dates) - 1
            if is_last:
                amount = self.coupon_payment + self.face_value
            else:
                amount = self.coupon_payment

            flows.append(BondCashFlow(payment_date=coupon_date, amount=amount))

        return flows

    def yield_to_maturity(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Ic Verim Orani (IRR / Yield to Maturity).

        Nakit akis dizisi: [-Kirli_Fiyat, Kupon1, Kupon2, ..., KuponN + Anapara]
        numpy_financial.irr() ile hesaplanir.
        Sonuc yillik orana cevirilir.
        """
        d_price = self.dirty_price(clean_price, settlement_date)
        cash_flows = self.generate_cash_flows(settlement_date)

        if not cash_flows:
            return Decimal("0")

        cf_values = [-float(d_price)] + [float(cf.amount) for cf in cash_flows]

        period_irr = npf.irr(cf_values)

        if period_irr is None or period_irr != period_irr:  # NaN check
            return Decimal("0")

        annual_yield = Decimal(str(period_irr)) * Decimal(str(self.coupon_frequency))
        return annual_yield.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def spread(self, bond_yield: Decimal, tlref_yield: Decimal) -> Decimal:
        """
        Spread = Yield_Bond - Yield_Benchmark (TLREF)
        Sonuc baz puan (bp) olarak dondurulur.
        """
        s = Decimal(str(bond_yield)) - Decimal(str(tlref_yield))
        return s.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def modified_duration(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Modifiye Durasyon = Macaulay Durasyon / (1 + y/k)
        y: periyodik verim, k: kupon frekansi
        """
        mac_dur = self.macaulay_duration(clean_price, settlement_date)
        ytm = self.yield_to_maturity(clean_price, settlement_date)

        if ytm == 0:
            return Decimal("0")

        periodic_yield = ytm / Decimal(str(self.coupon_frequency))
        mod_dur = mac_dur / (Decimal("1") + periodic_yield)
        return mod_dur.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def macaulay_duration(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Macaulay Durasyon = Sum(t_i * PV(CF_i)) / Price
        t_i: yil olarak zaman, PV: bugunki deger
        """
        d_price = self.dirty_price(clean_price, settlement_date)
        cash_flows = self.generate_cash_flows(settlement_date)
        ytm = self.yield_to_maturity(clean_price, settlement_date)

        if not cash_flows or ytm == 0 or d_price == 0:
            return Decimal("0")

        periodic_yield = ytm / Decimal(str(self.coupon_frequency))
        weighted_sum = Decimal("0")

        for cf in cash_flows:
            days_to_cf = Decimal(str((cf.payment_date - settlement_date).days))
            years = days_to_cf / Decimal("365")
            periods = days_to_cf / Decimal(str(self.COUPON_PERIOD_DAYS))
            discount = (Decimal("1") + periodic_yield) ** periods
            if discount != 0:
                pv = cf.amount / discount
                weighted_sum += years * pv

        duration = weighted_sum / d_price
        return duration.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def full_analysis(self, clean_price: Decimal, settlement_date: date, tlref_rate: Decimal | None = None) -> dict:
        """Tek seferde tum hesaplamalari calistir."""
        ai = self.accrued_interest(settlement_date)
        dp = self.dirty_price(clean_price, settlement_date)
        ytm = self.yield_to_maturity(clean_price, settlement_date)
        mac_dur = self.macaulay_duration(clean_price, settlement_date)
        mod_dur = self.modified_duration(clean_price, settlement_date)

        sprd = None
        if tlref_rate is not None:
            sprd = self.spread(ytm, Decimal(str(tlref_rate)))

        return {
            "isin": self.isin,
            "settlement_date": settlement_date,
            "clean_price": clean_price,
            "accrued_interest": ai,
            "dirty_price": dp,
            "yield_to_maturity": ytm,
            "spread": sprd,
            "macaulay_duration": mac_dur,
            "modified_duration": mod_dur,
            "cash_flows": [
                {"date": cf.payment_date.isoformat(), "amount": str(cf.amount)}
                for cf in self.generate_cash_flows(settlement_date)
            ],
        }
