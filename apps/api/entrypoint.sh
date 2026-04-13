#!/bin/sh
# --- Bondley Backend Entrypoint ---
set -e

# --- 1. Wait for Database ---
until curl -s "http://$POSTGRES_HOST:$POSTGRES_PORT" 2>&1 | grep -q '5432' || nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
  echo "[entrypoint] Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."
  sleep 2
done

# --- 2. Handle Migrations (Only on API service) ---
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "[entrypoint] Migration logic triggered..."
    
    # Check if 'users' table exists but 'alembic_version' does not (baseline from init.sql)
    TABLE_EXISTS=$(python -c "
import sqlalchemy as sa
from sqlalchemy.engine import create_engine
engine = create_engine('postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}')
try:
    with engine.connect() as conn:
        users_exists = conn.execute(sa.text(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')\")).scalar()
        alembic_exists = conn.execute(sa.text(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')\")).scalar()
        if users_exists and not alembic_exists:
            print('STAMP_NEEDED')
        else:
            print('NONE')
except Exception as e:
    print(f'ERROR: {e}')
    ")

    if [ "$TABLE_EXISTS" = "STAMP_NEEDED" ]; then
        echo "[entrypoint] Baseline detected from init.sql. Stamping 001_baseline..."
        python -m alembic stamp 001_baseline
    fi

    echo "[entrypoint] Running alembic upgrade head..."
    python -m alembic upgrade head
else
    echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS != true)."
fi

# --- 3. Start Service ---
echo "[entrypoint] Starting service: $@"
exec "$@"
