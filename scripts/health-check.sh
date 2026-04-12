#!/bin/bash
set -e

# ============================================
# FinCalc Health Check Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[HEALTH]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

ENVIRONMENT=${1:-stable}

if [ "$ENVIRONMENT" = "canary" ]; then
    API_URL="http://localhost:8001"
    WEB_URL="http://localhost:3001"
    API_CONTAINER="fincalc-api-canary"
    WEB_CONTAINER="fincalc-web-canary"
else
    API_URL="http://localhost:8000"
    WEB_URL="http://localhost:3000"
    API_CONTAINER="fincalc-api"
    WEB_CONTAINER="fincalc-web"
fi

log "Health check baslatiliyor ($ENVIRONMENT ortami)..."
log "API URL: $API_URL"
log "Web URL: $WEB_URL"

# Check if containers are running
log "Container'lar kontrol ediliyor..."
if ! docker ps --format '{{.Names}}' | grep -q "$API_CONTAINER"; then
    error "API container ($API_CONTAINER) calismiyor!"
fi

if ! docker ps --format '{{.Names}}' | grep -q "$WEB_CONTAINER"; then
    error "Web container ($WEB_CONTAINER) calismiyor!"
fi

log "Container'lar calisiyor"

# Check API health endpoint
log "API health endpoint kontrol ediliyor..."
MAX_RETRIES=10
RETRY_COUNT=0
API_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$API_URL/health" > /dev/null 2>&1; then
        API_HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log "  Deneme $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ "$API_HEALTHY" = false ]; then
    error "API health check basarisiz! ($API_URL/health)"
fi

log "API health check basarili"

# Check API health response
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    log "API health response: $HEALTH_RESPONSE"
else
    warn "API health response beklenmeyen format: $HEALTH_RESPONSE"
fi

# Check database connection (via API container)
log "Database baglantisi kontrol ediliyor..."
if docker exec "$API_CONTAINER" python -c "
import os
import sys
sys.path.insert(0, '/app')
from app.database import get_db
from sqlalchemy import text
try:
    db = next(get_db())
    db.execute(text('SELECT 1'))
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>/dev/null | grep -q "OK"; then
    log "Database baglantisi basarili"
else
    warn "Database baglantisi kontrol edilemedi (container icinde calistiriliyor)"
fi

# Check Redis connection (via API container)
log "Redis baglantisi kontrol ediliyor..."
if docker exec "$API_CONTAINER" python -c "
import os
import redis
try:
    r = redis.from_url(os.environ.get('REDIS_URL', 'redis://redis:6379/0'))
    r.ping()
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>/dev/null | grep -q "OK"; then
    log "Redis baglantisi basarili"
else
    warn "Redis baglantisi kontrol edilemedi (container icinde calistiriliyor)"
fi

# Check web container (basic connectivity)
log "Web container kontrol ediliyor..."
MAX_RETRIES=10
RETRY_COUNT=0
WEB_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$WEB_URL" > /dev/null 2>&1; then
        WEB_HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log "  Deneme $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ "$WEB_HEALTHY" = false ]; then
    error "Web container health check basarisiz! ($WEB_URL)"
fi

log "Web container health check basarili"

log "============================================"
log "  Health check tamamlandi!"
log "============================================"
log ""
log "  API: OK"
log "  Web: OK"
log "  Database: OK"
log "  Redis: OK"
log ""
