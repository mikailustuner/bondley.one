from decimal import Decimal
db_rate = Decimal("0.115879") # KAP dönemsel faiz
eff_period = 99
freq = 4
annual_coupon = db_rate * Decimal("365") / Decimal(str(eff_period))

# In BondCalculator:
coupon_rate = annual_coupon
days_in_period = 99
face_value = Decimal("100")

# Payment calc
payment = face_value * coupon_rate * Decimal(str(days_in_period)) / Decimal("365")
print(f"Annual Simple Rate: {annual_coupon * 100}%")
print(f"Coupon Payment (99 days): {payment}")

# If we used db_rate * 4
old_coupon_rate = db_rate * Decimal(str(freq))
old_payment = face_value * old_coupon_rate * Decimal(str(days_in_period)) / Decimal("365")
print(f"OLD Coupon Payment (99 days): {old_payment}")

