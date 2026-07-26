#!/bin/sh
set -e

# --- 1. Veritabanının Hazır Olmasını Bekle ---
echo "[entrypoint] Veritabanı bağlantısı bekleniyor ($POSTGRES_HOST:$POSTGRES_PORT)..."

python -c "
import sqlalchemy as sa
import time
import sys
from sqlalchemy.engine import create_engine

engine = create_engine('postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}')
max_retries = 30

for i in range(max_retries):
    try:
        with engine.connect() as conn:
            conn.execute(sa.text('SELECT 1'))
            sys.exit(0)
    except Exception:
        time.sleep(2)
sys.exit(1)
" || (echo "[entrypoint] Kritik Hata: Veritabanına bağlanılamadı." && exit 1)

# --- 2. Versioned schema migration ---
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "[entrypoint] Alembic migrationlar çalıştırılıyor..."
    python -m alembic upgrade head
else
    echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS != true)."
fi

# --- 3. Servisi Başlat ---
echo "[entrypoint] Servis başlatılıyor: $@"
exec "$@"
