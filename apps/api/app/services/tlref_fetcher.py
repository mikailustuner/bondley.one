"""
Borsa Istanbul BIST TLREF Endeks veri cekme servisi.

Kaynaklar:
- Gunluk Oran:   https://www.borsaistanbul.com/datum/tlrefkorani.csv
  Format:        2 header satiri, semicolon delimited, tarih DD/MM/YYYY
  Ornek:         14/04/2026;...;39.8721

- Gunluk Endeks: https://www.borsaistanbul.com/datum/bisttlrefkendeksi.csv
  Format:        2 header satiri, semicolon delimited, tarih DD/MM/YYYY
  Ornek:         1;BISTTLREFK;...;14/04/2026;3533.16729;...

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
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.tlref_rate import TLREFRate

logger = logging.getLogger(__name__)
settings = get_settings()


class TLREFFetcher:
    DAILY_RATE_URL = settings.BIST_TLREF_RATE_DAILY_URL
    DAILY_INDEX_URL = settings.BIST_TLREF_INDEX_DAILY_URL
    HISTORICAL_URL = settings.BIST_TLREF_HISTORICAL_URL

    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_daily(self) -> dict:
        """
        Gunluk oran ve endeks verisini cek, tarih bazinda birlestir ve upsert et.
        - daily_rate: tlrefkorani.csv'den gelir (yuzdelik oran -> gunluk ondalik)
        - index_value: bisttlrefkendeksi.csv'den gelir
        """
        logger.info("Fetching daily TLREF rate + index...")
        try:
            rate_content = await self._download(self.DAILY_RATE_URL)
            index_content = await self._download(self.DAILY_INDEX_URL)

            rate_records = self._parse_daily_rate_csv(rate_content)
            index_records = self._parse_daily_index_csv(index_content)
            records = self._merge_daily_records(rate_records, index_records)
            count = await self._upsert_records(records)
            # fallback: daily_rate bos kalan satirlari endeks farkindan tamamla
            rate_count = await self._compute_daily_rates(only_missing=True)
            return {
                "status": "success",
                "rate_records": len(rate_records),
                "index_records": len(index_records),
                "merged_records": len(records),
                "upserted_records": count,
                "fallback_rates_computed": rate_count,
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

    def _parse_daily_index_csv(self, content: bytes) -> list[dict]:
        """
        Gunluk endeks CSV formati (bisttlrefkendeksi.csv):
        Satir 1: KAYIT SIRA;ENDEKS KODU;ENDEKSLER;...;TARIH;KAPANIS;ACILIS;EN DUSUK;EN YUKSEK
        Satir 2: ORDER;INDEX CODE;...  (Ingilizce basliklar)
        Satir 3+: 1;BISTTLREFK;...;18/02/2026;3533.16729;...
        """
        text = content.decode("utf-8-sig", errors="replace")
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        if not lines:
            return []

        # Header tespiti
        date_idx = -1
        value_idx = -1
        
        # Baslik satirlarindan (ilk 2 satir) sutun yerlerini bulmaya calis
        for i in range(min(2, len(lines))):
            cols = [c.upper() for c in lines[i].split(";")]
            if "TARIH" in cols or "DATE" in cols:
                date_idx = cols.index("TARIH") if "TARIH" in cols else cols.index("DATE")
            if "KAPANIS" in cols or "CLOSING" in cols or "VALUE" in cols:
                # KAPANIS'i bulmaya calis, yoksa VALUE'ya bak
                if "KAPANIS" in cols: value_idx = cols.index("KAPANIS")
                elif "CLOSING" in cols: value_idx = cols.index("CLOSING")
                else: value_idx = cols.index("VALUE")

        records: list[dict] = []
        # Veri satirlarina gec (genelde 2. satirdan sonra baslar)
        start_row = 2 if len(lines) > 2 else 0

        for line in lines[start_row:]:
            parts = line.split(";")
            if len(parts) < 2:
                continue

            row_date = None
            closing_value = None

            # Eğer index tespiti basariliysa direkt kullan
            if date_idx != -1 and date_idx < len(parts):
                row_date = self._try_parse_date(parts[date_idx].strip())
            if value_idx != -1 and value_idx < len(parts):
                closing_value = self._to_decimal(parts[value_idx].strip())

            # Fallback: Eğer index tespiti basarisizsa eski yontemi (ilk tarih ve sonrasindaki ilk sayi) kullan
            if row_date is None or closing_value is None:
                tmp_date = None
                for part in parts:
                    part = part.strip()
                    if tmp_date is None:
                        tmp_date = self._try_parse_date(part)
                    elif closing_value is None:
                        val = self._to_decimal(part)
                        if val is not None and val > 1: # Endeks 1'den buyuktur (TLREFK ~3500)
                            closing_value = val
                row_date = row_date or tmp_date

            if row_date and closing_value:
                records.append({
                    "rate_date": row_date,
                    "index_value": closing_value,
                })

        logger.info(f"Daily index CSV parsed: {len(records)} records")
        return records

    def _parse_daily_rate_csv(self, content: bytes) -> list[dict]:
        """
        Gunluk oran CSV formati (tlreforani.csv):
        Satir 1: TARIH;AD;INGILIZCE ADI;KOD;ISIN;DEGER
        Satir 2: DATE;NAME;NAME IN ENGLISH;CODE;ISIN;VALUE
        Satir 3+: 16/04/2026;TURK LIRASI GECELIK...;TLREF;...;39.8729

        DEGER yuzdelik annual oran oldugu icin:
        daily_rate = (oran_yuzde / 100) / 365
        """
        text = content.decode("utf-8-sig", errors="replace")
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        if not lines:
            return []

        # Header tespiti
        date_idx = -1
        value_idx = -1
        for i in range(min(2, len(lines))):
            cols = [c.upper() for c in lines[i].split(";")]
            if "TARIH" in cols or "DATE" in cols:
                date_idx = cols.index("TARIH") if "TARIH" in cols else cols.index("DATE")
            # Hem DEGER hem VALUE hem de "ORAN" (Rate) diye gelebilir
            for keyword in ["DEGER", "VALUE", "ORAN", "RATE"]:
                if keyword in cols:
                    value_idx = cols.index(keyword)
                    break

        records: list[dict] = []
        skipped = 0
        start_row = 2 if len(lines) > 2 else 0

        for line in lines[start_row:]:
            parts = [p.strip() for p in line.split(";")]
            if len(parts) < 2:
                skipped += 1
                continue

            row_date = None
            raw_value = None

            # Header indeksi basariliysa direkt kullan
            if date_idx != -1 and date_idx < len(parts):
                row_date = self._try_parse_date(parts[date_idx])
            if value_idx != -1 and value_idx < len(parts):
                raw_value = self._to_decimal(parts[value_idx])

            # Fallback: Header tespit edilemediyse eski usul
            if row_date is None or raw_value is None:
                tmp_date = None
                for part in parts:
                    tmp_date = self._try_parse_date(part)
                    if tmp_date: break
                
                # Oran genellikle son kolondadır veya 10'dan büyüktür (örn %40)
                if raw_value is None:
                    raw_value = self._to_decimal(parts[-1])
                
                row_date = row_date or tmp_date

            if row_date is None or raw_value is None or raw_value < 0:
                skipped += 1
                continue

            # Check if this is accidentally an index (very large value)
            if raw_value > 1000:
                logger.warning(f"Extreme rate value detected ({raw_value}) on {row_date}, might be an index mix-up.")
                # If it's an index, we shouldn't store it as a rate
                continue

            daily_rate = (raw_value / Decimal("100") / Decimal("365")).quantize(
                Decimal("0.0000000001"), rounding=ROUND_HALF_UP
            )
            records.append({
                "rate_date": row_date,
                "daily_rate": daily_rate,
            })

        logger.info("Daily rate CSV parsed: parsed=%s skipped=%s", len(records), skipped)
        return records

    def _merge_daily_records(
        self,
        rate_records: list[dict],
        index_records: list[dict],
    ) -> list[dict]:
        """Ayni tarihli oran + endeks kayitlarini birlestirip upsert'e hazirlar."""
        by_date: dict[date, dict] = {}

        for rec in index_records:
            d = rec["rate_date"]
            by_date[d] = {
                "rate_date": d,
                "index_value": rec.get("index_value"),
                "daily_rate": None,
                "source": "BIST_DAILY",
            }

        for rec in rate_records:
            d = rec["rate_date"]
            row = by_date.get(d)
            if row is None:
                # TLREFRate.index_value nullable olmadigi icin index olmayan gunleri atla
                continue
            row["daily_rate"] = rec.get("daily_rate")

        merged = [v for v in by_date.values() if v.get("index_value") is not None]
        logger.info(
            "Daily TLREF merge summary: index=%s rate=%s merged=%s",
            len(index_records),
            len(rate_records),
            len(merged),
        )
        return merged

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
                "source": "BIST_HISTORICAL",
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
                    "daily_rate": func.coalesce(stmt.excluded.daily_rate, TLREFRate.daily_rate),
                    "source": stmt.excluded.source,
                },
            )
            await self.db.execute(stmt)
            count += len(batch)
        await self.db.commit()
        logger.info(f"Upserted {count} TLREF index records")
        return count

    async def _compute_daily_rates(self, only_missing: bool = False) -> int:
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
                if only_missing and curr.daily_rate is not None:
                    continue
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
