"""
Turk Devlet Tahvilleri icin finansal hesaplama motoru.

- Tum hesaplamalarda Decimal aritmetigi kullanilir.
- float donusumu yalnizca YTM bisection cozumu ve durasyon icin yapilir; sonuclar Decimal'e cevrilir.
- YTM: Bond Equivalent Yield (BEY); donem ici settlement'ta kesirli donem DCF ile bisection kullanilir.
- Birikmis faiz ve kupon donemi: Act/Act (gercek gun sayimi). day_count_convention (30/360 vb.) su an uygulanmaz.
- Spread: Ondalik doner (0.01 = %1 = 100 bp). Baz puan icin 10000 ile carpin.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

@dataclass
class BondCashFlow:
    payment_date: date
    amount: Decimal


class BondCalculator:
    def __init__(
        self,
        isin: str,
        issue_date: date,
        maturity_date: date,
        coupon_rate: Decimal,
        face_value: Decimal = Decimal("100"),
        coupon_frequency: int = 2,
        next_coupon_date: date | None = None,
    ):
        if coupon_frequency < 1:
            raise ValueError("coupon_frequency must be >= 1")
        self.isin = isin
        self.issue_date = issue_date
        self.maturity_date = maturity_date
        self.coupon_rate = Decimal(str(coupon_rate))
        self.face_value = Decimal(str(face_value))

        # Tek odemeli (Bono) veya vadesi kisa olanlar icin frekans duzeltmesi.
        # ANCAK: Eger anchor (next_coupon_date) verilmisse ve maturity'den farkliysa, 
        # bu kesinlikle cok kuponlu bir enstrumandir; frekansi 1'e zorlama.
        total_days = (maturity_date - issue_date).days
        is_truly_single = next_coupon_date is None or next_coupon_date >= maturity_date
        
        if is_truly_single and coupon_frequency > 1 and total_days < (365 // coupon_frequency + 30):
            self.coupon_frequency = 1
        else:
            self.coupon_frequency = coupon_frequency

        self._next_coupon_date_anchor = next_coupon_date
        
        if self.coupon_frequency == 1:
            # Yillik basit faiz uzerinden vade sonu faiz tutari
            self.coupon_payment = (
                self.face_value * self.coupon_rate * Decimal(str(total_days)) / Decimal("365")
            )
        else:
            self.coupon_payment = (
                self.face_value * self.coupon_rate / Decimal(str(self.coupon_frequency))
            )

    def _validate_settlement(self, settlement_date: date) -> None:
        """Raises ValueError if settlement is after maturity (YTM/price undefined)."""
        if settlement_date > self.maturity_date:
            raise ValueError(
                f"settlement_date ({settlement_date}) cannot be after maturity_date ({self.maturity_date})"
            )

    def _validate_clean_price(self, clean_price: Decimal) -> None:
        """Raises ValueError if clean_price is not strictly positive."""
        p = Decimal(str(clean_price))
        if p <= 0:
            raise ValueError("clean_price must be strictly positive")

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
        """
        Ihrac tarihinden vadeye kadar tum kupon tarihlerini uret.
        next_coupon_date verildiyse BIST ile uyumlu olarak o tarihten geriye/ileriye period_days ile uretir.
        """
        period_days = 365 // max(1, self.coupon_frequency)
        if self._next_coupon_date_anchor is not None:
            anchor = self._next_coupon_date_anchor
            dates = []
            current = anchor
            # Forward from anchor
            while current < self.maturity_date:
                dates.append(current)
                current += timedelta(days=period_days)
            
            # Backward from anchor
            current = anchor - timedelta(days=period_days)
            while current > self.issue_date:
                dates.append(current)
                current -= timedelta(days=period_days)
            
            dates.append(self.maturity_date)
            dates.sort()
            
            # Unique dates only
            seen = set()
            unique_dates = []
            for d in dates:
                if d not in seen:
                    unique_dates.append(d)
                    seen.add(d)
            return unique_dates
        dates = []
        current = self.issue_date + timedelta(days=period_days)
        while current <= self.maturity_date:
            dates.append(current)
            current += timedelta(days=period_days)
        if not dates or dates[-1] != self.maturity_date:
            dates.append(self.maturity_date)
        return dates

    def _period_days(self) -> int:
        """Iki kupon arasi gun sayisi; _all_coupon_dates ile uyumlu (365 // coupon_frequency)."""
        return 365 // max(1, self.coupon_frequency)

    def accrued_interest(self, settlement_date: date) -> Decimal:
        """
        Birikmis Faiz = C * (D_passed / D_period)
        Act/Act: D_period = gercek donem gunu (son kupon -> sonraki kupon).

        C: Kupon odemesi
        D_passed: Son kupon tarihinden settlement_date'e gecen gun
        D_period: Donem icindeki gercek gun sayisi (next_coupon - last_coupon)
        """
        self._validate_settlement(settlement_date)
        last_coupon = self._last_coupon_date(settlement_date)
        next_coupon = self._next_coupon_date(settlement_date)
        
        # Tek odemeli bonolarda last_coupon her zaman issue_date'dir
        if self.coupon_frequency == 1:
            last_coupon = self.issue_date
            next_coupon = self.maturity_date

        days_passed = (settlement_date - last_coupon).days
        
        if self.coupon_frequency == 1:
            # Bono icin Birikmis Faiz: Nominal * Oran * (Gecen Gun / 365)
            accrued = self.face_value * self.coupon_rate * Decimal(str(days_passed)) / Decimal("365")
        else:
            days_in_period = (next_coupon - last_coupon).days
            if days_in_period <= 0:
                return Decimal("0")
            accrued = self.coupon_payment * (
                Decimal(str(days_passed)) / Decimal(str(days_in_period))
            )
        return accrued.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def dirty_price(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Kirli Fiyat = Temiz Fiyat + Birikmis Faiz
        P_dirty = P_clean + (C * D_passed / D_period)
        """
        self._validate_clean_price(clean_price)
        self._validate_settlement(settlement_date)
        clean = Decimal(str(clean_price))
        accrued = self.accrued_interest(settlement_date)
        return (clean + accrued).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def generate_cash_flows(self, settlement_date: date) -> list[BondCashFlow]:
        """
        Gelecekteki nakit akislarini uret.
        Son kupon + anapara odemesini icerir.
        """
        self._validate_settlement(settlement_date)
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
        Ic Verim Orani / Yield to Maturity (BEY).
        Bisection ile DCF denkleminin kokunu bulur:

            P_dirty = sum_i CF_i / (1 + y/k)^{d_i / period_days}

        d_i: settlement'dan CF_i'ye gun sayisi, k: kupon frekansi.
        Donus BEY: y (yillik, ondalik). Donem ici settlement icin
        kesirli donem ustellendirmesi kullanildigindan numpy_financial.irr'nin
        esit aralik varsayimindaki onyargi ortadan kalkar.
        """
        self._validate_settlement(settlement_date)
        self._validate_clean_price(clean_price)
        d_price = float(self.dirty_price(clean_price, settlement_date))
        cash_flows = self.generate_cash_flows(settlement_date)

        if not cash_flows or d_price <= 0:
            return Decimal("0")

        k = self.coupon_frequency
        period_days = self._period_days()

        times = [
            (cf.payment_date - settlement_date).days / period_days
            for cf in cash_flows
        ]
        amounts = [float(cf.amount) for cf in cash_flows]

        # Fix A: tek nakit akisi icin dogrudan algebraik cozum.
        # Kisa vadeli tahvillerde bisection araliginin disina cikan YTM degerlerini
        # (vade ~2 gun, fiyat par'dan uzak) dogru hesaplar.
        if len(cash_flows) == 1 and times[0] > 0 and d_price > 0:
            ratio = amounts[0] / d_price
            if ratio > 0:
                y = k * (ratio ** (1.0 / times[0]) - 1)
                # Sanity check: cap extreme yields caused by stale prices/near-zero time
                if y > 1000.0:
                    y = 1000.0
                return Decimal(str(y)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

        def npv(y: float) -> float:
            factor = 1.0 + y / k
            if factor <= 0:
                return float("inf")
            return sum(a / (factor ** t) for a, t in zip(amounts, times)) - d_price

        lo, hi = -0.99, 10.0  # -99% ile +1000% arasi makul aralik
        f_lo = npv(lo)
        f_hi = npv(hi)
        if f_lo * f_hi > 0:
            # Kok bu aralikta degil; fiyat geri donsun.
            return Decimal("0")

        for _ in range(200):
            mid = 0.5 * (lo + hi)
            f_mid = npv(mid)
            if abs(f_mid) < 1e-10 or (hi - lo) < 1e-12:
                lo = hi = mid
                break
            if f_lo * f_mid <= 0:
                hi = mid
                f_hi = f_mid
            else:
                lo = mid
                f_lo = f_mid

        ytm = 0.5 * (lo + hi)
        return Decimal(str(ytm)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def dirty_price_from_yield(self, ytm: Decimal, settlement_date: date) -> Decimal:
        """
        Verilen YTM (BEY) oranina gore tahvilin kirli fiyatini (Dirty Price) hesaplar.
        """
        self._validate_settlement(settlement_date)
        cash_flows = self.generate_cash_flows(settlement_date)
        if not cash_flows:
            return Decimal("0")
            
        y = float(ytm)
        k = self.coupon_frequency
        period_days = self._period_days()
        
        times = [
            (cf.payment_date - settlement_date).days / period_days
            for cf in cash_flows
        ]
        amounts = [float(cf.amount) for cf in cash_flows]
        
        factor = 1.0 + y / k
        if factor <= 0:
            return Decimal("0")
            
        d_price = sum(a / (factor ** t) for a, t in zip(amounts, times))
        return Decimal(str(d_price)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    def clean_price_from_yield(self, ytm: Decimal, settlement_date: date) -> Decimal:
        """
        Verilen YTM oranina gore tahvilin temiz fiyatini (Clean Price) hesaplar.
        Clean Price = Dirty Price - Accrued Interest
        """
        d_price = self.dirty_price_from_yield(ytm, settlement_date)
        if d_price == 0:
            return Decimal("0")
        accrued = self.accrued_interest(settlement_date)
        return (d_price - accrued).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


    def spread(self, bond_yield: Decimal, tlref_yield: Decimal) -> Decimal:
        """
        Piyasa ima spread'i: Spread = YTM(BEY) - TLREF(yillik basit).
        Sonuc ondalik (0.01 = %1 = 100 bp). Baz puan icin 10000 ile carpin.

        Not: BEY ve simple annual yillari farkli annualize eder; teorik olarak
        negatif cikabilir (fiyat yuksek, tahvil TLREF'in altinda getiri veriyor).
        Sozlesmesel spread icin Bond.spread (ihracta sabitlenen ek getiri) kullanilir;
        bu deger her zaman >= 0 olacak sekilde girilir.
        """
        s = Decimal(str(bond_yield)) - Decimal(str(tlref_yield))
        return s.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def compound_coupon_rate(self) -> Decimal:
        """
        Kuponun yillik bilesik karsiligini dondurur.
        Bono icin: (1 + r*t/365)^(365/t) - 1
        Tahvil icin: (1 + r/k)^k - 1
        """
        if self.coupon_frequency == 1:
            total_days = (self.maturity_date - self.issue_date).days
            if total_days <= 0:
                return self.coupon_rate
            periodic = self.coupon_rate * Decimal(str(total_days)) / Decimal("365")
            compound = (float(Decimal("1") + periodic) ** (365.0 / total_days)) - 1.0
        else:
            periodic = self.coupon_rate / Decimal(str(self.coupon_frequency))
            compound = (float(Decimal("1") + periodic) ** self.coupon_frequency) - 1.0
            
        return Decimal(str(compound)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


    def modified_duration(self, clean_price: Decimal, settlement_date: date) -> Decimal:
        """
        Modifiye Durasyon = Macaulay Durasyon / (1 + y/k)
        y: periyodik verim, k: kupon frekansi
        """
        self._validate_settlement(settlement_date)
        self._validate_clean_price(clean_price)
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
        self._validate_settlement(settlement_date)
        self._validate_clean_price(clean_price)
        d_price = self.dirty_price(clean_price, settlement_date)
        cash_flows = self.generate_cash_flows(settlement_date)
        ytm = self.yield_to_maturity(clean_price, settlement_date)

        if not cash_flows or d_price <= 0:
            return Decimal("0")

        periodic_yield = ytm / Decimal(str(self.coupon_frequency))
        weighted_sum = Decimal("0")

        for cf in cash_flows:
            days_to_cf = Decimal(str((cf.payment_date - settlement_date).days))
            years = days_to_cf / Decimal("365")
            periods = days_to_cf / Decimal(str(self._period_days()))
            discount = (Decimal("1") + periodic_yield) ** periods
            if discount != 0:
                pv = cf.amount / discount
                weighted_sum += years * pv

        duration = weighted_sum / d_price
        return duration.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def full_analysis(self, clean_price: Decimal, settlement_date: date, tlref_rate: Decimal | None = None) -> dict:
        """Tek seferde tum hesaplamalari calistir."""
        self._validate_settlement(settlement_date)
        self._validate_clean_price(clean_price)
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
