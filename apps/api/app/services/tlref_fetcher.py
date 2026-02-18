"""
Borsa Istanbul TLREF veri cekme servisi.

Gunluk akis:
1. CSV/ZIP dosyasini BIST sunucularindan indir
2. Parse et — hem genis format (ISIN sutun basliklarinda) hem uzun format desteklenir
3. TLREF oranlarini tlref_rates tablosuna yaz
4. TRT/TRB ISIN kodlarini tespit et -> bonds tablosuna UPSERT
5. Piyasa verilerini market_data tablosuna UPSERT
6. Gecici dosyalari sil

Kaynaklar:
- Gunluk:    https://borsaistanbul.com/datum/tlreforani.csv
- Tarihsel:  https://borsaistanbul.com/datum/TLREFORANI_D.zip
"""

import io
import logging
import re
import zipfile
import tempfile
import shutil
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

import httpx
import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.tlref_rate import TLREFRate

logger = logging.getLogger(__name__)
settings = get_settings()

ISIN_RE = re.compile(r"(TR[TB]\d{6}[A-Z]\d{2})")


def parse_isin_maturity(isin: str) -> date | None:
    """
    TRT/TRB ISIN kodundan vade tarihini cikar.
    Format: TRT DDMMYY xxx  ->  DD/MM/20YY
    Ornek: TRT060127T10  ->  06/01/2027
    """
    m = ISIN_RE.match(isin)
    if not m:
        return None
    body = isin[3:9]
    try:
        day = int(body[0:2])
        month = int(body[2:4])
        year_short = int(body[4:6])
        year = 2000 + year_short
        return date(year, month, day)
    except (ValueError, IndexError):
        return None


