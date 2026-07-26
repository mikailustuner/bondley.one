from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import xlrd

from app.services.bist_ingestion.remarks_parser import RemarksParser
from app.services.bist_ingestion.types import Diagnostic, RawCell, RawRow


ISIN_PATTERN = re.compile(r"^[A-Z0-9]{12}$")

FIELD_BY_COLUMN = {
    0: "source_sequence",
    1: "isin",
    2: "related_security_raw",
    3: "issuer_name",
    4: "issuance_type_raw",
    5: "yield_type_raw",
    6: "security_type_raw",
    7: "coupon_frequency_per_year",
    8: "currency_or_unit",
    9: "group_code",
    10: "first_issue_date",
    11: "maturity_date",
    12: "source_days_to_maturity",
    13: "total_issue_amount_thousands",
    14: "last_issue_date",
    15: "last_issue_price",
    16: "last_issue_yield_annual_simple_pct",
    17: "first_issue_yield_annual_simple_pct",
    18: "next_coupon_date",
    19: "next_coupon_rate_pct",
    20: "spread_raw",
    21: "first_issue_price",
    22: "quotation_method",
    23: "accrual_formula_code_raw",
    24: "clean_price_input_mode",
    25: "dirty_price_formula_code_raw",
    26: "settlement_price_mode",
    27: "yield_formula_code_raw",
    28: "compound_yield_formula_code_raw",
    29: "day_count_convention",
    30: "remarks_raw",
    31: "intermediary_code",
    32: "bist_security_type_code",
}

DATE_COLUMNS = {10, 11, 14, 18}
INTEGER_COLUMNS = {0, 7, 9, 12}
DECIMAL_COLUMNS = {13, 15, 16, 17, 19, 21}


@dataclass
class ParsedInstrument:
    row_number: int
    isin: str
    fields: dict[str, Any]
    raw_row: RawRow
    term_rule: dict[str, Any]
    parse_status: str
    valuation_eligible: bool


@dataclass(frozen=True)
class GroupCodeReference:
    code: int
    description_tr: str
    description_en: str
    row_number: int


@dataclass(frozen=True)
class InstrumentClassificationReference:
    code: str
    description_tr: str
    description_en: str
    row_number: int


@dataclass(frozen=True)
class InstrumentConflictData:
    isin: str
    row_numbers: list[int]
    differences: dict[str, list[Any]]
    conflict_type: str = "CONFLICTING_DUPLICATE"


@dataclass
class TblisteParseResult:
    instruments: list[ParsedInstrument] = field(default_factory=list)
    raw_rows: list[RawRow] = field(default_factory=list)
    source_notes: list[dict[str, Any]] = field(default_factory=list)
    group_codes: list[GroupCodeReference] = field(default_factory=list)
    classifications: list[InstrumentClassificationReference] = field(default_factory=list)
    conflicts: list[InstrumentConflictData] = field(default_factory=list)
    diagnostics: list[Diagnostic] = field(default_factory=list)
    workbook_metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def unique_isins(self) -> set[str]:
        return {item.isin for item in self.instruments}

    @property
    def quality_summary(self) -> dict[str, Any]:
        return {
            "instrument_rows": len(self.instruments),
            "unique_isins": len(self.unique_isins),
            "source_notes": len(self.source_notes),
            "group_codes": len(self.group_codes),
            "classifications": len(self.classifications),
            "conflicts": len(self.conflicts),
            "errors": sum(item.severity in {"ERROR", "FATAL"} for item in self.diagnostics),
            "warnings": sum(item.severity == "WARNING" for item in self.diagnostics),
        }


def is_valid_isin(value: str) -> bool:
    """Validate format and ISO 6166/Luhn check digit."""
    isin = value.strip().upper()
    if not ISIN_PATTERN.fullmatch(isin):
        return False
    digits = "".join(str(ord(char) - 55) if char.isalpha() else char for char in isin)
    total = 0
    double = False
    for char in reversed(digits):
        digit = int(char)
        if double:
            digit *= 2
            digit = digit // 10 + digit % 10
        total += digit
        double = not double
    return total % 10 == 0


