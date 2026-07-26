from decimal import Decimal

from app.core.rates import decimal_rate_to_percent


def test_persisted_decimal_rate_is_compared_as_ui_percent() -> None:
    assert decimal_rate_to_percent(Decimal("0.425")) == 42.5
