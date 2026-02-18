"""
Borsa Istanbul TLREF veri cekme servisi.

Gunluk akis:
1. CSV/ZIP dosyasini BIST sunucularindan indir
2. Parse et (semicolon-delimited, ilk 2 satir header)
3. PostgreSQL'e UPSERT yap
4. Gecici dosyalari sil

Kaynaklar:
- Gunluk:    https://borsaistanbul.com/datum/tlreforani.csv
- Tarihsel:  https://borsaistanbul.com/datum/TLREFORANI_D.zip
"""

import io
import logging
import zipfile
import tempfile
import shutil
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path

import httpx
import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.tlref_rate import TLREFRate

logger = logging.getLogger(__name__)
settings = get_settings()


class TLREFFetcher:
    DAILY_URL = settings.BIST_TLREF_DAILY_URL
    HISTORICAL_URL = settings.BIST_TLREF_HISTORICAL_URL
    CSV_DELIMITER = ";"
    HEADER_ROWS = 2

    def __init__(self, db: AsyncSession):
        self.db = db
        self._temp_dir: Path | None = None

    @property
    def temp_dir(self) -> Path:
        if self._temp_dir is None:
            self._temp_dir = Path(tempfile.mkdtemp(prefix="tlref_"))
        return self._temp_dir

    async def fetch_daily(self) -> dict:
        """Gunluk TLREF oranini indir, parse et, DB'ye yaz, dosyayi sil."""
        logger.info("Fetching daily TLREF rate...")
        try:
            content = await self._download(self.DAILY_URL)
            records = self._parse_csv_bytes(content)
            count = await self._upsert_records(records)
            return {"status": "success", "records_upserted": count}
        except Exception as e:
            logger.error(f"Daily TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}
        finally:
            self._cleanup()

    async def fetch_historical(self) -> dict:
        """ZIP indir, ac, tum tarihsel verileri parse et, DB'ye yaz, dosyalari sil."""
        logger.info("Fetching historical TLREF data...")
        try:
            content = await self._download(self.HISTORICAL_URL)
            csv_bytes = self._extract_zip(content)
            records = self._parse_csv_bytes(csv_bytes)
            count = await self._upsert_records(records)
            return {"status": "success", "records_upserted": count}
        except Exception as e:
            logger.error(f"Historical TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}
        finally:
            self._cleanup()

    async def _download(self, url: str) -> bytes:
        """URL'den dosyayi indir."""
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            logger.info(f"Downloaded {len(response.content)} bytes from {url}")
            return response.content

    def _extract_zip(self, content: bytes) -> bytes:
        """ZIP iceriginden CSV dosyasini cikar."""
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            csv_files = [f for f in zf.namelist() if f.endswith(".csv")]
            if not csv_files:
                raise ValueError("ZIP dosyasinda CSV bulunamadi")

            csv_name = csv_files[0]
            logger.info(f"Extracting {csv_name} from ZIP")
            return zf.read(csv_name)

    def _parse_csv_bytes(self, content: bytes) -> list[dict]:
        """
        BIST TLREF CSV formatini parse et.

        Format: TARIH;AD;INGILIZCE ADI;KOD;ISIN;DEGER
        Ilk 2 satir header (TR + EN).
        """
        text = content.decode("utf-8-sig", errors="replace")

        try:
            df = pd.read_csv(
                io.StringIO(text),
                delimiter=self.CSV_DELIMITER,
                skiprows=self.HEADER_ROWS,
                header=None,
                names=["tarih", "ad", "ad_en", "kod", "isin", "deger"],
                dtype=str,
            )
        except Exception as e:
            logger.error(f"CSV parse error: {e}")
            raise

        df = df.dropna(subset=["tarih", "deger"])

        records = []
        for _, row in df.iterrows():
            try:
                rate_date = self._parse_date(row["tarih"])
                rate_value = Decimal(str(row["deger"]).replace(",", ".").strip())
                isin = str(row.get("isin", "TRIXIST00015")).strip()

                records.append({
                    "rate_date": rate_date,
                    "rate_value": rate_value,
                    "isin": isin,
                    "source": "BIST",
                })
            except (InvalidOperation, ValueError) as e:
                logger.warning(f"Skipping row: {row.to_dict()} - {e}")
                continue

        logger.info(f"Parsed {len(records)} TLREF records")
        return records

    @staticmethod
    def _parse_date(date_str: str) -> date:
        """DD/MM/YYYY formatini parse et."""
        cleaned = date_str.strip()
        for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(cleaned, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Could not parse date: {cleaned}")

    async def _upsert_records(self, records: list[dict]) -> int:
        """PostgreSQL'e UPSERT (ON CONFLICT DO UPDATE)."""
        if not records:
            return 0

        count = 0
        batch_size = 500
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]

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

    async def get_latest_rate(self) -> Decimal | None:
        """DB'den en son TLREF oranini getir."""
        result = await self.db.execute(
            select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
        )
        rate = result.scalar_one_or_none()
        return rate.rate_value if rate else None

    async def get_rate_for_date(self, target_date: date) -> Decimal | None:
        """Belirli bir tarihteki TLREF oranini getir."""
        result = await self.db.execute(
            select(TLREFRate)
            .where(TLREFRate.rate_date <= target_date)
            .order_by(TLREFRate.rate_date.desc())
            .limit(1)
        )
        rate = result.scalar_one_or_none()
        return rate.rate_value if rate else None

    def _cleanup(self):
        """Gecici dosyalari sil."""
        if self._temp_dir and self._temp_dir.exists():
            shutil.rmtree(self._temp_dir, ignore_errors=True)
            logger.info(f"Cleaned up temp directory: {self._temp_dir}")
            self._temp_dir = None
