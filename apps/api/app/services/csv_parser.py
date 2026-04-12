"""
CSV parser for bond market data files (Book3.xlsx - Sheet1.csv format).

Handles:
- Skipping metadata header rows (first 5 rows)
- Regex extraction of TRT/TRB ISIN codes
- NaN / empty column cleanup
- Column mapping to database fields
"""

import re
import io
import logging
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass

import pandas as pd

logger = logging.getLogger(__name__)

ISIN_PATTERN = re.compile(r"(TR[TB]\d{6}[A-Z]\d{2})")

COLUMN_MAP = {
    "TLREF ENDEKS": "tlref_index",
    "TLREF_ENDEKS": "tlref_index",
    "Fark": "fark",
    "FARK": "fark",
    "Spread": "spread",
    "SPREAD": "spread",
}


@dataclass
class ParsedBondRow:
    isin_code: str
    bond_type: str
    clean_price: Decimal | None = None
    tlref_index: Decimal | None = None
    fark: Decimal | None = None
    spread: Decimal | None = None


class CSVParser:
    def __init__(self, skip_rows: int = 5):
        self.skip_rows = skip_rows

    def parse_file(self, file_content: bytes, filename: str = "") -> list[ParsedBondRow]:
        """Parse uploaded CSV/XLSX file and extract bond data rows."""
        try:
            if filename.endswith(".xlsx") or filename.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(file_content), skiprows=self.skip_rows)
            else:
                content_str = file_content.decode("utf-8-sig", errors="replace")
                df = self._detect_and_read_csv(content_str)
        except Exception as e:
            logger.error(f"Failed to parse file {filename}: {e}")
            raise ValueError(f"Dosya parse edilemedi: {e}")

        return self._extract_bond_rows(df)

    def _detect_and_read_csv(self, content: str) -> pd.DataFrame:
        """Detect delimiter and parse CSV, skipping metadata rows."""
        for delimiter in [",", ";", "\t"]:
            try:
                df = pd.read_csv(
                    io.StringIO(content),
                    delimiter=delimiter,
                    skiprows=self.skip_rows,
                    engine="python",
                )
                if len(df.columns) > 1:
                    return df
            except Exception:
                continue

        return pd.read_csv(
            io.StringIO(content),
            skiprows=self.skip_rows,
            engine="python",
        )

    def _extract_bond_rows(self, df: pd.DataFrame) -> list[ParsedBondRow]:
        """Extract rows containing TRT/TRB ISIN codes."""
        df = df.dropna(how="all")

        df.columns = [str(c).strip() for c in df.columns]
        mapped_cols = {}
        for col in df.columns:
            for pattern, target in COLUMN_MAP.items():
                if pattern.lower() in col.lower():
                    mapped_cols[col] = target
                    break

        if mapped_cols:
            df = df.rename(columns=mapped_cols)

        rows: list[ParsedBondRow] = []

        for _, row in df.iterrows():
            row_str = " ".join(str(v) for v in row.values if pd.notna(v))
            match = ISIN_PATTERN.search(row_str)
            if not match:
                continue

            isin = match.group(1)
            bond_type = "TRT" if isin.startswith("TRT") else "TRB"

            parsed = ParsedBondRow(isin_code=isin, bond_type=bond_type)

            for col_name, field_name in [
                ("clean_price", "clean_price"),
                ("tlref_index", "tlref_index"),
                ("fark", "fark"),
                ("spread", "spread"),
            ]:
                if col_name in df.columns:
                    val = row.get(col_name)
                    if pd.notna(val):
                        setattr(parsed, field_name, self._to_decimal(val))

            numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
            if parsed.clean_price is None and numeric_cols:
                for nc in numeric_cols:
                    val = row.get(nc)
                    if pd.notna(val) and 50 < float(val) < 200:
                        parsed.clean_price = self._to_decimal(val)
                        break

            rows.append(parsed)

        logger.info(f"Parsed {len(rows)} bond rows from CSV")
        return rows

    @staticmethod
    def _to_decimal(value) -> Decimal | None:
        try:
            cleaned = str(value).replace(",", ".").strip()
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None
