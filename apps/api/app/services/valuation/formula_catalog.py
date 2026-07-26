from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FormulaDefinition:
    code: str
    description_tr: str
    supported_rate_types: frozenset[str]
    price_basis: str
    compounding: str


FORMULA_CATALOG = {
    definition.code: definition
    for definition in (
        FormulaDefinition(
            "BAP_DISCOUNTED_CASH_FLOW",
            "Genel iskonto edilmiş nakit akışı",
            frozenset({"FIXED", "TLREF", "TLREFK", "CPI"}),
            "DIRTY",
            "PERIODIC",
        ),
        FormulaDefinition(
            "BAP_FIXED_RATE",
            "Sabit oranlı borçlanma aracı",
            frozenset({"FIXED"}),
            "DIRTY",
            "PERIODIC",
        ),
        FormulaDefinition(
            "BAP_FLOATING_RATE",
            "Değişken oranlı borçlanma aracı",
            frozenset({"TLREF", "TLREFK"}),
            "DIRTY",
            "PERIODIC",
        ),
        FormulaDefinition(
            "BAP_TLREF",
            "TLREF oranına bağlı borçlanma aracı",
            frozenset({"TLREF"}),
            "DIRTY",
            "PERIODIC",
        ),
        FormulaDefinition(
            "BAP_TLREFK",
            "TLREFK oranına bağlı katılım kıymeti",
            frozenset({"TLREFK"}),
            "DIRTY",
            "PERIODIC",
        ),
        FormulaDefinition(
            "BAP_CPI_LINKED",
            "TÜFE endeksli anapara ve reel kupon",
            frozenset({"CPI"}),
            "DIRTY",
            "PERIODIC",
        ),
    )
}
