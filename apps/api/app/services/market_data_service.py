"""
Market data service - orchestrates bond calculations and data persistence.
"""

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.calculation import Calculation
from app.models.tlref_rate import TLREFRate
from app.services.bond_calculator import BondCalculator

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_calculations_for_bond(
        self, bond: Bond, calc_date: date, clean_price: Decimal
    ) -> dict:
        """Tek bir tahvil icin tum hesaplamalari calistir ve DB'ye kaydet."""
        tlref_rate = await self._get_tlref_rate(calc_date)

        calculator = BondCalculator(
            isin=bond.isin_code,
            issue_date=bond.issue_date,
            maturity_date=bond.maturity_date,
            coupon_rate=bond.coupon_rate,
            face_value=bond.face_value,
            coupon_frequency=bond.coupon_frequency,
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
            },
        )
        await self.db.execute(stmt)
        await self.db.commit()

        return result

    async def run_daily_calculations(self, calc_date: date | None = None) -> list[dict]:
        """Tum aktif tahviller icin gunluk hesaplamalari calistir."""
        if calc_date is None:
            calc_date = date.today()

        bonds_result = await self.db.execute(
            select(Bond).where(Bond.is_active == True, Bond.maturity_date > calc_date)
        )
        bonds = bonds_result.scalars().all()

        results = []
        for bond in bonds:
            md_result = await self.db.execute(
                select(MarketData)
                .where(MarketData.bond_id == bond.id, MarketData.trade_date == calc_date)
            )
            market_data = md_result.scalar_one_or_none()

            if not market_data:
                md_result = await self.db.execute(
                    select(MarketData)
                    .where(MarketData.bond_id == bond.id)
                    .order_by(MarketData.trade_date.desc())
                    .limit(1)
                )
                market_data = md_result.scalar_one_or_none()

            if not market_data:
                logger.warning(f"No market data for {bond.isin_code}, skipping")
                continue

            try:
                result = await self.run_calculations_for_bond(
                    bond, calc_date, market_data.clean_price
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Calculation failed for {bond.isin_code}: {e}")
                continue

        logger.info(f"Completed calculations for {len(results)}/{len(bonds)} bonds")
        return results

    async def _get_tlref_rate(self, target_date: date) -> Decimal | None:
        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.rate_date <= target_date)
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        rate = result.scalar_one_or_none()
        if rate is None:
            return None
        if rate.daily_rate is not None:
            return rate.daily_rate * 365
        return rate.index_value
