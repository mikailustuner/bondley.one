#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[UPDATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "PostgreSQL sifre guncelleme islemi baslatiliyor..."

# .env dosyasini kontrol et
if [ ! -f ".env" ]; then
    error ".env dosyasi bulunamadi! Once .env.production dosyasini kopyala:\n  cp .env.production .env"
fi

# .env dosyasini yukle
source .env

if [ -z "$POSTGRES_PASSWORD" ]; then
    error "POSTGRES_PASSWORD .env dosyasinda tanimli degil!"
fi

if [ -z "$POSTGRES_USER" ]; then
    error "POSTGRES_USER .env dosyasinda tanimli degil!"
fi

# PostgreSQL container'inin calisip calismadigini kontrol et
if ! docker ps | grep -q fincalc-postgres; then
    error "PostgreSQL container'i calismiyor! Once container'i baslat:\n  docker-compose -f docker-compose.prod.yml up -d postgres"
fi

log "PostgreSQL container'i bulundu."
log "Kullanici: $POSTGRES_USER"
log "Yeni sifre guncelleniyor..."

# PostgreSQL sifresini guncelle
# Not: PostgreSQL'de sifre degistirmek icin ALTER USER kullanilir
docker exec fincalc-postgres psql -U postgres -d postgres -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || {
    # Eger postgres superuser ile baglanamazsa, mevcut kullanici ile dene
    warn "Superuser ile baglanamadi, mevcut kullanici ile deneniyor..."
    docker exec fincalc-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || {
        error "Sifre guncellenemedi! PostgreSQL container loglarini kontrol edin:\n  docker logs fincalc-postgres"
    }
}

log "PostgreSQL sifresi basariyla guncellendi!"
log "API container'ini yeniden baslatmaniz gerekebilir:\n  docker-compose -f docker-compose.prod.yml restart api"
