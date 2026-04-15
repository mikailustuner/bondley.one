"""
Market data service - orchestrates bond calculations and data persistence.
"""

import logging
from datetime import date
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
        self, bond: Bond, calc_date: date, clean_price: Decimal
    ) -> dict:
        """Tek bir tahvil icin tum hesaplamalari calistir ve DB'ye kaydet."""
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
            # Belirli tarih icin market data kontrolu - yoksa atla (varsayilan deger kullanma)
            md_result = await self.db.execute(
                select(MarketData)
                .where(MarketData.bond_id == bond.id, MarketData.trade_date == calc_date)
            )
            market_data = md_result.scalar_one_or_none()

            if not market_data:
                # Belirli tarih icin veri yok - atla (varsayilan deger veya en son veri kullanma)
                logger.warning(f"No market data for {bond.isin_code} on date {calc_date}, skipping")
                continue

            # clean_price kesinlikle pozitif olmalı (> 0) - BondCalculator gereksinimi
            if market_data.clean_price <= 0:
                logger.warning(
                    f"Skipping {bond.isin_code}: clean_price must be strictly positive, got {market_data.clean_price}"
                )
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
