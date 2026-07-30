from __future__ import annotations

from datetime import date
from typing import Literal


InstrumentStatus = Literal["active", "matured", "all"]


def is_instrument_active(
    maturity_date: date | None,
    *,
    current_date: date,
) -> bool:
    return maturity_date is None or maturity_date >= current_date


def matches_instrument_status(
    maturity_date: date | None,
    *,
    current_date: date,
    status: InstrumentStatus,
) -> bool:
    if status == "all":
        return True
    is_active = is_instrument_active(
        maturity_date,
        current_date=current_date,
    )
    return is_active if status == "active" else not is_active
