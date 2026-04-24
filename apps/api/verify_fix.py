import asyncio
from datetime import date
from decimal import Decimal
from app.models.bond import Bond
from app.services.bond_metrics_service import BondMetricsService

async def verify():
    # Mock bond data for TRFPNST42621
    bond = Bond(
        isin_code="TRFPNST42621",
        first_issue_date=date(2025, 11, 24),
        maturity_date=date(2026, 4, 24),
        next_coupon_rate=Decimal("18.4096"),
        coupon_frequency="Tek Kupon",
        spread=Decimal("0")
    )
    
    # Mock DB session (only for get_clean_price fallback which we'll override)
    class MockDB:
        async def execute(self, *args, **kwargs):
            class MockResult:
                def one_or_none(self): return None
                def scalar_one_or_none(self): return None
            return MockResult()

    service = BondMetricsService(MockDB())
    
    # Calculate for 23.04.2026 (day before maturity)
    settlement_date = date(2026, 4, 23)
    clean_price = Decimal("100.00")
    
    metrics = await service.compute_metrics(bond, settlement_date, clean_price_override=clean_price)
    
    print(f"ISIN: {bond.isin_code}")
    print(f"Annual Simple Coupon: {metrics['annual_coupon_rate']}%")
    print(f"Annual Compound Coupon: {metrics['annual_compound_coupon_rate']}%")
    print(f"Periodic Coupon: {metrics['periodic_coupon_rate']}%")
    print(f"Accrued Interest: {metrics['accrued_interest']}")
    print(f"Period Days: {metrics['period_days']}")

    # Expected values from KAP:
    # Simple: 44.50
    # Compound: 50.45
    # Periodic: 18.4096
    
    assert abs(metrics['annual_coupon_rate'] - 44.50) < 0.01
    assert abs(metrics['annual_compound_coupon_rate'] - 50.45) < 0.01
    print("\nVerification SUCCESSFUL!")

if __name__ == "__main__":
    asyncio.run(verify())
