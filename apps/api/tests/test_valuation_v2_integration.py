import asyncio
import os
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v2.verified import create_valuation
from app.models.valuation import (
    PriceObservation,
    ShadowValuationComparison,
    ValuationRequestRecord,
    ValuationResultRecord,
)
from app.schemas.valuation_v2 import ValuationCreate


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_BIST_DB_INTEGRATION") != "1",
    reason="Set RUN_BIST_DB_INTEGRATION=1 against an isolated migrated PostgreSQL database",
)


def test_v2_valuation_persists_input_result_and_provenance():
    asyncio.run(_run_check())


async def _run_check():
    engine = create_async_engine(os.environ["BIST_INTEGRATION_DATABASE_URL"])
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with factory() as db:
            price_count = await db.scalar(select(func.count(PriceObservation.id))) or 0
            request_count = await db.scalar(select(func.count(ValuationRequestRecord.id))) or 0
            result_count = await db.scalar(select(func.count(ValuationResultRecord.id))) or 0
            shadow_count = await db.scalar(select(func.count(ShadowValuationComparison.id))) or 0
            response = await create_valuation(
                ValuationCreate(
                    isin="TRD030227F16",
                    settlement_date="2026-07-24",
                    quote_type="CLEAN_PRICE",
                    quote_value="100.25",
                ),
                db=db,
                user=SimpleNamespace(id=1),
            )
            assert response.success, response.failure
            assert response.result is not None
            assert response.result["quote_value"] == "100.25"
            assert response.result["provenance"]["instrument_source_file_id"] is not None
            assert response.result["provenance"]["instrument_source_row"] is not None
            assert response.result["provenance"]["parser_version"]
            assert response.result["provenance"]["benchmark"]["name"] == "TLREFK"

            assert await db.scalar(select(func.count(PriceObservation.id))) == price_count + 1
            assert await db.scalar(select(func.count(ValuationRequestRecord.id))) == request_count + 1
            assert await db.scalar(select(func.count(ValuationResultRecord.id))) == result_count + 1
            assert await db.scalar(select(func.count(ShadowValuationComparison.id))) == shadow_count + 1
    finally:
        await engine.dispose()