class TLREFFetcher:
    DAILY_URL = settings.BIST_TLREF_DAILY_URL
    HISTORICAL_URL = settings.BIST_TLREF_HISTORICAL_URL

    def __init__(self, db: AsyncSession):
        self.db = db
        self._temp_dir: Path | None = None

    @property
    def temp_dir(self) -> Path:
        if self._temp_dir is None:
            self._temp_dir = Path(tempfile.mkdtemp(prefix="tlref_"))
        return self._temp_dir

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def fetch_daily(self) -> dict:
        logger.info("Fetching daily TLREF rate...")
        try:
            content = await self._download(self.DAILY_URL)
            return await self._process_csv(content, tag="daily")
        except Exception as e:
            logger.error(f"Daily TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}
        finally:
            self._cleanup()

    async def fetch_historical(self) -> dict:
        logger.info("Fetching historical TLREF data...")
        try:
            content = await self._download(self.HISTORICAL_URL)
            csv_bytes = self._extract_zip(content)
            return await self._process_csv(csv_bytes, tag="historical")
        except Exception as e:
            logger.error(f"Historical TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}
        finally:
            self._cleanup()

    # ------------------------------------------------------------------
    # Download / Extract
    # ------------------------------------------------------------------

    async def _download(self, url: str) -> bytes:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            logger.info(f"Downloaded {len(response.content)} bytes from {url}")
            return response.content

    def _extract_zip(self, content: bytes) -> bytes:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            all_files = zf.namelist()
            logger.info(f"ZIP contains: {all_files}")
            csv_files = [f for f in all_files if f.lower().endswith(".csv")]
            if not csv_files:
                raise ValueError(f"ZIP dosyasinda CSV bulunamadi. Dosyalar: {all_files}")
            csv_name = csv_files[0]
            logger.info(f"Extracting {csv_name} from ZIP")
            return zf.read(csv_name)

    # ------------------------------------------------------------------
    # Core processing — supports both wide & long CSV formats
    # ------------------------------------------------------------------

    async def _process_csv(self, content: bytes, tag: str = "") -> dict:
        text = content.decode("utf-8-sig", errors="replace")

        # Detect delimiter
        df = None
        for delim in [";", ",", "\t"]:
            try:
                test_df = pd.read_csv(io.StringIO(text), delimiter=delim, dtype=str, nrows=5)
                if len(test_df.columns) >= 2:
                    df = pd.read_csv(io.StringIO(text), delimiter=delim, dtype=str)
                    break
            except Exception:
                continue
        if df is None:
            df = pd.read_csv(io.StringIO(text), dtype=str)

        logger.info(f"[{tag}] CSV shape: {df.shape}, columns: {list(df.columns)[:10]}...")

        # Debug: log first 3 rows
        for i in range(min(3, len(df))):
            row_vals = [str(v) for v in df.iloc[i].values if pd.notna(v)]
            logger.info(f"[{tag}] Row {i}: {row_vals[:8]}...")

        # Scan ALL text (headers + first rows) for ISIN codes
        all_text = " ".join(str(c) for c in df.columns) + " "
        for i in range(min(5, len(df))):
            all_text += " ".join(str(v) for v in df.iloc[i].values if pd.notna(v)) + " "

        all_isins_found = set(ISIN_RE.findall(all_text))
        logger.info(f"[{tag}] ISINs found anywhere in CSV: {len(all_isins_found)}")
        if all_isins_found:
            logger.info(f"[{tag}] Sample ISINs: {list(all_isins_found)[:5]}")

        # Detect format: check if column headers contain ISINs
        header_isins = {}
        for col_idx, col_name in enumerate(df.columns):
            col_str = str(col_name).strip()
            m = ISIN_RE.search(col_str)
            if m:
                header_isins[col_idx] = m.group(1)

        if header_isins:
            logger.info(f"[{tag}] WIDE FORMAT detected: {len(header_isins)} ISINs in column headers")
            return await self._process_wide_format(df, header_isins, tag)
        else:
            logger.info(f"[{tag}] LONG FORMAT: scanning rows for ISINs")
            return await self._process_long_format(df, tag)

    # ------------------------------------------------------------------
    # Wide format: columns = ISIN codes, rows = dates
    # Headers like: TARIH | TRT060127T10 | TRT150228T18 | ...
    # ------------------------------------------------------------------

    async def _process_wide_format(self, df: pd.DataFrame, header_isins: dict[int, str], tag: str) -> dict:
        col_names = list(df.columns)
        tlref_records: list[dict] = []
        bond_isins: set[str] = set(header_isins.values())
        market_records: list[dict] = []

        # Find the date column (first column, or column with date-like values)
        date_col_idx = 0

        # Find TLREF column (not a bond ISIN, contains numeric values)
        tlref_col_idx = None
        for idx, col_name in enumerate(col_names):
            col_upper = str(col_name).upper()
            if idx not in header_isins and ("TLREF" in col_upper or "ENDEKS" in col_upper or "INDEX" in col_upper):
                tlref_col_idx = idx
                break

        for _, row in df.iterrows():
            values = row.values
            # Parse date from first column
            date_str = str(values[date_col_idx]).strip() if pd.notna(values[date_col_idx]) else ""
            row_date = self._parse_single_date(date_str)
            if row_date is None:
                continue

            # Extract TLREF rate
            if tlref_col_idx is not None:
                tlref_val = self._to_decimal(values[tlref_col_idx])
                if tlref_val is not None:
                    tlref_records.append({
                        "rate_date": row_date,
                        "rate_value": tlref_val,
                        "isin": "TRIXIST00015",
                        "source": "BIST",
                    })

            # Extract bond market data from each ISIN column
            for col_idx, isin in header_isins.items():
                if col_idx >= len(values):
                    continue
                val = self._to_decimal(values[col_idx])
                if val is not None:
                    market_records.append({
                        "isin": isin,
                        "trade_date": row_date,
                        "clean_price": val,
                        "tlref_index": None,
                        "fark": None,
                    })

        # Deduplicate TLREF
        tlref_unique: dict[date, dict] = {}
        for r in tlref_records:
            tlref_unique[r["rate_date"]] = r
        tlref_deduped = list(tlref_unique.values())

        tlref_count = await self._upsert_tlref(tlref_deduped)
        bonds_count = await self._upsert_bonds(bond_isins)
        market_count = await self._upsert_market_data(market_records)

        result = {
            "status": "success",
            "tlref_records": tlref_count,
            "bonds_created": bonds_count,
            "market_records": market_count,
            "format": "wide",
        }
        logger.info(f"[{tag}] Wide format sync complete: {result}")
        return result

    # ------------------------------------------------------------------
    # Long format: each row has date + ISIN + values
    # Rows like: 01/01/2024 | TRT060127T10 | TLREF Endeksi | 98.45 | 1234.56
    # ------------------------------------------------------------------

    async def _process_long_format(self, df: pd.DataFrame, tag: str) -> dict:
        # Try to skip header rows
        start_row = 0
        for i in range(min(5, len(df))):
            row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
            row_text = " ".join(row_vals)
            if self._looks_like_date(row_text) or ISIN_RE.search(row_text):
                start_row = i
                break
            header_upper = row_text.upper()
            if "TARIH" in header_upper or "DATE" in header_upper:
                start_row = i + 1
                continue

        if start_row > 0:
            df = df.iloc[start_row:].reset_index(drop=True)
            logger.info(f"[{tag}] Skipped {start_row} header rows")

        tlref_records: list[dict] = []
        bond_isins: set[str] = set()
        market_records: list[dict] = []

        for _, row in df.iterrows():
            values = [str(v).strip() for v in row.values if pd.notna(v) and str(v).strip()]
            if not values:
                continue

            row_text = " ".join(values)
            row_date = self._extract_date(values)
            if row_date is None:
                continue

            isins_found = ISIN_RE.findall(row_text)
            numerics = self._extract_numerics(values)

            if not isins_found:
                if numerics:
                    tlref_records.append({
                        "rate_date": row_date,
                        "rate_value": numerics[0],
                        "isin": "TRIXIST00015",
                        "source": "BIST",
                    })
                continue

            for isin in isins_found:
                bond_isins.add(isin)
                if numerics:
                    market_records.append({
                        "isin": isin,
                        "trade_date": row_date,
                        "clean_price": numerics[0],
                        "tlref_index": numerics[1] if len(numerics) > 1 else None,
                        "fark": numerics[2] if len(numerics) > 2 else None,
                    })

        # Deduplicate TLREF
        tlref_unique: dict[date, dict] = {}
        for r in tlref_records:
            tlref_unique[r["rate_date"]] = r
        tlref_deduped = list(tlref_unique.values())

        tlref_count = await self._upsert_tlref(tlref_deduped)
        bonds_count = await self._upsert_bonds(bond_isins)
        market_count = await self._upsert_market_data(market_records)

        result = {
            "status": "success",
            "tlref_records": tlref_count,
            "bonds_created": bonds_count,
            "market_records": market_count,
            "format": "long",
        }
        logger.info(f"[{tag}] Long format sync complete: {result}")
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _looks_like_date(text: str) -> bool:
        return bool(re.search(r"\d{2}[/.\-]\d{2}[/.\-]\d{2,4}", text))

    @staticmethod
    def _parse_single_date(date_str: str) -> date | None:
        for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d/%m/%y", "%d.%m.%y"):
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _extract_date(values: list[str]) -> date | None:
        for v in values:
            for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d/%m/%y", "%d.%m.%y"):
                try:
                    return datetime.strptime(v.strip(), fmt).date()
                except ValueError:
                    continue
        return None

    @staticmethod
    def _extract_numerics(values: list[str]) -> list[Decimal]:
        nums: list[Decimal] = []
        for v in values:
            cleaned = v.replace(",", ".").replace("%", "").replace(" ", "").strip()
            if ISIN_RE.match(cleaned):
                continue
            try:
                d = Decimal(cleaned)
                if d != 0:
                    nums.append(d)
            except (InvalidOperation, ValueError):
                continue
        return nums

    @staticmethod
    def _to_decimal(val) -> Decimal | None:
        if pd.isna(val):
            return None
        try:
            cleaned = str(val).replace(",", ".").replace("%", "").replace(" ", "").strip()
            if not cleaned or cleaned == "nan":
                return None
            d = Decimal(cleaned)
            return d if d != 0 else None
        except (InvalidOperation, ValueError):
            return None

    # ------------------------------------------------------------------
    # DB upsert operations
    # ------------------------------------------------------------------

    async def _upsert_tlref(self, records: list[dict]) -> int:
        if not records:
            return 0
        count = 0
        for i in range(0, len(records), 500):
            batch = records[i:i + 500]
            stmt = pg_insert(TLREFRate).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["rate_date"],
                set_={
                    "rate_value": stmt.excluded.rate_value,
                    "isin": stmt.excluded.isin,
                    "source": stmt.excluded.source,
                },
            )
            await self.db.execute(stmt)
            count += len(batch)
        await self.db.commit()
        logger.info(f"Upserted {count} TLREF records")
        return count

    async def _upsert_bonds(self, isins: set[str]) -> int:
        if not isins:
            return 0

        existing_result = await self.db.execute(
            select(Bond.isin_code).where(Bond.isin_code.in_(list(isins)))
        )
        existing = set(existing_result.scalars().all())
        new_isins = isins - existing

        created = 0
        for isin in new_isins:
            bond_type = "TRT" if isin.startswith("TRT") else "TRB"
            maturity = parse_isin_maturity(isin)
            if maturity is None:
                maturity = date.today() + timedelta(days=365 * 2)

            issue_estimate = maturity - timedelta(days=365 * 2)
            coupon_rate = Decimal("0.15") if bond_type == "TRT" else Decimal("0.10")

            bond = Bond(
                isin_code=isin,
                bond_type=bond_type,
                issue_date=issue_estimate,
                maturity_date=maturity,
                coupon_rate=coupon_rate,
                coupon_frequency=2,
                face_value=Decimal("100.00"),
                currency="TRY",
                is_active=True,
            )
            self.db.add(bond)
            created += 1

        if created:
            await self.db.flush()
            await self.db.commit()
        logger.info(f"Created {created} new bonds (total ISINs in data: {len(isins)}, already existing: {len(existing)})")
        return created

    async def _upsert_market_data(self, records: list[dict]) -> int:
        if not records:
            return 0

        all_isins = list({r["isin"] for r in records})
        bond_result = await self.db.execute(
            select(Bond.isin_code, Bond.id).where(Bond.isin_code.in_(all_isins))
        )
        isin_to_id: dict[str, int] = {}
        for row in bond_result:
            isin_to_id[row[0]] = row[1]

        db_records = []
        for r in records:
            bond_id = isin_to_id.get(r["isin"])
            if bond_id is None:
                continue
            db_records.append({
                "bond_id": bond_id,
                "trade_date": r["trade_date"],
                "clean_price": r["clean_price"],
                "tlref_index": r.get("tlref_index"),
                "fark": r.get("fark"),
            })

        if not db_records:
            return 0

        count = 0
        for i in range(0, len(db_records), 500):
            batch = db_records[i:i + 500]
            stmt = pg_insert(MarketData).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["bond_id", "trade_date"],
                set_={
                    "clean_price": stmt.excluded.clean_price,
                    "tlref_index": stmt.excluded.tlref_index,
                    "fark": stmt.excluded.fark,
                },
            )
            await self.db.execute(stmt)
            count += len(batch)

        await self.db.commit()
        logger.info(f"Upserted {count} market data records")
        return count

    # ------------------------------------------------------------------
    # Legacy helpers
    # ------------------------------------------------------------------

    async def get_latest_rate(self) -> Decimal | None:
        result = await self.db.execute(
            select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
        )
        rate = result.scalar_one_or_none()
        return rate.rate_value if rate else None

    async def get_rate_for_date(self, target_date: date) -> Decimal | None:
        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.rate_date <= target_date)
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        rate = result.scalar_one_or_none()
        return rate.rate_value if rate else None

    def _cleanup(self):
        if self._temp_dir and self._temp_dir.exists():
            shutil.rmtree(self._temp_dir, ignore_errors=True)
            self._temp_dir = None
