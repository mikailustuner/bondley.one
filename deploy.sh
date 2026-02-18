#!/bin/bash
set -e

# ============================================
# FinCalc Production Deployment Script
# Google Cloud Compute Engine
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- Pre-flight checks ---
if [ ! -f .env ]; then
    error ".env dosyasi bulunamadi. Once .env.production dosyasini kopyala:\n  cp .env.production .env\n  ve icindeki degerleri guncelle."
fi

source .env

if [ -z "$DOMAIN" ]; then
    error "DOMAIN degiskeni .env dosyasinda guncellenmemis!"
fi

if [ "$POSTGRES_PASSWORD" = "BURAYA_GUCLU_SIFRE_YAZ_32_KARAKTER" ]; then
    error "POSTGRES_PASSWORD .env dosyasinda guncellenmemis!"
fi

if [ "$JWT_SECRET_KEY" = "BURAYA_64_KARAKTER_RANDOM_STRING_YAZ" ]; then
    error "JWT_SECRET_KEY .env dosyasinda guncellenmemis!"
fi

log "Domain: $DOMAIN"
log "Pre-flight checks passed."

# --- DNS Check ---
log "DNS kayitlari kontrol ediliyor..."
DNS_CHECK_FAILED=0
for subdomain in "" "www" "dashboard" "admin" "api"; do
    if [ -z "$subdomain" ]; then
        check_domain="$DOMAIN"
    else
        check_domain="${subdomain}.${DOMAIN}"
    fi
    
    if ! dig +short "$check_domain" | grep -q "^[0-9]"; then
        warn "  $check_domain -> DNS kaydi bulunamadi!"
        DNS_CHECK_FAILED=1
    else
        log "  $check_domain -> OK"
    fi
done

if [ $DNS_CHECK_FAILED -eq 1 ]; then
    warn "DNS kayitlari henuz propagate olmamis olabilir."
    warn "Devam etmek istiyor musunuz? (y/n)"
    read -r response
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        error "DNS kayitlarini kontrol edip tekrar deneyin."
    fi
fi

# --- Step 1: SSL Certificate (first time only) ---
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "SSL sertifikasi aliniyor (Let's Encrypt)..."
    
    # Create temporary nginx config for ACME challenge only
    mkdir -p nginx/temp
    cat > nginx/temp/default.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN} dashboard.${DOMAIN} admin.${DOMAIN} api.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 "ACME Challenge Ready";
        add_header Content-Type text/plain;
    }
}
EOF

    # Start nginx with temp config for ACME challenge
    docker run -d --name nginx-temp \
        -p 80:80 \
        -v "$(pwd)/nginx/temp:/etc/nginx/conf.d:ro" \
        -v certbot_webroot:/var/www/certbot:rw \
        nginx:alpine || docker start nginx-temp
    
    sleep 3
    
    log "Certbot calistiriliyor..."
    if docker run --rm \
        -v certbot_webroot:/var/www/certbot:rw \
        -v certbot_certs:/etc/letsencrypt:rw \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "${CERTBOT_EMAIL}" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "dashboard.$DOMAIN" \
        -d "admin.$DOMAIN" \
        -d "api.$DOMAIN"; then
        log "SSL sertifikasi basariyla alindi!"
    else
        warn "SSL sertifikasi alinamadi. Devam ediliyor (HTTP ile calisacak)..."
        warn "Manuel olarak tekrar denemek icin:"
        warn "  docker-compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN"
    fi
    
    # Cleanup temp nginx
    docker stop nginx-temp 2>/dev/null || true
    docker rm nginx-temp 2>/dev/null || true
    rm -rf nginx/temp
    
else
    log "SSL sertifikasi zaten mevcut, atlaniyor."
fi

# --- Step 2: Build & Deploy ---
log "Container'lar build ediliyor..."
docker-compose -f docker-compose.prod.yml build --no-cache

log "Container'lar baslatiliyor..."
docker-compose -f docker-compose.prod.yml up -d

# --- Step 3: Health check ---
log "Servisler kontrol ediliyor..."
sleep 10

SERVICES=("fincalc-postgres" "fincalc-redis" "fincalc-api" "fincalc-web" "fincalc-nginx")
for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        log "  $svc: RUNNING"
    else
        warn "  $svc: NOT RUNNING"
    fi
done

echo ""
log "============================================"
log "  Deployment tamamlandi!"
log "============================================"
log ""
log "  Landing:   https://$DOMAIN"
log "  Dashboard: https://dashboard.$DOMAIN"
log "  Admin:     https://admin.$DOMAIN"
log "  API:       https://api.$DOMAIN/api/docs"
log ""
log "  Admin giris: admin@fincalc.com / admin123"
log "  (ONEMLI: Ilk giriste admin sifresini degistirin!)"
log ""
