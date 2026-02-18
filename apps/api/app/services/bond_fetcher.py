"""
Borsa Istanbul tahvil listesi (tbliste.zip) veri cekme servisi.

Kaynak: https://borsaistanbul.com/datum/tbliste.zip
Icerik: tbliste_YYYYMMDD.xls  (xlrd ile okunur)
Sheet 0: "Borclanma Araclari" — 33 sutun, ~2100+ aktif tahvil
"""

import io
import logging
import zipfile
import tempfile
import shutil
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import httpx
import xlrd
from sqlalchemy import select, func, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.bond import Bond

logger = logging.getLogger(__name__)
settings = get_settings()

COL_ISIN = 1
COL_ISSUER = 3
COL_ISSUANCE_TYPE = 4
COL_YIELD_TYPE = 5
COL_SECURITY_TYPE = 6
COL_COUPON_FREQ = 7
COL_CURRENCY = 8
COL_GROUP_CODE = 9
COL_FIRST_ISSUE_DATE = 10
COL_MATURITY_DATE = 11
COL_DAYS_TO_MATURITY = 12
COL_TOTAL_AMOUNT = 13
COL_LAST_ISSUE_DATE = 14
COL_LAST_ISSUE_PRICE = 15
COL_LAST_ISSUE_YIELD = 16
COL_FIRST_ISSUE_YIELD = 17
COL_NEXT_COUPON_DATE = 18
COL_NEXT_COUPON_RATE = 19
COL_SPREAD = 20
COL_FIRST_ISSUE_PRICE = 21
COL_QUOTATION_METHOD = 22
COL_ACCRUED_INTEREST = 23
COL_CLEAN_PRICE = 24
COL_DIRTY_PRICE = 25
COL_SETTLEMENT_PRICE = 26
COL_YIELD = 27
COL_COMPOUND_YIELD = 28
COL_DAY_COUNT = 29
COL_REMARKS = 30
COL_BROKERAGE = 31
COL_SECURITY_TYPE_DETAIL = 32

# Bond model string column max lengths (truncate to avoid StringDataRightTruncationError)
BOND_STRING_MAX_LENGTHS = {
    "isin_code": 30,
    "issuer": 255,
    "issuance_type": 100,
    "yield_type": 255,
    "security_type": 255,
    "coupon_frequency": 50,
    "currency": 20,
    "last_issue_date_text": 100,
    "quotation_method": 100,
    "accrued_interest_text": 100,
    "clean_price_text": 100,
    "dirty_price_formula": 100,
    "settlement_price_formula": 100,
    "yield_formula": 100,
    "compound_yield_formula": 100,
    "day_count_convention": 100,
    "brokerage": 255,
    "security_type_detail": 50,
}


def _truncate_record(rec: dict) -> dict:
    """Truncate string fields to DB column max length."""
    out = {}
    for k, v in rec.items():
        if k not in BOND_STRING_MAX_LENGTHS:
            out[k] = v
            continue
        if isinstance(v, str) and len(v) > BOND_STRING_MAX_LENGTHS[k]:
            out[k] = v[: BOND_STRING_MAX_LENGTHS[k]]
        else:
            out[k] = v
    return out


