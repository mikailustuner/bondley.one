#!/bin/bash
set -e

# ============================================
# FinCalc Rollback Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ROLLBACK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

source .env

log "Canary deployment rollback yapiliyor..."

# Step 1: Stop canary containers
log "Canary container'lar durduruluyor..."
docker-compose -f docker-compose.canary.yml down || true

# Step 2: Remove canary nginx configuration
log "Canary nginx yapilandirmasi kaldiriliyor..."
docker exec fincalc-nginx rm -f /etc/nginx/conf.d/canary.conf || true

# Step 3: Reload nginx to route 100% traffic to stable
log "Nginx reload ediliyor (100% stable)..."
if docker exec fincalc-nginx nginx -t; then
    docker exec fincalc-nginx nginx -s reload
    log "Nginx reload edildi - Tum trafik stable'e yonlendiriliyor"
else
    warn "Nginx yapilandirmasi kontrol edilemedi, manuel reload gerekebilir"
fi

# Step 4: Verify stable containers are running
log "Stable container'lar kontrol ediliyor..."
STABLE_SERVICES=("fincalc-api" "fincalc-web")
ALL_RUNNING=true
for svc in "${STABLE_SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        log "  $svc: RUNNING"
    else
        warn "  $svc: NOT RUNNING"
        ALL_RUNNING=false
    fi
done

if [ "$ALL_RUNNING" = false ]; then
    warn "Bazi stable container'lar calismiyor, yeniden baslatiliyor..."
    docker-compose -f docker-compose.prod.yml up -d web api || true
fi

log "============================================"
log "  Rollback tamamlandi!"
log "============================================"
log ""
log "  Canary container'lar kaldirildi"
log "  Tum trafik stable'e yonlendiriliyor"
log ""
warn "  Hata durumunda manuel kontrol yapin!"
log ""
