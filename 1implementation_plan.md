# Integration of KAP Overrides into Calculations

This plan outlines the steps to prioritize KAP (Public Disclosure Platform) data over BIST (Stock Exchange) data in automated calculations when KAP provides more recent information.

## User Review Required

> [!IMPORTANT]
> By enabling KAP overrides, the system will automatically use values from KAP (e.g., a newly announced interest rate or redemption date) even if the official BIST list hasn't been updated yet.
>
> While this makes the system more "up-to-date," it also makes it dependent on the accuracy of KAP scrapers.

## Proposed Changes

### Core Logic

#### [MODIFY] [kap_data_resolver.py](file:///home/f0x017/Desktop/FinCalc/apps/api/app/services/kap_data_resolver.py)
- Refactor `resolve_data_conflicts` to provide a clear set of override values.
- Ensure date comparisons between `Bond.updated_at` (BIST) and `KapDisclosure.publish_date` are robust.

#### [MODIFY] [bond_metrics_service.py](file:///home/f0x017/Desktop/FinCalc/apps/api/app/services/bond_metrics_service.py)
- Update `compute_metrics` to fetch and apply KAP overrides before performing any calculations (annual reference rate, accrued interest, etc.).

#### [MODIFY] [market_data_service.py](file:///home/f0x017/Desktop/FinCalc/apps/api/app/services/market_data_service.py)
- Update `run_calculations_for_bond` to apply KAP overrides to the `BondCalculator` inputs (Maturity Date, Spread, Coupon Frequency).

### Data Storage (Optional / Post-MVP)
- We could add a `metadata` JSON field to the `Calculation` model to store which source (BIST or KAP) was used for each field, but to stay within the "130-hour" efficiency, we will focus on the logic first.

## Open Questions

> [!NOTE]
> Should we log a warning or a specific system notification whenever a KAP override is used during a daily calculation? This would help you track how often "official" data is being bypassed.

## Verification Plan

### Automated Verification
- I will verify the logic by running a test script that mocks a newer KAP disclosure for a tactical ISIN and checks if `MarketDataService` uses the KAP value.

### Manual Verification
- You can check a bond's detail page in the dashboard; it should now show calculation results based on the "Resolved" data instead of just the BIST data.
