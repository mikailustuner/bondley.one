#!/bin/bash
set -e

# ============================================
# FinCalc Canary Deployment Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[CANARY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if .env exists
if [ ! -f .env ]; then
    error ".env dosyasi bulunamadi. Once .env.production dosyasini kopyala:\n  cp .env.production .env"
fi

source .env

if [ -z "$DOMAIN" ]; then
    error "DOMAIN degiskeni .env dosyasinda guncellenmemis!"
fi

log "Canary deployment baslatiliyor..."
log "Domain: $DOMAIN"

# Step 1: Build canary containers
log "Canary container'lar build ediliyor..."
docker-compose -f docker-compose.canary.yml build --no-cache

# Step 2: Start canary containers
log "Canary container'lar baslatiliyor..."
docker-compose -f docker-compose.canary.yml up -d

# Step 3: Wait for containers to be healthy
log "Container'larin saglikli olmasini bekliyoruz..."
sleep 15

# Step 4: Check if canary containers are running
CANARY_SERVICES=("fincalc-api-canary" "fincalc-web-canary")
for svc in "${CANARY_SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        log "  $svc: RUNNING"
    else
        error "  $svc: NOT RUNNING - Canary deployment basarisiz!"
    fi
done

# Step 5: Update nginx configuration for canary routing
log "Nginx yapilandirmasi guncelleniyor (canary routing)..."
if [ -f "nginx/conf.d/canary.conf.template" ]; then
    # Generate canary config from template using envsubst or sed
    if command -v envsubst > /dev/null 2>&1; then
        envsubst '${DOMAIN}' < nginx/conf.d/canary.conf.template > nginx/conf.d/canary.conf
    else
        # Fallback to sed if envsubst is not available
        sed "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/canary.conf.template > nginx/conf.d/canary.conf
    fi
    
    # Copy to nginx container
    docker cp nginx/conf.d/canary.conf fincalc-nginx:/etc/nginx/conf.d/canary.conf
    
    # Test nginx configuration
    if docker exec fincalc-nginx nginx -t; then
        log "Nginx yapilandirmasi gecerli"
        # Reload nginx
        docker exec fincalc-nginx nginx -s reload
        log "Nginx reload edildi - %10 trafik canary'e yonlendiriliyor"
    else
        warn "Nginx yapilandirmasi gecersiz, rollback yapiliyor..."
        docker exec fincalc-nginx nginx -s reload || true
        error "Nginx yapilandirmasi hatasi!"
    fi
else
    warn "Canary nginx config bulunamadi, trafik yonlendirmesi yapilmiyor"
fi

log "============================================"
log "  Canary deployment tamamlandi!"
log "============================================"
log ""
log "  Canary API: http://api-canary:8000"
log "  Canary Web: http://web-canary:3000"
log ""
log "  Monitoring baslatiliyor..."
log "  %10 trafik canary'e yonlendiriliyor"
log ""
