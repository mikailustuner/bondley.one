#!/bin/bash
set -e

# ============================================
# FinCalc Promote Canary to Stable
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[PROMOTE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

source .env

log "Canary'i stable'e promote ediliyor..."

# Step 1: Stop stable containers
log "Stable container'lar durduruluyor..."
docker compose -f docker-compose.prod.yml stop web api || true

# Step 2: Rebuild stable containers with latest code
log "Stable container'lar guncelleniyor..."
docker compose -f docker-compose.prod.yml build --no-cache web api

# Step 3: Start stable containers
log "Stable container'lar baslatiliyor..."
docker compose -f docker-compose.prod.yml up -d web api

# Step 4: Wait for stable containers to be healthy
log "Stable container'larin saglikli olmasini bekliyoruz..."
sleep 15

# Step 5: Verify stable containers are running
STABLE_SERVICES=("fincalc-api" "fincalc-web")
for svc in "${STABLE_SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        log "  $svc: RUNNING"
    else
        error "  $svc: NOT RUNNING - Promotion basarisiz!"
    fi
done

# Step 6: Update nginx to route 100% traffic to stable
log "Nginx yapilandirmasi guncelleniyor (100% stable)..."
if [ -f "nginx/conf.d/default.conf.template" ]; then
    # Remove canary config
    docker exec fincalc-nginx rm -f /etc/nginx/conf.d/canary.conf || true
    
    # Test nginx configuration
    if docker exec fincalc-nginx nginx -t; then
        log "Nginx yapilandirmasi gecerli"
        # Reload nginx
        docker exec fincalc-nginx nginx -s reload
        log "Nginx reload edildi - %100 trafik stable'e yonlendiriliyor"
    else
        error "Nginx yapilandirmasi hatasi!"
    fi
fi

# Step 7: Stop and remove canary containers
log "Canary container'lar kaldiriliyor..."
docker compose -f docker-compose.canary.yml down || true

log "============================================"
log "  Promotion tamamlandi!"
log "============================================"
log ""
log "  Stable API: http://api:8000"
log "  Stable Web: http://web:3000"
log ""
log "  Tum trafik stable'e yonlendiriliyor"
log ""
