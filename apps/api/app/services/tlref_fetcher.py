"""
Borsa Istanbul TLREF veri cekme servisi.

Gunluk akis:
1. CSV/ZIP dosyasini BIST sunucularindan indir
2. Parse et (semicolon-delimited)
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
        """Gunluk CSV indir -> TLREF + tahvil + market data."""
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
        """Tarihsel ZIP indir -> TLREF + tahvil + market data."""
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
            csv_files = [f for f in zf.namelist() if f.lower().endswith(".csv")]
            if not csv_files:
                raise ValueError("ZIP dosyasinda CSV bulunamadi")
            csv_name = csv_files[0]
            logger.info(f"Extracting {csv_name} from ZIP")
            return zf.read(csv_name)

    # ------------------------------------------------------------------
    # Core processing
    # ------------------------------------------------------------------

    async def _process_csv(self, content: bytes, tag: str = "") -> dict:
        """
        BIST CSV icerigini parse et:
        - Her satirdaki TRT/TRB ISIN kodlarini bul -> bonds tablosuna ekle
        - Sayisal degerleri market_data'ya yaz
        - TLREF orani satirin degerinden cikarilir
        """
        text = content.decode("utf-8-sig", errors="replace")

        for delim in [";", ",", "\t"]:
            try:
                df = pd.read_csv(io.StringIO(text), delimiter=delim, dtype=str, header=None)
                if len(df.columns) >= 3:
                    break
            except Exception:
                continue
        else:
            df = pd.read_csv(io.StringIO(text), dtype=str, header=None)

        logger.info(f"[{tag}] CSV shape: {df.shape}")

        # Baslik satirlarini atla (ilk 2 satir genellikle TR/EN header)
        if df.shape[0] > 2:
            header_text = " ".join(str(v) for v in df.iloc[0].values if pd.notna(v))
            if "TARIH" in header_text.upper() or "DATE" in header_text.upper():
                df = df.iloc[2:].reset_index(drop=True)
            elif not any(ISIN_RE.search(str(v)) for v in df.iloc[0].values if pd.notna(v)):
                first_data_row = 0
                for i in range(min(5, len(df))):
                    row_text = " ".join(str(v) for v in df.iloc[i].values if pd.notna(v))
                    if ISIN_RE.search(row_text) or self._looks_like_date(row_text):
                        first_data_row = i
                        break
                if first_data_row > 0:
                    df = df.iloc[first_data_row:].reset_index(drop=True)

        tlref_records: list[dict] = []
        bond_isins: set[str] = set()
        market_records: list[dict] = []

        for _, row in df.iterrows():
            values = [str(v).strip() for v in row.values if pd.notna(v) and str(v).strip()]
            if not values:
                continue

            row_text = " ".join(values)

            # Tarih bul
            row_date = self._extract_date(values)
            if row_date is None:
                continue

            # ISIN kodlarini bul
            isins_found = ISIN_RE.findall(row_text)

            # Sayisal degerleri cikar
            numerics = self._extract_numerics(values)

            # TLREF orani (ISIN degil, genel oran satiri olabilir)
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
                    rec = {
                        "isin": isin,
                        "trade_date": row_date,
                        "clean_price": numerics[0],
                        "tlref_index": numerics[1] if len(numerics) > 1 else None,
                        "fark": numerics[2] if len(numerics) > 2 else None,
                    }
                    market_records.append(rec)

                    # Eger satirin degerlerinde TLREF orani da varsa kaydet
                    if len(numerics) > 1:
                        tlref_records.append({
                            "rate_date": row_date,
                            "rate_value": numerics[1] if numerics[1] > Decimal("0.01") else numerics[0],
                            "isin": "TRIXIST00015",
                            "source": "BIST",
                        })

        # Deduplicate TLREF records (ayni gun icin en son)
        tlref_unique: dict[date, dict] = {}
        for r in tlref_records:
            tlref_unique[r["rate_date"]] = r
        tlref_deduped = list(tlref_unique.values())

        # DB operations
        tlref_count = await self._upsert_tlref(tlref_deduped)
        bonds_count = await self._upsert_bonds(bond_isins)
        market_count = await self._upsert_market_data(market_records)

        result = {
            "status": "success",
            "tlref_records": tlref_count,
            "bonds_created": bonds_count,
            "market_records": market_count,
        }
        logger.info(f"[{tag}] Sync complete: {result}")
        return result

    # ------------------------------------------------------------------
    # Helpers: date / numeric extraction
    # ------------------------------------------------------------------

    @staticmethod
    def _looks_like_date(text: str) -> bool:
        return bool(re.search(r"\d{2}[/.\-]\d{2}[/.\-]\d{2,4}", text))

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
        logger.info(f"Created {created} new bonds (total ISINs: {len(isins)})")
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
            rec = {
                "bond_id": bond_id,
                "trade_date": r["trade_date"],
                "clean_price": r["clean_price"],
                "tlref_index": r.get("tlref_index"),
                "fark": r.get("fark"),
            }
            db_records.append(rec)

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
