from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


Severity = Literal["INFO", "WARNING", "ERROR", "FATAL"]
ParseStatus = Literal["EXACT", "PARTIAL", "AMBIGUOUS", "CONFLICTING", "REJECTED"]


@dataclass(frozen=True)
class Diagnostic:
    code: str
    message: str
    severity: Severity = "WARNING"
    sheet_name: str | None = None
    row_number: int | None = None
    column_number: int | None = None
    raw_fragment: str | None = None
    context: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RawCell:
    column_number: int
    cell_type: str
    raw_value: Any
    display_value: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RawRow:
    sheet_name: str
    row_number: int
    row_class: Literal["INSTRUMENT", "SOURCE_NOTE", "FOOTER", "ARTIFACT", "UNKNOWN"]
    cells: list[RawCell]
    row_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "sheet_name": self.sheet_name,
            "row_number": self.row_number,
            "row_class": self.row_class,
            "cells": [cell.to_dict() for cell in self.cells],
            "row_hash": self.row_hash,
        }
