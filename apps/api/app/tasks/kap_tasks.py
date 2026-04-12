"""
KAP veri cekme Celery task'i.
Gunluk 16:15'te calisir (celery_app.py'da schedule edilir).
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.tasks.celery_app import celery_app
from app.core.config import get_settings

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