class TblisteParser:
    VERSION = "tbliste-v2-1"
    REQUIRED_COLUMNS = 33

    def __init__(self, remarks_parser: RemarksParser | None = None):
        self.remarks_parser = remarks_parser or RemarksParser()

    def parse(self, content: bytes, *, filename: str | None = None) -> TblisteParseResult:
        workbook = xlrd.open_workbook(file_contents=content)
        result = TblisteParseResult(
            workbook_metadata={
                "filename": filename,
                "sheet_names": workbook.sheet_names(),
                "datemode": workbook.datemode,
                "parser_version": self.VERSION,
            }
        )
        main_sheet = self._find_main_sheet(workbook)
        if main_sheet.ncols < self.REQUIRED_COLUMNS:
            raise ValueError(
                f"tbliste schema drift: expected at least {self.REQUIRED_COLUMNS} columns, "
                f"received {main_sheet.ncols}"
            )
        self._validate_headers(main_sheet, result)
        self._parse_main_sheet(workbook, main_sheet, result)
        self._parse_reference_sheet(workbook, result)
        self._detect_conflicts(result)
        self._apply_conflict_eligibility(result)
        result.workbook_metadata["quality_summary"] = result.quality_summary
        return result

    @staticmethod
    def _find_main_sheet(workbook: xlrd.book.Book) -> xlrd.sheet.Sheet:
        for sheet in workbook.sheets():
            if sheet.ncols >= 33 and "borçlanma" in sheet.name.casefold():
                return sheet
        for sheet in workbook.sheets():
            if sheet.ncols >= 33:
                return sheet
        raise ValueError("tbliste main sheet with 33 columns was not found")

    def _validate_headers(self, sheet: xlrd.sheet.Sheet, result: TblisteParseResult) -> None:
        checks = {
            1: "isin",
            3: "issuer",
            11: "maturity",
            20: "spread",
            30: "remarks",
        }
        headers = [self._text(sheet.cell_value(0, index)).casefold() for index in range(sheet.ncols)]
        result.workbook_metadata["headers"] = headers
        for column, expected in checks.items():
            if expected not in headers[column]:
                result.diagnostics.append(
                    Diagnostic(
                        code="HEADER_MISMATCH",
                        severity="ERROR",
                        message=f"Expected '{expected}' in column {column}, got '{headers[column]}'.",
                        sheet_name=sheet.name,
                        row_number=1,
                        column_number=column + 1,
                    )
                )

    def _parse_main_sheet(
        self,
        workbook: xlrd.book.Book,
        sheet: xlrd.sheet.Sheet,
        result: TblisteParseResult,
    ) -> None:
        for row_index in range(1, sheet.nrows):
            raw_row = self._raw_row(workbook, sheet, row_index)
            isin_candidate = self._text(sheet.cell_value(row_index, 1)).upper()
            populated = [cell for cell in raw_row.cells if cell.display_value]
            if not populated:
                continue

            if ISIN_PATTERN.fullmatch(isin_candidate):
                raw_row.row_class = "INSTRUMENT"
                result.raw_rows.append(raw_row)
                if not is_valid_isin(isin_candidate):
                    result.diagnostics.append(
                        Diagnostic(
                            code="INVALID_ISIN_CHECK_DIGIT",
                            severity="ERROR",
                            message="ISIN biçimi doğru ancak kontrol hanesi geçersiz.",
                            sheet_name=sheet.name,
                            row_number=row_index + 1,
                            column_number=2,
                            raw_fragment=isin_candidate,
                        )
                    )
                parsed = self._instrument(workbook, sheet, row_index, raw_row, result)
                result.instruments.append(parsed)
                continue

            if self._looks_like_source_note(raw_row):
                raw_row.row_class = "SOURCE_NOTE"
                result.raw_rows.append(raw_row)
                result.source_notes.append(
                    {
                        "sheet_name": sheet.name,
                        "row_number": row_index + 1,
                        "text": " | ".join(cell.display_value for cell in populated),
                    }
                )
                continue

            raw_row.row_class = "ARTIFACT" if row_index > 3000 else "UNKNOWN"
            result.raw_rows.append(raw_row)
            result.diagnostics.append(
                Diagnostic(
                    code="NON_INSTRUMENT_ROW",
                    severity="INFO",
                    message=f"Non-instrument row classified as {raw_row.row_class}.",
                    sheet_name=sheet.name,
                    row_number=row_index + 1,
                )
            )

    def _instrument(
        self,
        workbook: xlrd.book.Book,
        sheet: xlrd.sheet.Sheet,
        row_index: int,
        raw_row: RawRow,
        result: TblisteParseResult,
    ) -> ParsedInstrument:
        fields: dict[str, Any] = {}
        for column, name in FIELD_BY_COLUMN.items():
            fields[name] = self._canonical_value(workbook, sheet, row_index, column)

        isin = str(fields["isin"]).upper()
        fields["isin"] = isin
        fields["clean_price_input_mode"] = self._clean_price_mode(
            self._text(sheet.cell_value(row_index, 24))
        )
        fields["instrument_family"] = "PARTICIPATION" if isin.startswith("TRD") else "STANDARD"

        first_issue = fields.get("first_issue_date")
        maturity = fields.get("maturity_date")
        next_coupon = fields.get("next_coupon_date")
        row_diagnostics: list[Diagnostic] = []
        if first_issue and maturity and first_issue >= maturity:
            row_diagnostics.append(
                Diagnostic(
                    code="ISSUE_NOT_BEFORE_MATURITY",
                    severity="ERROR",
                    message="First issue date must be before maturity date.",
                    sheet_name=sheet.name,
                    row_number=row_index + 1,
                )
            )
        if next_coupon and maturity and next_coupon > maturity:
            row_diagnostics.append(
                Diagnostic(
                    code="NEXT_COUPON_AFTER_MATURITY",
                    severity="ERROR",
                    message="Next coupon date is after maturity.",
                    sheet_name=sheet.name,
                    row_number=row_index + 1,
                )
            )

        remarks = self.remarks_parser.parse(
            fields.get("remarks_raw"),
            isin=isin,
            spread_raw=fields.get("spread_raw"),
            yield_type=fields.get("yield_type_raw"),
        )
        for item in remarks.diagnostics:
            row_diagnostics.append(
                Diagnostic(
                    code=item.code,
                    severity=item.severity,
                    message=item.message,
                    sheet_name=sheet.name,
                    row_number=row_index + 1,
                    column_number=31,
                    raw_fragment=item.raw_fragment,
                    context=item.context,
                )
            )
        result.diagnostics.extend(row_diagnostics)
        eligible = (
            is_valid_isin(isin)
            and not any(item.severity in {"ERROR", "FATAL"} for item in row_diagnostics)
            and remarks.status not in {"AMBIGUOUS", "CONFLICTING", "REJECTED"}
        )
        return ParsedInstrument(
            row_number=row_index + 1,
            isin=isin,
            fields=fields,
            raw_row=raw_row,
            term_rule=remarks.ast,
            parse_status=remarks.status,
            valuation_eligible=eligible,
        )

    def _parse_reference_sheet(
        self,
        workbook: xlrd.book.Book,
        result: TblisteParseResult,
    ) -> None:
        sheet = next(
            (item for item in workbook.sheets() if "group codes" in item.name.casefold()),
            None,
        )
        if sheet is None:
            result.diagnostics.append(
                Diagnostic(
                    code="REFERENCE_SHEET_MISSING",
                    severity="ERROR",
                    message="Grup Kodları (Group Codes) sheet is missing.",
                )
            )
            return

        for row_index in range(1, sheet.nrows):
            raw_row = self._raw_row(workbook, sheet, row_index)
            raw_row.row_class = "FOOTER"
            result.raw_rows.append(raw_row)
            group_code = self._integer(sheet.cell_value(row_index, 0))
            if group_code is not None:
                result.group_codes.append(
                    GroupCodeReference(
                        code=group_code,
                        description_tr=self._text(sheet.cell_value(row_index, 1)),
                        description_en=self._text(sheet.cell_value(row_index, 4)),
                        row_number=row_index + 1,
                    )
                )
            class_code = self._text(sheet.cell_value(row_index, 6))
            if class_code:
                result.classifications.append(
                    InstrumentClassificationReference(
                        code=class_code,
                        description_tr=self._text(sheet.cell_value(row_index, 7)),
                        description_en=self._text(sheet.cell_value(row_index, 9)),
                        row_number=row_index + 1,
                    )
                )

    @staticmethod
    def _detect_conflicts(result: TblisteParseResult) -> None:
        by_isin: dict[str, list[ParsedInstrument]] = defaultdict(list)
        for instrument in result.instruments:
            by_isin[instrument.isin].append(instrument)
        for isin, rows in by_isin.items():
            if len(rows) < 2:
                continue
            differences: dict[str, list[Any]] = {}
            for field_name in FIELD_BY_COLUMN.values():
                if field_name == "source_sequence":
                    continue
                values = [item.fields.get(field_name) for item in rows]
                serialized = {json.dumps(value, ensure_ascii=False, sort_keys=True) for value in values}
                if len(serialized) > 1:
                    differences[field_name] = values
            result.conflicts.append(
                InstrumentConflictData(
                    isin=isin,
                    row_numbers=[item.row_number for item in rows],
                    differences=differences,
                )
            )
            result.diagnostics.append(
                Diagnostic(
                    code="CONFLICTING_DUPLICATE",
                    severity="ERROR",
                    message=f"ISIN {isin} has conflicting rows and cannot be auto-published.",
                    context={
                        "row_numbers": [item.row_number for item in rows],
                        "different_fields": sorted(differences),
                    },
                )
            )

    @staticmethod
    def _apply_conflict_eligibility(result: TblisteParseResult) -> None:
        conflicted = {item.isin for item in result.conflicts}
        for instrument in result.instruments:
            if instrument.isin in conflicted:
                instrument.valuation_eligible = False
                instrument.parse_status = "CONFLICTING"
                instrument.term_rule["status"] = "CONFLICTING"

    def _raw_row(
        self,
        workbook: xlrd.book.Book,
        sheet: xlrd.sheet.Sheet,
        row_index: int,
    ) -> RawRow:
        cells: list[RawCell] = []
        for column in range(sheet.ncols):
            cell = sheet.cell(row_index, column)
            display = self._display_value(workbook, cell)
            raw_value: Any = cell.value
            if isinstance(raw_value, float) and raw_value.is_integer():
                raw_value = int(raw_value)
            cells.append(
                RawCell(
                    column_number=column + 1,
                    cell_type=xlrd.sheet.ctype_text.get(cell.ctype, str(cell.ctype)),
                    raw_value=raw_value,
                    display_value=display,
                )
            )
        payload = json.dumps(
            [cell.to_dict() for cell in cells],
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        ).encode("utf-8")
        return RawRow(
            sheet_name=sheet.name,
            row_number=row_index + 1,
            row_class="UNKNOWN",
            cells=cells,
            row_hash=hashlib.sha256(payload).hexdigest(),
        )

    def _canonical_value(
        self,
        workbook: xlrd.book.Book,
        sheet: xlrd.sheet.Sheet,
        row: int,
        column: int,
    ) -> Any:
        value = sheet.cell_value(row, column)
        if column in DATE_COLUMNS:
            return self._date_value(workbook, sheet, row, column)
        if column in INTEGER_COLUMNS:
            return self._integer(value)
        if column in DECIMAL_COLUMNS:
            parsed = self._decimal(value)
            return str(parsed) if parsed is not None else None
        return self._text(value) or None

    @staticmethod
    def _display_value(workbook: xlrd.book.Book, cell: xlrd.sheet.Cell) -> str:
        if cell.ctype == xlrd.XL_CELL_DATE:
            parts = xlrd.xldate_as_tuple(cell.value, workbook.datemode)
            return date(parts[0], parts[1], parts[2]).isoformat()
        return TblisteParser._text(cell.value)

    @staticmethod
    def _date_value(
        workbook: xlrd.book.Book,
        sheet: xlrd.sheet.Sheet,
        row: int,
        column: int,
    ) -> str | None:
        cell = sheet.cell(row, column)
        if cell.ctype == xlrd.XL_CELL_DATE:
            parts = xlrd.xldate_as_tuple(cell.value, workbook.datemode)
            return date(parts[0], parts[1], parts[2]).isoformat()
        text = TblisteParser._text(cell.value)
        if not text:
            return None
        for pattern in (r"(\d{4})-(\d{2})-(\d{2})", r"(\d{2})[./](\d{2})[./](\d{4})"):
            match = re.fullmatch(pattern, text)
            if match:
                values = [int(part) for part in match.groups()]
                year, month, day = values if len(match.group(1)) == 4 else (values[2], values[1], values[0])
                try:
                    return date(year, month, day).isoformat()
                except ValueError:
                    return None
        return None

    @staticmethod
    def _text(value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return re.sub(r"\s+", " ", str(value)).strip()

    @staticmethod
    def _integer(value: object) -> int | None:
        if value in (None, "", " ", "-"):
            return None
        try:
            return int(Decimal(str(value).strip().replace(",", ".")))
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _decimal(value: object) -> Decimal | None:
        if value in (None, "", " ", "-"):
            return None
        try:
            return Decimal(str(value).strip().replace(",", "."))
        except InvalidOperation:
            return None

    @staticmethod
    def _clean_price_mode(value: str) -> str:
        lowered = value.casefold()
        if "giriş" in lowered or "input" in lowered:
            return "INPUT"
        if not value or value == "-":
            return "NOT_APPLICABLE"
        return "UNKNOWN"

    @staticmethod
    def _looks_like_source_note(row: RawRow) -> bool:
        populated = [cell for cell in row.cells if cell.display_value]
        if not populated:
            return False
        text = " ".join(cell.display_value for cell in populated)
        if len(text) >= 25 and any(
            token in text.casefold()
            for token in ("updated", "güncellen", "borsa", "bilgiler", "details", "issuer")
        ):
            return True
        return len(populated) == 1 and len(text) >= 40
