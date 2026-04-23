"""
Market data service - orchestrates bond calculations and data persistence.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FACE_VALUE
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.calculation import Calculation
from app.services.bond_calculator import BondCalculator
from app.services.bond_metrics_service import bond_to_calculator_inputs, get_tlref_annual_yield_for_date

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_calculations_for_bond(
        self, bond: Bond, calc_date: date, clean_price: Decimal, tlref_rate: Decimal | None = None, is_theoretical: bool = False
    ) -> dict:
        """Tek bir tahvil icin tum hesaplamalari calistir ve DB'ye kaydet."""
        # Use provided tlref_rate if available, otherwise fetch
        if tlref_rate is None:
            tlref_rate, _ = await get_tlref_annual_yield_for_date(self.db, calc_date)
        inputs = bond_to_calculator_inputs(bond)
        if not inputs:
            raise ValueError(f"Bond {bond.isin_code}: first_issue_date veya maturity_date eksik")

        issue_date, maturity_date, coupon_rate, coupon_frequency_int = inputs
        calculator = BondCalculator(
            isin=bond.isin_code,
            issue_date=issue_date,
            maturity_date=maturity_date,
            coupon_rate=coupon_rate,
            face_value=FACE_VALUE,
            coupon_frequency=coupon_frequency_int,
            next_coupon_date=bond.next_coupon_date,
        )

        result = calculator.full_analysis(clean_price, calc_date, tlref_rate)

        stmt = pg_insert(Calculation).values(
            bond_id=bond.id,
            calc_date=calc_date,
            dirty_price=result["dirty_price"],
            accrued_interest=result["accrued_interest"],
            yield_to_maturity=result["yield_to_maturity"],
            spread=result["spread"],
            modified_duration=result["modified_duration"],
            macaulay_duration=result["macaulay_duration"],
            is_theoretical=is_theoretical,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["bond_id", "calc_date"],
            set_={
                "dirty_price": stmt.excluded.dirty_price,
                "accrued_interest": stmt.excluded.accrued_interest,
                "yield_to_maturity": stmt.excluded.yield_to_maturity,
                "spread": stmt.excluded.spread,
                "modified_duration": stmt.excluded.modified_duration,
                "macaulay_duration": stmt.excluded.macaulay_duration,
                "is_theoretical": stmt.excluded.is_theoretical,
            },
        )
        await self.db.execute(stmt)

        return result

    async def run_daily_calculations(self, calc_date: date | None = None, stale_limit: int = 5) -> list[dict]:
        """Tum aktif tahviller icin gunluk hesaplamalari calistir."""
        if calc_date is None:
            calc_date = date.today()

        bonds_result = await self.db.execute(
            select(Bond).where(Bond.is_active == True, Bond.maturity_date > calc_date)
        )
        bonds = bonds_result.scalars().all()

        # Get TLREF rate once for fallback calculations
        tlref_rate, _ = await get_tlref_annual_yield_for_date(self.db, calc_date)

        results = []
        for bond in bonds:
            md_result = await self.db.execute(
                select(MarketData)
                .where(MarketData.bond_id == bond.id, MarketData.trade_date == calc_date)
            )
            market_data = md_result.scalar_one_or_none()

            clean_price = None
            is_theoretical = False

            if market_data and market_data.clean_price > 0:
                clean_price = market_data.clean_price
            else:
                # Fallback: Yield-to-Price calculation
                limit_date = calc_date - timedelta(days=stale_limit)
                fallback_result = await self.db.execute(
                    select(Calculation)
                    .where(
                        Calculation.bond_id == bond.id,
                        Calculation.calc_date < calc_date,
                        Calculation.calc_date >= limit_date,
                        Calculation.spread.isnot(None),
                    )
                    .order_by(Calculation.calc_date.desc())
                    .limit(1)
                )
                last_calc = fallback_result.scalar_one_or_none()

                theoretical_spread = None
                if last_calc and last_calc.spread is not None:
                    theoretical_spread = last_calc.spread
                elif bond.spread is not None:
                    s = Decimal(str(bond.spread))
                    theoretical_spread = s / Decimal("100") if abs(s) > 1 else s

                if theoretical_spread is not None and tlref_rate:
                    theoretical_ytm = tlref_rate + theoretical_spread
                    inputs = bond_to_calculator_inputs(bond)
                    if inputs:
                        issue_date, maturity_date, coupon_rate, coupon_frequency_int = inputs
                        calculator = BondCalculator(
                            isin=bond.isin_code,
                            issue_date=issue_date,
                            maturity_date=maturity_date,
                            coupon_rate=coupon_rate,
                            face_value=FACE_VALUE,
                            coupon_frequency=coupon_frequency_int,
                            next_coupon_date=bond.next_coupon_date,
                        )
                        try:
                            calc_price = calculator.clean_price_from_yield(theoretical_ytm, calc_date)
                            if calc_price > 0:
                                clean_price = calc_price
                                is_theoretical = True
                                logger.info(f"Using theoretical price {clean_price} for {bond.isin_code} (spread: {last_calc.spread})")
                        except Exception as e:
                            logger.warning(f"Theoretical price calc failed for {bond.isin_code}: {e}")

            if clean_price is None or clean_price <= 0:
                logger.warning(f"No valid market data or theoretical price for {bond.isin_code} on date {calc_date}, skipping")
                continue

            try:
                result = await self.run_calculations_for_bond(
                    bond, calc_date, clean_price, tlref_rate, is_theoretical
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Calculation failed for {bond.isin_code}: {e}")
                continue

        logger.info(f"Completed calculations for {len(results)}/{len(bonds)} bonds")
        return results
