"""
Borsa Istanbul BIST TLREF Endeks veri cekme servisi.

Kaynaklar:
- Gunluk:    https://borsaistanbul.com/datum/bisttlrefendeksi.csv
  Format:    2 header satiri, semicolon delimited, tarih DD/MM/YYYY
  Ornek:     1;BISTTLREF;BIST TLREF ENDEKSI;BIST TLREF INDEX;TRY;18/02/2026;5379.45049;...

- Tarihsel:  https://borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip
  Icerik:    BISTTLREFENDEKSI_D.csv
  Format:    1 header satiri, semicolon delimited, tarih DD.MM.YYYY
  Ornek:     14.06.2019;BISTTLREF;BIST TLREF ENDEKSI;BIST TLREF INDEX;TL;1;1000;1000;1000
"""

import io
import logging
import zipfile
from datetime import datetime, date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import httpx
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

    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_daily(self) -> dict:
        """Gunluk endeks verisini cek, upsert et ve ardından gunluk oranları (bir onceki gun vs bugun) hesapla."""
        logger.info("Fetching daily TLREF index...")
        try:
            content = await self._download(self.DAILY_URL)
            records = self._parse_daily_csv(content)
            count = await self._upsert_records(records)
            rate_count = await self._compute_daily_rates()
            return {
                "status": "success",
                "records": count,
                "rates_computed": rate_count,
            }
        except Exception as e:
            logger.error(f"Daily TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}

    async def fetch_historical(self) -> dict:
        logger.info("Fetching historical TLREF index...")
        try:
            content = await self._download(self.HISTORICAL_URL)
            csv_bytes = self._extract_zip(content)
            records = self._parse_historical_csv(csv_bytes)
            count = await self._upsert_records(records)
            rate_count = await self._compute_daily_rates()
            return {
                "status": "success",
                "index_records": count,
                "rates_computed": rate_count,
            }
        except Exception as e:
            logger.error(f"Historical TLREF fetch failed: {e}")
            return {"status": "error", "error": str(e)}

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
                raise ValueError(f"ZIP dosyasinda CSV bulunamadi: {zf.namelist()}")
            csv_name = csv_files[0]
            logger.info(f"Extracting {csv_name} from ZIP")
            return zf.read(csv_name)

    def _parse_daily_csv(self, content: bytes) -> list[dict]:
        """
        Gunluk CSV formati (bisttlrefendeksi.csv):
        Satir 1: KAYIT SIRA;ENDEKS KODU;ENDEKSLER;...;TARIH;KAPANIS;ACILIS;EN DUSUK;EN YUKSEK
        Satir 2: ORDER;INDEX CODE;...  (Ingilizce basliklar)
        Satir 3+: 1;BISTTLREF;...;18/02/2026;5379.45049;5379.45049;5379.45049;5379.45049
        """
        text = content.decode("utf-8-sig", errors="replace")
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]

        records: list[dict] = []
        for line in lines:
            parts = line.split(";")
            if len(parts) < 7:
                continue

            row_date = None
            closing_value = None

            for part in parts:
                part = part.strip()
                if row_date is None:
                    row_date = self._try_parse_date(part)
                if row_date is not None and closing_value is None:
                    val = self._to_decimal(part)
                    if val is not None and val > 0:
                        closing_value = val

            if row_date is None:
                for part in parts:
                    row_date = self._try_parse_date(part.strip())
                    if row_date:
                        break

            if row_date and closing_value:
                records.append({
                    "rate_date": row_date,
                    "index_value": closing_value,
                    "source": "BIST",
                })

        logger.info(f"Daily CSV parsed: {len(records)} records")
        return records

    def _parse_historical_csv(self, content: bytes) -> list[dict]:
        """
        Tarihsel CSV formati (BISTTLREFENDEKSI_D.csv):
        Satir 1: Tarih (GG.AA.YYYY) / Date;Endeks Kodu;...;Kapanis Degeri;En Dusuk;En Yuksek
        Satir 2+: 14.06.2019;BISTTLREF;...;TL;1;1000;1000;1000
        
        Sütun indexleri (0-based): 0=Tarih, 1=Endeks Kodu, 2=TR isim,
        3=EN isim, 4=Kur, 5=Seans, 6=Kapanış, 7=En Düşük, 8=En Yüksek
        """
        text = content.decode("utf-8-sig", errors="replace")
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]

        records: list[dict] = []
        for i, line in enumerate(lines):
            parts = line.split(";")
            if len(parts) < 7:
                continue

            row_date = self._try_parse_date(parts[0].strip())
            if row_date is None:
                continue

            closing_value = self._to_decimal(parts[6].strip()) if len(parts) > 6 else None
            if closing_value is None or closing_value <= 0:
                continue

            records.append({
                "rate_date": row_date,
                "index_value": closing_value,
                "source": "BIST",
            })

        logger.info(f"Historical CSV parsed: {len(records)} records (from {len(lines)} lines)")
        return records

    async def _upsert_records(self, records: list[dict]) -> int:
        if not records:
            return 0
        count = 0
        for i in range(0, len(records), 500):
            batch = records[i : i + 500]
            stmt = pg_insert(TLREFRate).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["rate_date"],
                set_={
                    "index_value": stmt.excluded.index_value,
                    "source": stmt.excluded.source,
                },
            )
            await self.db.execute(stmt)
            count += len(batch)
        await self.db.commit()
        logger.info(f"Upserted {count} TLREF index records")
        return count

    async def _compute_daily_rates(self) -> int:
        """
        Ardisik endeks degerlerinden gunluk oranlari hesapla ve DB'ye yaz.
        Formul: rate_date = D olan satir icin daily_rate = (D gunu endeks - D-1 gunu endeks) / D-1 gunu endeks.
        Yani bir onceki gun ile o gunun endeksi kullanilir; sonuc o gunun (curr) satirina yazilir.
        """
        result = await self.db.execute(
            select(TLREFRate).order_by(TLREFRate.rate_date.asc())
        )
        all_rates = result.scalars().all()
        if len(all_rates) < 2:
            return 0

        updated = 0
        for i in range(1, len(all_rates)):
            prev = all_rates[i - 1]   # bir onceki gun
            curr = all_rates[i]      # o gun
            prev_val = Decimal(str(prev.index_value)) if prev.index_value is not None else None
            curr_val = Decimal(str(curr.index_value)) if curr.index_value is not None else None
            if prev_val is not None and curr_val is not None and prev_val > 0:
                daily = (curr_val - prev_val) / prev_val
                curr.daily_rate = daily.quantize(Decimal("0.0000000001"), rounding=ROUND_HALF_UP)
                updated += 1

        await self.db.commit()
        logger.info(f"Computed daily rates for {updated} records")
        return updated

    async def get_latest_index(self) -> Decimal | None:
        result = await self.db.execute(
            select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(1)
        )
        rate = result.scalar_one_or_none()
        return rate.index_value if rate else None

    @staticmethod
    def _try_parse_date(s: str) -> date | None:
        for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _to_decimal(val: str) -> Decimal | None:
        cleaned = val.replace(",", ".").replace(" ", "").strip()
        if not cleaned or cleaned.lower() == "nan":
            return None
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None
