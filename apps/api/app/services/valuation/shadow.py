from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


DEFAULT_TOLERANCES = {
    "dirty_price": Decimal("0.0001"),
    "accrued_amount": Decimal("0.0001"),
    "annual_yield": Decimal("0.00001"),
    "modified_duration": Decimal("0.0001"),
    "macaulay_duration": Decimal("0.0001"),
}


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def compare_legacy_and_verified(
    legacy: dict[str, Any] | None,
    verified: dict[str, Any],
) -> tuple[dict[str, Any], str, str]:
    if legacy is None:
        return (
            {"legacy_result": "MISSING"},
            "NO_LEGACY_BASELINE",
            "Aynı tarih ve enstrüman için eski sonuç bulunmadı.",
        )

    mapping = {
        "dirty_price": "dirty_price",
        "accrued_interest": "accrued_amount",
        "yield_to_maturity": "annual_yield",
        "modified_duration": "modified_duration",
        "macaulay_duration": "macaulay_duration",
    }
    differences: dict[str, Any] = {}
    critical = False
    for legacy_key, verified_key in mapping.items():
        old = _decimal(legacy.get(legacy_key))
        new = _decimal(verified.get(verified_key))
        if old is None or new is None:
            differences[verified_key] = {
                "legacy": str(old) if old is not None else None,
                "verified": str(new) if new is not None else None,
                "status": "MISSING_SIDE",
            }
            critical = True
            continue
        absolute = abs(old - new)
        tolerance = DEFAULT_TOLERANCES[verified_key]
        passed = absolute <= tolerance
        differences[verified_key] = {
            "legacy": str(old),
            "verified": str(new),
            "absolute_difference": str(absolute),
            "tolerance": str(tolerance),
            "within_tolerance": passed,
        }
        critical = critical or not passed

    if legacy.get("is_theoretical"):
        return (
            differences,
            "EXPLAINED_LEGACY_THEORETICAL",
            (
                "Eski sonuç tbliste/son ihraç fiyatından teorik üretilmişti; "
                "v2 yalnız açık kullanıcı fiyatını kullanır."
            ),
        )
    if critical:
        return (
            differences,
            "CRITICAL_DIFFERENCE",
            "Tolerans dışı farklar manuel inceleme gerektiriyor.",
        )
    return differences, "MATCH", "Eski ve doğrulanmış sonuçlar tanımlı toleranslar içinde."
