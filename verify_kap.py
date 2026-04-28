from decimal import Decimal
import sys

db_rate = Decimal("0.115879") # KAP Periodic rate
eff_period = 99
freq = 4
days_passed = 98

# USER'S REVERTED LOGIC:
annual_simple_wrong = db_rate * Decimal("365") / Decimal(str(eff_period))
calc_coupon_rate_wrong = db_rate * Decimal(str(freq))

accrued_wrong = Decimal("100") * calc_coupon_rate_wrong * Decimal(str(days_passed)) / Decimal("365")

# MY FIXED LOGIC:
annual_simple_right = db_rate * Decimal("365") / Decimal(str(eff_period))
calc_coupon_rate_right = annual_simple_right

accrued_right = Decimal("100") * calc_coupon_rate_right * Decimal(str(days_passed)) / Decimal("365")

print("=== USER'S REVERTED LOGIC ===")
print(f"Annual Simple Rate: {annual_simple_wrong * 100}% (Expected: 42.7231%)")
print(f"Passed to BondCalculator: {calc_coupon_rate_wrong * 100}%")
print(f"Accrued Interest (98 days): {accrued_wrong} (Expected: ~11.47)")

print("\n=== MY FIXED LOGIC ===")
print(f"Annual Simple Rate: {annual_simple_right * 100}% (Expected: 42.7231%)")
print(f"Passed to BondCalculator: {calc_coupon_rate_right * 100}%")
print(f"Accrued Interest (98 days): {accrued_right} (Expected: ~11.47)")
