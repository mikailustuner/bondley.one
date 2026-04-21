#!/bin/bash
set -e

# ============================================
# Bondley Production Deployment Script
# Shared Server Mode (Behind Host Proxy)
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BONDLEY-DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- Pre-flight checks ---
if [ ! -f .env ]; then
    error ".env file not found. Please copy .env.example to .env and configure it."
fi

source .env

log "Starting deployment for domain: $DOMAIN"

# --- Step 1: Build & Deploy ---
log "Building containers (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml build

log "Starting Bondley services..."
docker compose -f docker-compose.prod.yml up -d

# --- Step 2: Health check ---
log "Verifying service status..."
sleep 10

SERVICES=("fincalc-postgres" "fincalc-redis" "fincalc-api" "fincalc-web" "fincalc-nginx")
for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        log "  $svc: [UP]"
    else
        warn "  $svc: [DOWN] - Check 'docker logs $svc'"
    fi
done
eline Senkronizasyon
# --- Step 3: Database Migrations ---
log "Running database migrations (Alembic)..."
if docker ps --format '{{.Names}}' | grep -q "fincalc-api"; then
    docker exec -i fincalc-api alembic upgrade head
    log "Database migrations applied successfully."
else
    error "fincalc-api is not running. Cannot apply migrations."
fi

# --- Step 4: Final Summary ---
echo ""
log "============================================"
log "  Bondley Deployment Complete!"
log "============================================"
log ""
log "  Local Gateway: http://localhost:3050"
log "  Public URL:    https://$DOMAIN"
log ""
log "  NEXT STEPS:"
log "  1. Ensure Host Apache2 is configured to proxy requests to port 3050."
log "  2. Restart Apache: sudo systemctl restart apache2"
log ""
