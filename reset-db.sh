#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[RESET]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Veritabani sifirlama islemi baslatiliyor..."

# Docker compose dosyasini kontrol et
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml dosyasi bulunamadi!"
fi

# Kullanici onayi
warn "Bu islem TUM VERILERI SILECEK!"
warn "Tum tahviller, kullanici verileri, loglar ve metrikler silinecek."
read -p "Devam etmek istiyor musunuz? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log "Islem iptal edildi."
    exit 0
fi

# Servisleri durdur
log "Servisler durduruluyor..."
docker-compose down

# PostgreSQL volume'unu sil
log "PostgreSQL volume siliniyor..."
docker volume rm fincalc_postgres_data 2>/dev/null || warn "Volume zaten silinmis veya bulunamadi"

# Servisleri yeniden baslat
log "Servisler yeniden baslatiliyor..."
docker-compose up -d postgres

# PostgreSQL'in hazir olmasini bekle
log "PostgreSQL'in hazir olmasini bekliyor..."
sleep 5

# PostgreSQL'in hazir oldugunu kontrol et
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker exec fincalc-postgres pg_isready -U fincalc > /dev/null 2>&1; then
        log "PostgreSQL hazir!"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    error "PostgreSQL hazir olmadi!"
fi

# Veritabanini tamamen sifirla
log "Veritabani tamamen sifirlaniyor..."
docker exec fincalc-postgres psql -U fincalc -d fincalc -c "
DO \$\$ 
DECLARE
    r RECORD;
BEGIN
    -- Tum foreign key constraint'leri devre disi birak
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;
"

# init.sql'i tekrar calistir
log "Veritabani schema'si yeniden olusturuluyor..."
docker exec -i fincalc-postgres psql -U fincalc -d fincalc < database/init.sql

log "Veritabani basariyla sifirlandi!"
log "Default admin kullanici:"
log "  Email: admin@fincalc.com"
log "  Password: admin123"

# Tum servisleri baslat
log "Tum servisler baslatiliyor..."
docker-compose up -d

log "Islem tamamlandi!"
