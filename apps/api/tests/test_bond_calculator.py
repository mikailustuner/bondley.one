"""
BondCalculator unit tests — golden-value and invariant checks.

Run with:  pytest apps/api/tests/test_bond_calculator.py -v
"""

import pytest
from datetime import date
from decimal import Decimal

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.bond_calculator import BondCalculator


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_bono() -> BondCalculator:
    """Tek ödemeli 1-yıllık bono (%30 kupon, coupon_frequency=1)."""
    return BondCalculator(
        isin="TR000000BONO",
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),  # 365 gün
        coupon_rate=Decimal("0.30"),
        face_value=Decimal("100"),
        coupon_frequency=1,
    )


def _calc_semi() -> BondCalculator:
    """2-yıllık yarı-yıllık kuponlu tahvil (%10 yıllık, k=2)."""
    return BondCalculator(
        isin="TR000000SEMI",
        issue_date=date(2025, 1, 1),
        maturity_date=date(2027, 1, 1),
        coupon_rate=Decimal("0.10"),
        face_value=Decimal("100"),
        coupon_frequency=2,
        next_coupon_date=date(2025, 7, 1),
    )


# ── Bono (tek ödeme) testleri ──────────────────────────────────────────────────

class TestBono:
    def setup_method(self):
        self.c = _calc_bono()

    def test_accrued_at_issue_is_zero(self):
        ai = self.c.accrued_interest(date(2025, 1, 1))
        assert ai == Decimal("0"), f"Beklenen 0, gelen {ai}"

    def test_accrued_at_6months(self):
        # 181 günden sonra birikmis faiz = 100 * 0.30 * 181/365
        ai = self.c.accrued_interest(date(2025, 7, 1))  # 181 gün
        days = (date(2025, 7, 1) - date(2025, 1, 1)).days  # 181
        expected = (Decimal("100") * Decimal("0.30") * Decimal(days) / Decimal("365"))
        assert abs(ai - expected) < Decimal("0.000001")

    def test_dirty_price_equals_clean_plus_accrued(self):
        d = date(2025, 7, 1)
        clean = Decimal("95.000000")
        dp = self.c.dirty_price(clean, d)
        ai = self.c.accrued_interest(d)
        assert abs(dp - (clean + ai)) < Decimal("0.000001")

    def test_ytm_at_par_equals_coupon_rate(self):
        """Par'dan alınan bono için YTM = %30."""
        ytm = self.c.yield_to_maturity(Decimal("100"), date(2025, 1, 1))
        assert abs(ytm - Decimal("0.30")) < Decimal("0.0001"), f"YTM: {ytm}"

    def test_ytm_below_par_higher_than_coupon(self):
        """İndirimli fiyattan alınan bono için YTM > kupon."""
        ytm_discount = self.c.yield_to_maturity(Decimal("90"), date(2025, 1, 1))
        assert ytm_discount > Decimal("0.30")

    def test_ytm_above_par_lower_than_coupon(self):
        """Prim fiyattan alınan bono için YTM < kupon."""
        ytm_premium = self.c.yield_to_maturity(Decimal("105"), date(2025, 1, 1))
        assert ytm_premium < Decimal("0.30")

    def test_settlement_after_maturity_raises(self):
        with pytest.raises(ValueError):
            self.c.accrued_interest(date(2026, 1, 2))

    def test_zero_or_negative_clean_price_raises(self):
        with pytest.raises(ValueError):
            self.c.yield_to_maturity(Decimal("0"), date(2025, 1, 1))
        with pytest.raises(ValueError):
            self.c.yield_to_maturity(Decimal("-1"), date(2025, 1, 1))


# ── Yarı-yıllık tahvil testleri ────────────────────────────────────────────────

class TestSemiAnnual:
    def setup_method(self):
        self.c = _calc_semi()

    def test_coupon_frequency_unchanged(self):
        assert self.c.coupon_frequency == 2

    def test_accrued_at_issue_is_zero(self):
        ai = self.c.accrued_interest(date(2025, 1, 1))
        assert ai == Decimal("0")

    def test_dirty_price_at_issue(self):
        dp = self.c.dirty_price(Decimal("100"), date(2025, 1, 1))
        assert dp == Decimal("100.00000000")

    def test_ytm_roundtrip(self):
        """clean_price_from_yield(ytm(price)) ≈ price."""
        settlement = date(2025, 4, 1)
        clean = Decimal("98.500000")
        ytm = self.c.yield_to_maturity(clean, settlement)
        recovered = self.c.clean_price_from_yield(ytm, settlement)
        assert abs(recovered - clean) < Decimal("0.001"), f"Roundtrip hatası: {recovered} vs {clean}"

    def test_spread(self):
        ytm = Decimal("0.12")
        tlref = Decimal("0.10")
        s = self.c.spread(ytm, tlref)
        assert abs(s - Decimal("0.02")) < Decimal("0.000001")

    def test_spread_negative(self):
        """YTM < TLREF → negatif spread."""
        s = self.c.spread(Decimal("0.08"), Decimal("0.10"))
        assert s < Decimal("0")

    def test_modified_duration_positive(self):
        md = self.c.modified_duration(Decimal("100"), date(2025, 1, 1))
        assert md > Decimal("0")

    def test_macaulay_duration_less_than_maturity(self):
        """Macaulay süresi her zaman vadeye kalan yıldan kısa."""
        mac = self.c.macaulay_duration(Decimal("100"), date(2025, 1, 1))
        years_to_maturity = Decimal("2")  # 2 yıl
        assert mac < years_to_maturity, f"Mac duration {mac} >= {years_to_maturity}"

    def test_modified_less_than_macaulay(self):
        settlement = date(2025, 1, 1)
        clean = Decimal("100")
        mac = self.c.macaulay_duration(clean, settlement)
        mod = self.c.modified_duration(clean, settlement)
        assert mod < mac

    def test_full_analysis_keys(self):
        result = self.c.full_analysis(Decimal("100"), date(2025, 1, 1), tlref_rate=Decimal("0.10"))
        for key in ("yield_to_maturity", "dirty_price", "accrued_interest", "spread", "modified_duration", "macaulay_duration"):
            assert key in result, f"Eksik anahtar: {key}"

    def test_cash_flows_last_includes_principal(self):
        flows = self.c.generate_cash_flows(date(2025, 1, 1))
        assert flows, "Nakit akışı listesi boş"
        last_amount = flows[-1].amount
        assert last_amount > Decimal("100"), f"Son ödeme anapara içermeli: {last_amount}"

    def test_no_cash_flows_at_maturity(self):
        flows = self.c.generate_cash_flows(date(2027, 1, 1))
        assert flows == [], "Vadede nakit akışı olmamalı"


# ── Coupon frequency düzeltme testi ────────────────────────────────────────────

def test_short_bond_frequency_corrected_to_1():
    """91 günlük bono için coupon_frequency=2 verilse bile 1'e düşürülür."""
    c = BondCalculator(
        isin="TR000000SHORT",
        issue_date=date(2025, 1, 1),
        maturity_date=date(2025, 4, 2),  # 91 gün
        coupon_rate=Decimal("0.10"),
        face_value=Decimal("100"),
        coupon_frequency=2,
    )
    assert c.coupon_frequency == 1


def test_full_analysis_no_tlref():
    c = _calc_bono()
    result = c.full_analysis(Decimal("100"), date(2025, 1, 1))
    assert result["spread"] is None
