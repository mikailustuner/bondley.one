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

# --- 2. Tablo Senkronizasyonu (init.sql Bekleme) ---
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "[entrypoint] Tabloların (init.sql) oluşturulması bekleniyor..."
    
    python -c "
import sqlalchemy as sa
import time
import sys
from sqlalchemy.engine import create_engine

engine = create_engine('postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}')
max_retries = 45

for i in range(max_retries):
    try:
        with engine.connect() as conn:
            users_exist = conn.execute(sa.text(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')\")).scalar()
            alembic_exists = conn.execute(sa.text(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')\")).scalar()
            
            if users_exist:
                if not alembic_exists:
                    print('STAMP_NEEDED')
                else:
                    print('READY')
                sys.exit(0)
            # Log message to stdout so user knows it's working
            sys.stderr.write(f'Waiting for users table... (Attempt {i+1})\n')
    except Exception:
        pass
    time.sleep(2)
sys.exit(1)
" > /tmp/db_state || (echo "[entrypoint] Hata: init.sql tablolari olusturamadi." && exit 1)

    DB_STATE=$(cat /tmp/db_state | grep -E "STAMP_NEEDED|READY" | tail -n 1)

    if [ "$DB_STATE" = "STAMP_NEEDED" ]; then
        echo "[entrypoint] Baseline detected. Stamping 001_baseline..."
        python -m alembic stamp 001_baseline
    fi

    echo "[entrypoint] Alembic migrationlar çalıştırılıyor..."
    python -m alembic upgrade head
else
    echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS != true)."
fi

# --- 3. Servisi Başlat ---
echo "[entrypoint] Servis başlatılıyor: $@"
exec "$@"
