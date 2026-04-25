"""
KAP veri cekme Celery task'i.
Gunluk 16:15'te calisir (celery_app.py'da schedule edilir).
"""

import logging
import time
from datetime import datetime

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.tasks.celery_app import celery_app
from app.core.config import get_settings
from app.models.kap_disclosure import KapDisclosure, KapDisclosureDetail

logger = logging.getLogger(__name__)

settings = get_settings()
sync_engine = create_engine(settings.DATABASE_URL_SYNC)
SyncSession = sessionmaker(bind=sync_engine)


@celery_app.task(name="app.tasks.kap_tasks.fetch_kap_disclosures", bind=True, max_retries=2)
def fetch_kap_disclosures(self):
    """Tum sirketlerin KAP bildirimlerini cek ve DB'ye yaz."""
    logger.info("KAP bildirim cekimi Celery task'i basladi")
    try:
        from app.services.kap_fetcher import fetch_all_kap_data

        with SyncSession() as db:
            result = fetch_all_kap_data(db, fetch_details=True)

        logger.info(f"KAP cekimi tamamlandi: {result}")
        return result

    except Exception as exc:
        logger.error(f"KAP cekimi basarisiz: {exc}")
        raise self.retry(exc=exc, countdown=300)


@celery_app.task(name="app.tasks.kap_tasks.refetch_empty_kap_details", bind=True, max_retries=1)
def refetch_empty_kap_details(self):
    """instrument_type IS NULL olan KAP detaylarini KAP'tan yeniden cekilir (maks 50/gun)."""
    from app.services.kap_fetcher import (
        download_excel_content, parse_excel_detail, build_detail_record,
        extract_rating_from_parsed, EXCEL_DELAY,
    )

    logger.info("KAP bos detay yeniden cekimi basliyor...")
    MAX_PER_RUN = 50
    updated = 0
    skipped = 0

    try:
        with SyncSession() as db:
            records = db.execute(
                select(KapDisclosureDetail, KapDisclosure)
                .join(KapDisclosure, KapDisclosureDetail.disclosure_id == KapDisclosure.id)
                .where(
                    KapDisclosureDetail.instrument_type.is_(None),
                    KapDisclosure.disclosure_index.isnot(None),
                )
                .limit(MAX_PER_RUN)
            ).all()

            if not records:
                logger.info("Yeniden cekilecek bos KAP detayi yok.")
                return {"updated": 0, "skipped": 0}

            logger.info(f"{len(records)} bos KAP detayi yeniden cekilecek...")

            with httpx.Client() as client:
                for detail, disclosure in records:
                    time.sleep(EXCEL_DELAY)
                    html = download_excel_content(client, disclosure.disclosure_index)
                    if not html:
                        logger.warning(f"  Excel indirilemedi: index={disclosure.disclosure_index}")
                        skipped += 1
                        continue

                    parsed = parse_excel_detail(html)
                    if not parsed["key_values"]:
                        logger.debug(f"  Parse bos: index={disclosure.disclosure_index}")
                        skipped += 1
                        continue

                    detail_data = build_detail_record(parsed)
                    detail_data.update(extract_rating_from_parsed(parsed))

                    for key, value in detail_data.items():
                        if value is not None:
                            setattr(detail, key, value)
                    detail.fetched_at = datetime.utcnow()
                    updated += 1
                    logger.info(f"  Guncellendi: index={disclosure.disclosure_index}, isin={disclosure.isin_code}")

            db.commit()

    except Exception as exc:
        logger.error(f"KAP bos detay yeniden cekimi basarisiz: {exc}")
        raise self.retry(exc=exc, countdown=600)

    logger.info(f"KAP bos detay tamamlandi: {updated} guncellendi, {skipped} atlandi")
    return {"updated": updated, "skipped": skipped}
