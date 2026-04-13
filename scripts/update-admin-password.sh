#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[UPDATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Admin sifre guncelleme islemi baslatiliyor..."

# .env dosyasini kontrol et
if [ ! -f ".env" ]; then
    error ".env dosyasi bulunamadi! Once .env.production dosyasini kopyala:\n  cp .env.production .env"
fi

source .env

if [ -z "$ADMIN_EMAIL" ]; then
    ADMIN_EMAIL="admin@fincalc.com"
    warn "ADMIN_EMAIL .env'de yok, varsayilan kullaniliyor: $ADMIN_EMAIL"
fi

if [ -z "$ADMIN_INIT_PASSWORD" ]; then
    error "ADMIN_INIT_PASSWORD .env dosyasinda tanimli degil!"
fi

if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
    error ".env dosyasinda POSTGRES_PASSWORD, POSTGRES_USER veya POSTGRES_DB eksik!"
fi

log "Admin bilgileri:"
log "  Email: $ADMIN_EMAIL"
log "  Yeni sifre: $ADMIN_INIT_PASSWORD"

# PostgreSQL container'inin calisip calismadigini kontrol et
if ! docker ps | grep -q fincalc-postgres; then
    error "PostgreSQL container'i calismiyor! Once container'i baslat:\n  docker-compose -f docker-compose.prod.yml up -d postgres"
fi

log "PostgreSQL container'i hazir."

# API container'inda Python kodunu calistir
log "Admin sifresi guncelleniyor..."

docker exec -i fincalc-api python3 << EOF
import asyncio
import sys
import os

# Container icindeki /app dizinini path'e ekle
sys.path.insert(0, '/app')

from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from sqlalchemy import select

async def update_admin_password():
    admin_email = "$ADMIN_EMAIL"
    new_password = "$ADMIN_INIT_PASSWORD"
    
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print(f"HATA: Admin kullanici bulunamadi: {admin_email}")
            print("Admin kullanici olusturuluyor...")
            admin = User(
                email=admin_email,
                password_hash=hash_password(new_password),
                full_name="System Admin",
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            print(f"✓ Admin kullanici olusturuldu: {admin_email}")
        else:
            admin.password_hash = hash_password(new_password)
            admin.is_active = True
            await session.commit()
            print(f"✓ Admin sifresi guncellendi: {admin_email}")
        
        print(f"✓ Yeni sifre: {new_password}")

if __name__ == "__main__":
    asyncio.run(update_admin_password())
EOF

if [ $? -eq 0 ]; then
    log "✓ Admin sifresi basariyla guncellendi!"
    log "Giris bilgileri:"
    log "  Email: $ADMIN_EMAIL"
    log "  Password: $ADMIN_INIT_PASSWORD"
else
    error "Admin sifresi guncellenemedi!"
fi
