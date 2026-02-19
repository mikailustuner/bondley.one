#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[FIX]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "PostgreSQL sifre sorunu cozuluyor..."

# .env dosyasini kontrol et
if [ ! -f ".env" ]; then
    error ".env dosyasi bulunamadi! Once .env.production dosyasini kopyala:\n  cp .env.production .env"
fi

source .env

if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
    error ".env dosyasinda POSTGRES_PASSWORD, POSTGRES_USER veya POSTGRES_DB eksik!"
fi

log "Mevcut .env degerleri:"
log "  POSTGRES_USER: $POSTGRES_USER"
log "  POSTGRES_DB: $POSTGRES_DB"
log "  POSTGRES_PASSWORD: [GIZLI]"

# PostgreSQL container'inin calisip calismadigini kontrol et
if ! docker ps | grep -q fincalc-postgres; then
    warn "PostgreSQL container'i calismiyor. Baslatiliyor..."
    docker-compose -f docker-compose.prod.yml up -d postgres
    sleep 5
fi

log "PostgreSQL container'i hazir."

# Yontem 1: postgres superuser ile sifreyi guncelle (en guvenli)
# PostgreSQL container'inda postgres superuser genellikle POSTGRES_PASSWORD ile ayni sifreyi kullanir
log "Yontem 1: postgres superuser ile sifre guncelleniyor..."

# Once POSTGRES_PASSWORD ile postgres superuser'a baglanmayi dene
if docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" fincalc-postgres psql -U postgres -d postgres -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null; then
    log "✓ Sifre basariyla guncellendi (superuser ile)!"
    log "API container'ini yeniden baslatiliyor..."
    docker-compose -f docker-compose.prod.yml restart api
    log "✓ Islem tamamlandi!"
    exit 0
fi

# Eger POSTGRES_PASSWORD ile baglanamazsa, sifresiz dene (varsayilan davranis)
if docker exec fincalc-postgres psql -U postgres -d postgres -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null; then
    log "✓ Sifre basariyla guncellendi (superuser ile, sifresiz)!"
    log "API container'ini yeniden baslatiliyor..."
    docker-compose -f docker-compose.prod.yml restart api
    log "✓ Islem tamamlandi!"
    exit 0
fi

# Yontem 2: Container'i yeniden olustur (veri korunur, sadece sifre guncellenir)
warn "Superuser ile guncelleme basarisiz. Container yeniden olusturuluyor..."
warn "NOT: Bu islem verileri korur, sadece sifreyi gunceller."

# Container'i durdur
docker-compose -f docker-compose.prod.yml stop postgres

# Container'i sil (volume korunur)
docker-compose -f docker-compose.prod.yml rm -f postgres

# Container'i yeniden baslat (.env'deki yeni sifreyle)
docker-compose -f docker-compose.prod.yml up -d postgres

# PostgreSQL'in hazir olmasini bekle
log "PostgreSQL'in hazir olmasini bekliyor..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker exec fincalc-postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
        log "✓ PostgreSQL hazir!"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    error "PostgreSQL hazir olmadi!"
fi

# Sifreyi dogrula - Yeni sifre ile baglanmayi dene
log "Sifre dogrulanıyor..."
if docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" fincalc-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    log "✓ Sifre dogrulandi!"
else
    warn "Sifre dogrulanamadi. PostgreSQL container'indaki sifre hala eski olabilir."
    warn "Volume'u silip yeniden baslatmak gerekebilir."
    warn "Bu islem TUM VERILERI SILER! Devam etmek istiyor musunuz? (yes/no)"
    read -p "> " confirm
    if [ "$confirm" = "yes" ]; then
        log "Volume siliniyor ve veritabani yeniden olusturuluyor..."
        docker-compose -f docker-compose.prod.yml stop postgres
        docker-compose -f docker-compose.prod.yml rm -f postgres
        docker volume rm fincalc_postgres_data 2>/dev/null || true
        docker-compose -f docker-compose.prod.yml up -d postgres
        sleep 5
        log "✓ Veritabani yeniden olusturuldu!"
    else
        log "Islem iptal edildi."
        exit 0
    fi
fi

# API container'ini yeniden baslat
log "API container'ini yeniden baslatiliyor..."
docker-compose -f docker-compose.prod.yml restart api

log "✓ Islem tamamlandi!"
