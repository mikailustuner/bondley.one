from datetime import date
from decimal import Decimal

def parse_coupon_frequency_v3(next_coupon: date, maturity: date, isin: str, first_issue: date):
    total_days = (maturity - first_issue).days
    if next_coupon and maturity and next_coupon >= maturity:
        return -1, 1
    if isin.startswith("TRD") and total_days < 400:
        return -1, 1
    return 91, 4

def test_sukuk():
    maturity = date(2026, 4, 30)
    issue = date(2026, 1, 22) # 98 days before 30.04
    next_coupon = date(2026, 4, 30)
    isin = "TRDZKVK42632"
    settlement = date(2026, 4, 26)
    db_periodic_rate = Decimal("9.5315") / 100
    
    total_days = (maturity - issue).days
    print(f"Total days: {total_days}")
    
    p, f = parse_coupon_frequency_v3(next_coupon, maturity, isin, issue)
    print(f"Resolved: Freq={f}, Period={p}")
    
    # Calculator rate
    annual_simple = db_periodic_rate * (Decimal("365") / Decimal(str(total_days)))
    print(f"Annual Simple (Rate for Calc): {annual_simple * 100:.4f}%")
    
    # Accrued
    days_passed = (settlement - issue).days
    print(f"Days passed: {days_passed}")
    accrued = annual_simple * (Decimal(str(days_passed)) / Decimal("365"))
    print(f"Accrued: {accrued * 100:.4f} (Expected: 9.4342)")
    
    # The "Wrong" logic (Multiplied by 4)
    wrong_annual = db_periodic_rate * 4
    wrong_accrued = wrong_annual * (Decimal(str(days_passed)) / Decimal("365"))
    print(f"Wrong Accrued (Freq=4): {wrong_accrued * 100:.4f} (Expected: 10.1321)")

if __name__ == "__main__":
    test_sukuk()
