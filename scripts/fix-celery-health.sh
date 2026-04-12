#!/bin/bash
set -e

# ============================================
# FinCalc Celery Health Fix Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[FIX]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Celery servislerinin saglik durumu duzeltiliyor..."

# Check if containers exist
if ! docker ps -a --format '{{.Names}}' | grep -q fincalc-celery-worker; then
    error "Celery worker container bulunamadi!"
fi

if ! docker ps -a --format '{{.Names}}' | grep -q fincalc-celery-beat; then
    error "Celery beat container bulunamadi!"
fi

# Test healthcheck commands manually
log "\nHealthcheck komutlarini test ediliyor..."

log "Worker healthcheck testi:"
if docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect ping 2>&1 | grep -q "pong"; then
    log "  Worker healthcheck: OK"
else
    warn "  Worker healthcheck: BASARISIZ (ama worker calisiyor olabilir)"
    docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect ping 2>&1 || true
fi

log "\nBeat process kontrolu:"
if docker exec fincalc-celery-beat ps aux | grep -E '[c]elery.*beat' > /dev/null 2>&1; then
    log "  Beat process: OK"
else
    warn "  Beat process: BASARISIZ"
fi

# Restart containers to apply new healthcheck
log "\nContainer'lar yeniden baslatiliyor (yeni healthcheck'lerle)..."
docker-compose -f docker-compose.prod.yml restart celery-worker celery-beat

log "Bekleniyor (30 saniye)..."
sleep 30

# Check health status
log "\nYeni saglik durumu:"
docker ps --filter "name=celery" --format "table {{.Names}}\t{{.Status}}\t{{.Health}}" 2>/dev/null || true

log "\nLoglar kontrol ediliyor..."
log "Worker son loglar:"
docker logs --tail 10 fincalc-celery-worker 2>&1 | tail -5

log "\nBeat son loglar:"
docker logs --tail 10 fincalc-celery-beat 2>&1 | tail -5

log "\n============================================"
log "  Islem tamamlandi!"
log "============================================"
log ""
log "Not: Healthcheck'lerin saglikli olmasi birkac dakika surebilir."
log "Durumu kontrol etmek icin:"
log "  docker ps --filter 'name=celery'"
log ""
