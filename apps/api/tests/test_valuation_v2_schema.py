from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.valuation_v2 import ValuationCreate


@pytest.mark.parametrize("quote_type", ["CLEAN_PRICE", "DIRTY_PRICE"])
def test_system_nominal_100_accepts_bist_price_basis_at_100(quote_type):
    payload = ValuationCreate(
        isin="TRD030227F16",
        settlement_date="2026-07-24",
        quote_type=quote_type,
        quote_value="100",
        quote_source="SYSTEM_NOMINAL_100",
    )

    assert payload.quote_value == Decimal("100")
    assert payload.quote_source == "SYSTEM_NOMINAL_100"


@pytest.mark.parametrize(
    ("quote_type", "quote_value"),
    [
        ("ANNUAL_YIELD", "100"),
        ("CLEAN_PRICE", "99.99"),
        ("DIRTY_PRICE", "99.99"),
    ],
)
def test_system_nominal_100_rejects_other_quotes(quote_type, quote_value):
    with pytest.raises(ValidationError):
        ValuationCreate(
            isin="TRD030227F16",
            settlement_date="2026-07-24",
            quote_type=quote_type,
            quote_value=quote_value,
            quote_source="SYSTEM_NOMINAL_100",
        )