class BondFetcher:
    URL = settings.BIST_BOND_LIST_URL

    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_and_sync(self) -> dict:
        """Download tbliste.zip, parse XLS, upsert bonds, mark removed as inactive."""
        logger.info("Fetching bond list from BIST...")
        try:
            content = await self._download(self.URL)
            xls_bytes = self._extract_xls(content)
            records = self._parse_xls(xls_bytes)
            upserted = await self._upsert_bonds(records)
            deactivated = await self._deactivate_missing(records)
            return {
                "status": "success",
                "bonds_upserted": upserted,
                "bonds_deactivated": deactivated,
            }
        except Exception as e:
            logger.error(f"Bond list fetch failed: {e}")
            return {"status": "error", "error": str(e)}

    async def _download(self, url: str) -> bytes:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            logger.info(f"Downloaded {len(response.content)} bytes from {url}")
            return response.content

    def _extract_xls(self, content: bytes) -> bytes:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            xls_files = [f for f in zf.namelist() if f.lower().endswith(".xls")]
            if not xls_files:
                raise ValueError(f"ZIP'te XLS bulunamadi: {zf.namelist()}")
            xls_name = xls_files[0]
            logger.info(f"Extracting {xls_name} from ZIP")
            return zf.read(xls_name)

    def _parse_xls(self, xls_bytes: bytes) -> list[dict]:
        wb = xlrd.open_workbook(file_contents=xls_bytes)
        sh = wb.sheet_by_index(0)
        records: list[dict] = []

        for row_idx in range(1, sh.nrows):
            isin = self._cell_str(sh, row_idx, COL_ISIN)
            if not isin or len(isin) < 5:
                continue

            days_to_maturity = self._cell_int(sh, row_idx, COL_DAYS_TO_MATURITY)
            if days_to_maturity is not None and days_to_maturity <= 0:
                continue

            rec = {
                "isin_code": isin,
                "issuer": self._cell_str(sh, row_idx, COL_ISSUER) or None,
                "issuance_type": self._cell_str(sh, row_idx, COL_ISSUANCE_TYPE) or None,
                "yield_type": self._cell_str(sh, row_idx, COL_YIELD_TYPE) or None,
                "security_type": self._cell_str(sh, row_idx, COL_SECURITY_TYPE) or None,
                "coupon_frequency": self._cell_str(sh, row_idx, COL_COUPON_FREQ) or None,
                "currency": self._cell_str(sh, row_idx, COL_CURRENCY) or "TRY",
                "group_code": self._cell_int(sh, row_idx, COL_GROUP_CODE),
                "first_issue_date": self._cell_date(sh, wb, row_idx, COL_FIRST_ISSUE_DATE),
                "maturity_date": self._cell_date(sh, wb, row_idx, COL_MATURITY_DATE),
                "days_to_maturity": days_to_maturity,
                "total_issue_amount": self._cell_decimal(sh, row_idx, COL_TOTAL_AMOUNT),
                "last_issue_date_text": self._cell_str(sh, row_idx, COL_LAST_ISSUE_DATE) or None,
                "last_issue_price": self._cell_decimal(sh, row_idx, COL_LAST_ISSUE_PRICE),
                "last_issue_yield": self._parse_yield_str(sh, row_idx, COL_LAST_ISSUE_YIELD),
                "first_issue_yield": self._parse_yield_str(sh, row_idx, COL_FIRST_ISSUE_YIELD),
                "next_coupon_date": self._cell_date(sh, wb, row_idx, COL_NEXT_COUPON_DATE),
                "next_coupon_rate": self._cell_decimal(sh, row_idx, COL_NEXT_COUPON_RATE),
                "spread": self._cell_decimal(sh, row_idx, COL_SPREAD),
                "first_issue_price": self._cell_decimal(sh, row_idx, COL_FIRST_ISSUE_PRICE),
                "quotation_method": self._cell_str(sh, row_idx, COL_QUOTATION_METHOD) or None,
                "accrued_interest_text": self._cell_str(sh, row_idx, COL_ACCRUED_INTEREST) or None,
                "clean_price_text": self._cell_str(sh, row_idx, COL_CLEAN_PRICE) or None,
                "dirty_price_formula": self._cell_str(sh, row_idx, COL_DIRTY_PRICE) or None,
                "settlement_price_formula": self._cell_str(sh, row_idx, COL_SETTLEMENT_PRICE) or None,
                "yield_formula": self._cell_str(sh, row_idx, COL_YIELD) or None,
                "compound_yield_formula": self._cell_str(sh, row_idx, COL_COMPOUND_YIELD) or None,
                "day_count_convention": self._cell_str(sh, row_idx, COL_DAY_COUNT) or None,
                "remarks": self._cell_str(sh, row_idx, COL_REMARKS) or None,
                "brokerage": self._cell_str(sh, row_idx, COL_BROKERAGE) or None,
                "security_type_detail": self._cell_str(sh, row_idx, COL_SECURITY_TYPE_DETAIL) or None,
                "is_active": True,
            }
            records.append(rec)

        logger.info(f"Parsed {len(records)} active bonds from XLS")
        return records

    async def _upsert_bonds(self, records: list[dict]) -> int:
        if not records:
            return 0

        count = 0
        update_cols = {k for k in records[0].keys() if k != "isin_code"}

        for i in range(0, len(records), 200):
            batch = [_truncate_record(r) for r in records[i: i + 200]]
            stmt = pg_insert(Bond).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["isin_code"],
                set_={col: getattr(stmt.excluded, col) for col in update_cols},
            )
            await self.db.execute(stmt)
            count += len(batch)

        await self.db.commit()
        logger.info(f"Upserted {count} bonds")
        return count

    async def _deactivate_missing(self, records: list[dict]) -> int:
        """Mark bonds not in the current file as inactive."""
        if not records:
            return 0

        current_isins = {r["isin_code"] for r in records}
        result = await self.db.execute(
            select(Bond.isin_code).where(Bond.is_active == True)
        )
        db_isins = {row[0] for row in result.all()}
        missing = db_isins - current_isins

        if missing:
            await self.db.execute(
                update(Bond)
                .where(Bond.isin_code.in_(missing))
                .values(is_active=False)
            )
            await self.db.commit()
            logger.info(f"Deactivated {len(missing)} bonds no longer in BIST list")

        return len(missing)

    # --- Cell parsing helpers ---

    @staticmethod
    def _cell_str(sh, row: int, col: int) -> str:
        if col >= sh.ncols:
            return ""
        val = sh.cell_value(row, col)
        if isinstance(val, float):
            if val == int(val):
                return str(int(val))
            return str(val)
        return str(val).strip()

    @staticmethod
    def _cell_int(sh, row: int, col: int) -> int | None:
        if col >= sh.ncols:
            return None
        val = sh.cell_value(row, col)
        if isinstance(val, (int, float)) and val != 0:
            return int(val)
        try:
            return int(float(str(val).strip()))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _cell_decimal(sh, row: int, col: int) -> Decimal | None:
        if col >= sh.ncols:
            return None
        val = sh.cell_value(row, col)
        if isinstance(val, (int, float)):
            if val == 0.0:
                return Decimal("0")
            return Decimal(str(val))
        cleaned = str(val).replace(",", ".").strip()
        if not cleaned or cleaned == "-":
            return None
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _cell_date(sh, wb, row: int, col: int) -> date | None:
        if col >= sh.ncols:
            return None
        cell_type = sh.cell_type(row, col)
        val = sh.cell_value(row, col)

        if cell_type == xlrd.XL_CELL_DATE and isinstance(val, float) and val > 0:
            try:
                dt_tuple = xlrd.xldate_as_tuple(val, wb.datemode)
                return date(dt_tuple[0], dt_tuple[1], dt_tuple[2])
            except Exception:
                return None

        if isinstance(val, float) and val > 30000:
            try:
                dt_tuple = xlrd.xldate_as_tuple(val, wb.datemode)
                return date(dt_tuple[0], dt_tuple[1], dt_tuple[2])
            except Exception:
                return None

        if isinstance(val, str):
            for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d.%m.%y", "%d/%m/%y", "%Y-%m-%d"):
                try:
                    return datetime.strptime(val.strip(), fmt).date()
                except ValueError:
                    continue

        return None

    @staticmethod
    def _parse_yield_str(sh, row: int, col: int) -> Decimal | None:
        """Parse yield values which may be numeric or string like '44.50'."""
        if col >= sh.ncols:
            return None
        val = sh.cell_value(row, col)
        if isinstance(val, (int, float)):
            return Decimal(str(val)) if val != 0 else None
        cleaned = str(val).replace(",", ".").replace("%", "").strip()
        if not cleaned or cleaned == "-":
            return None
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None
