#!/bin/bash

# KAP verilerini manuel olarak çekip veritabanına yazan script.
# `fincalc-api` Docker container'i içerisinde çalışarak taze verileri senkronize eder.

echo "KAP verilerini senkronize etme işlemi başlatılıyor..."
echo "Eğer çok fazla şirketin verisi güncellenmemişse, işlem birkaç dakika sürebilir."
echo "Lütfen işlemin tamamlanmasını bekleyin..."
echo ""

docker exec -i fincalc-api python -c "
import sys
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Servis path'lerini ayarlamak icin module import'lari
from app.core.config import get_settings
from app.services.kap_fetcher import fetch_all_kap_data

# Termianle bilgi yansitmasi icin logging level'i INFO yapiyoruz
logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('app.services.kap_fetcher')
logger.setLevel(logging.INFO)

try:
    settings = get_settings()
    # Celery de kullandigi gbi senkronize veritabani baglantisini olusturalim
    sync_engine = create_engine(settings.DATABASE_URL_SYNC)
    SyncSession = sessionmaker(bind=sync_engine)

    with SyncSession() as db:
        logger.info('DB Baglantisi ve KAP veri cekimi tetikleniyor...')
        result = fetch_all_kap_data(db, fetch_details=True)
        print(f'\n[BASARILI] Islem tamamlandi. Sonuc: {result}')

except Exception as e:
    print(f'\n[HATA] Islem sirasinda bir sorun olustu: {e}')
    sys.exit(1)
"

# Eger container hata donduyse veya islem basarisiz ise uyari ver
if [ $? -ne 0 ]; then
    echo "Hata: Script beklendigi gibi tamamlanmadi. Container ayakta mi kontrol edin (docker ps)."
    exit 1
fi

echo ""
echo "==== Islem Tamamlandi ===="
