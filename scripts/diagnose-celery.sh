#!/bin/bash
set -e

# ============================================
# FinCalc Celery Diagnostic Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

section "Celery Container Durumu"

# Check if containers are running
log "Container durumu kontrol ediliyor..."
WORKER_STATUS=$(docker ps --filter "name=fincalc-celery-worker" --format "{{.Status}}" 2>/dev/null || echo "NOT FOUND")
BEAT_STATUS=$(docker ps --filter "name=fincalc-celery-beat" --format "{{.Status}}" 2>/dev/null || echo "NOT FOUND")

if [ "$WORKER_STATUS" != "NOT FOUND" ] && [ -n "$WORKER_STATUS" ]; then
    log "Celery Worker: $WORKER_STATUS"
else
    error "Celery Worker: Container calismiyor!"
fi

if [ "$BEAT_STATUS" != "NOT FOUND" ] && [ -n "$BEAT_STATUS" ]; then
    log "Celery Beat: $BEAT_STATUS"
else
    error "Celery Beat: Container calismiyor!"
fi

# Check container health
log "\nContainer health durumu:"
docker ps --filter "name=celery" --format "table {{.Names}}\t{{.Status}}\t{{.Health}}" 2>/dev/null || true

section "Son Loglar (Son 50 satir)"

if docker ps --filter "name=fincalc-celery-worker" --format "{{.Names}}" | grep -q worker; then
    log "Celery Worker Logs:"
    echo "----------------------------------------"
    docker logs --tail 50 fincalc-celery-worker 2>&1 | tail -50
    echo "----------------------------------------"
else
    warn "Celery Worker container bulunamadi"
fi

if docker ps --filter "name=fincalc-celery-beat" --format "{{.Names}}" | grep -q beat; then
    log "\nCelery Beat Logs:"
    echo "----------------------------------------"
    docker logs --tail 50 fincalc-celery-beat 2>&1 | tail -50
    echo "----------------------------------------"
else
    warn "Celery Beat container bulunamadi"
fi

section "Hata Loglari"

log "Worker hata loglari:"
docker logs fincalc-celery-worker 2>&1 | grep -i "error\|exception\|traceback\|failed" | tail -20 || warn "Hata logu bulunamadi"

log "\nBeat hata loglari:"
docker logs fincalc-celery-beat 2>&1 | grep -i "error\|exception\|traceback\|failed" | tail -20 || warn "Hata logu bulunamadi"

section "Baglanti Kontrolleri"

# Check Redis connection
log "Redis baglantisi kontrol ediliyor..."
if docker exec fincalc-celery-worker python -c "
import os
import sys
import redis
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    r = redis.from_url(redis_url)
    r.ping()
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>/dev/null | grep -q "OK"; then
    log "Redis baglantisi: OK"
else
    error "Redis baglantisi: BASARISIZ"
    docker exec fincalc-celery-worker python -c "
import os
import redis
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    r = redis.from_url(redis_url)
    r.ping()
except Exception as e:
    print(f'Redis Error: {e}')
" 2>&1 || true
fi

# Check PostgreSQL connection (using psycopg2 directly for Celery)
log "\nPostgreSQL baglantisi kontrol ediliyor..."
if docker exec fincalc-celery-worker python -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=os.environ.get('POSTGRES_PORT', '5432'),
        database=os.environ.get('POSTGRES_DB', 'fincalc'),
        user=os.environ.get('POSTGRES_USER', 'fincalc'),
        password=os.environ.get('POSTGRES_PASSWORD', '')
    )
    conn.close()
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    exit(1)
" 2>/dev/null | grep -q "OK"; then
    log "PostgreSQL baglantisi: OK"
else
    error "PostgreSQL baglantisi: BASARISIZ"
    docker exec fincalc-celery-worker python -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=os.environ.get('POSTGRES_PORT', '5432'),
        database=os.environ.get('POSTGRES_DB', 'fincalc'),
        user=os.environ.get('POSTGRES_USER', 'fincalc'),
        password=os.environ.get('POSTGRES_PASSWORD', '')
    )
    conn.close()
except Exception as e:
    print(f'PostgreSQL Error: {e}')
" 2>&1 || true
fi

section "Celery App Import Kontrolu"

log "Celery app import kontrolu:"
docker exec fincalc-celery-worker python -c "
import sys
sys.path.insert(0, '/app')
try:
    from app.tasks.celery_app import celery_app
    print('Celery app import: OK')
    print(f'Broker: {celery_app.conf.broker_url}')
    print(f'Backend: {celery_app.conf.result_backend}')
except Exception as e:
    print(f'Celery app import ERROR: {e}')
    import traceback
    traceback.print_exc()
" 2>&1 || true

section "Celery Worker Status"

log "Celery worker inspect:"
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect active 2>&1 || warn "Worker inspect basarisiz"

log "\nCelery worker stats:"
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect stats 2>&1 || warn "Worker stats basarisiz"

section "Celery Beat Schedule Kontrolu"

log "Celery beat schedule:"
docker exec fincalc-celery-beat celery -A app.tasks.celery_app inspect scheduled 2>&1 || warn "Beat schedule kontrolu basarisiz"

log "\nBeat schedule dosyasi kontrolu:"
if docker exec fincalc-celery-beat ls -la /tmp/celerybeat* 2>&1 | grep -q celerybeat; then
    docker exec fincalc-celery-beat ls -la /tmp/celerybeat* 2>&1
else
    warn "Schedule dosyasi henuz olusturulmamis (normal olabilir, beat yeni basladiysa)"
fi

section "Environment Variables"

log "Worker environment variables:"
docker exec fincalc-celery-worker env | grep -E "POSTGRES|REDIS|CELERY|ENVIRONMENT" | sort || true

log "\nBeat environment variables:"
docker exec fincalc-celery-beat env | grep -E "POSTGRES|REDIS|CELERY|ENVIRONMENT" | sort || true

section "Process Durumu"

log "Worker process durumu:"
docker exec fincalc-celery-worker ps aux | grep -E "celery|python" || true

log "\nBeat process durumu:"
docker exec fincalc-celery-beat ps aux | grep -E "celery|python" || true

section "Oneriler"

log "Sorun giderme adimlari:"
echo "1. Loglari kontrol edin (yukarida)"
echo "2. Redis ve PostgreSQL baglantilarini kontrol edin"
echo "3. Container'lari yeniden baslatin:"
echo "   docker compose -f docker-compose.prod.yml restart celery-worker celery-beat"
echo "4. Container'lari yeniden build edin:"
echo "   docker compose -f docker-compose.prod.yml build celery-worker celery-beat"
echo "   docker compose -f docker-compose.prod.yml up -d celery-worker celery-beat"
echo "5. Eger sorun devam ederse, container'lari tamamen kaldirip yeniden baslatin:"
echo "   docker compose -f docker-compose.prod.yml down celery-worker celery-beat"
echo "   docker compose -f docker-compose.prod.yml up -d celery-worker celery-beat"
