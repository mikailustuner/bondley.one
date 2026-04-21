#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[CREATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Admin kullanici olusturma islemi baslatiliyor..."

# .env dosyasini kontrol et
if [ ! -f ".env" ]; then
    error ".env dosyasi bulunamadi! Once .env.production dosyasini kopyala:\n  cp .env.production .env"
fi

source .env

# PostgreSQL container'inin calisip calismadigini kontrol et
if ! docker ps | grep -q fincalc-postgres; then
    error "PostgreSQL container'i calismiyor! Once container'i baslat:\n  docker compose -f docker-compose.prod.yml up -d postgres"
fi

# API container'inin calisip calismadigini kontrol et
if ! docker ps | grep -q fincalc-api; then
    warn "API container'i calismiyor. Baslatiliyor..."
    docker compose -f docker-compose.prod.yml up -d api
    sleep 5
fi

log "Container'lar hazir."

# Script'i API container'ina kopyala
log "Script API container'ina kopyalaniyor..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
docker cp "$SCRIPT_DIR/create-admin.py" fincalc-api:/app/create-admin.py 2>/dev/null || {
    warn "Script kopyalanamadi, direkt container icinde calistiriliyor..."
}

# Script'i calistir
log "Admin kullanici olusturuluyor..."
docker exec fincalc-api python3 /app/create-admin.py || {
    # Eger /app/create-admin.py yoksa, direkt Python kodu calistir
    warn "Script bulunamadi, direkt Python kodu calistiriliyor..."
    docker exec fincalc-api python3 << 'PYTHON_SCRIPT'
import asyncio
import sys
sys.path.insert(0, '/app')
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.core.config import get_settings
from app.models.user import User
from sqlalchemy import select

async def create_admin():
    settings = get_settings()
    admin_email = settings.ADMIN_EMAIL
    admin_password = settings.ADMIN_INIT_PASSWORD.strip() if settings.ADMIN_INIT_PASSWORD else "admin123"
    
    print("=" * 50)
    print("Admin Kullanıcı Oluşturma")
    print("=" * 50)
    print(f"Email: {admin_email}")
    print(f"Şifre: {admin_password}")
    print("=" * 50)
    
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if admin:
            print(f"\n⚠️  Admin kullanıcı zaten mevcut: {admin_email}")
            print("Şifre güncelleniyor...")
            admin.password_hash = hash_password(admin_password)
            admin.role = "admin"
            admin.is_active = True
            await session.commit()
            print(f"✓ Admin şifresi güncellendi!")
        else:
            print(f"\n✓ Yeni admin kullanıcı oluşturuluyor...")
            admin = User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name="System Admin",
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            await session.refresh(admin)
            print(f"✓ Admin kullanıcı oluşturuldu!")
        
        print("\n" + "=" * 50)
        print("GİRİŞ BİLGİLERİ")
        print("=" * 50)
        print(f"Email:    {admin_email}")
        print(f"Şifre:    {admin_password}")
        print("=" * 50)
        print("\n✓ İşlem tamamlandı!")

asyncio.run(create_admin())
PYTHON_SCRIPT
}

log "✓ Islem tamamlandi!"
