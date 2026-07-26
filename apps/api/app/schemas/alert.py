from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AlertCreate(BaseModel):
    type: Literal[
        "ytm_above",
        "ytm_below",
        "tlref_annual_above",
        "tlref_annual_below",
        "days_to_maturity",
    ]
    parameters: dict = Field(default_factory=dict)


class AlertUpdate(BaseModel):
    type: Literal[
        "ytm_above",
        "ytm_below",
        "tlref_annual_above",
        "tlref_annual_below",
        "days_to_maturity",
    ] | None = None
    parameters: dict | None = None
    is_active: bool | None = None


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    parameters: dict
    is_active: bool
    last_triggered_at: datetime | None = None
    triggered_value_snapshot: dict | None = None
    created_at: datetime
    updated_at: datetime


class AlertTriggeredResponse(AlertResponse):
    """Alert with last_triggered_at set (recently triggered)."""
    pass
