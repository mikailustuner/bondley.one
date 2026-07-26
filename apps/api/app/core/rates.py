def decimal_rate_to_percent(value: object) -> float:
    """Convert a persisted decimal rate (0.42) to UI percent units (42)."""
    return float(value) * 100
