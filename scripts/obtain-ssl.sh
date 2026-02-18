#!/bin/bash
# ============================================
# Tüm domain'ler için SSL sertifikası alır ve
# docker volume'a yazar; Nginx aynı volume'u kullandığı için
# container otomatik olarak sertifikaları kullanır.
# Debian/Ubuntu üzerinde çalıştırın.
# ============================================
set -e
export DEBIAN_FRONTEND=noninteractive

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[SSL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  err ".env yok. Önce: cp .env.production .env ve DOMAIN, CERTBOT_EMAIL doldur."
fi
source .env

if [ -z "$DOMAIN" ]; then
  err ".env içinde DOMAIN tanımlı olmalı (örn: udkdigital.design)"
fi
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@$DOMAIN}"

log "Domain: $DOMAIN"
log "E-posta: $CERTBOT_EMAIL"
log "Sertifika alınacak hostlar: $DOMAIN, www.$DOMAIN, dashboard.$DOMAIN, admin.$DOMAIN, api.$DOMAIN"

# Docker volume'ları oluştur (yoksa); compose ile aynı isimde olmalı
log "Volume'lar kontrol ediliyor..."
docker volume create certbot_webroot 2>/dev/null || true
docker volume create certbot_certs   2>/dev/null || true

# Port 80'i ACME için kullanacak geçici nginx
log "Port 80 için geçici nginx başlatılıyor (ACME challenge)..."
mkdir -p nginx/temp
cat > nginx/temp/default.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN} dashboard.${DOMAIN} admin.${DOMAIN} api.${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 "ACME Ready";
        add_header Content-Type text/plain;
    }
}
EOF

docker rm -f nginx-ssl-temp 2>/dev/null || true
docker run -d --name nginx-ssl-temp \
  -p 80:80 \
  -v "$(pwd)/nginx/temp:/etc/nginx/conf.d:ro" \
  -v certbot_webroot:/var/www/certbot:rw \
  nginx:alpine

sleep 3

log "Certbot çalıştırılıyor (tüm domain'ler tek sertifikada)..."
if docker run --rm \
  -v certbot_webroot:/var/www/certbot:rw \
  -v certbot_certs:/etc/letsencrypt:rw \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  -d "dashboard.$DOMAIN" \
  -d "admin.$DOMAIN" \
  -d "api.$DOMAIN"; then
  log "Sertifika alındı. Volume certbot_certs içinde; Nginx bu volume'u kullanıyor."
else
  docker stop nginx-ssl-temp 2>/dev/null || true
  docker rm nginx-ssl-temp 2>/dev/null || true
  err "Certbot başarısız. DNS'in tüm hostları sunucuya yönlendirdiğinden ve 80 portunun açık olduğundan emin olun."
fi

docker stop nginx-ssl-temp 2>/dev/null || true
docker rm nginx-ssl-temp 2>/dev/null || true
rm -rf nginx/temp

log "Nginx container'ı yeniden başlatılıyor (sertifikayı yüklemek için)..."
docker-compose -f docker-compose.prod.yml up -d nginx 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d nginx 2>/dev/null || true

echo ""
log "============================================="
log "  SSL tamamlandı. Sertifikalar kullanımda."
log "  Nginx certbot_certs volume'unu mount ediyor; ekstra kopyalama gerekmez."
log "============================================="
