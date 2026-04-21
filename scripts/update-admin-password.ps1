# Admin Password Update Script
# Bu script veritabanındaki admin kullanıcısının şifresini .env dosyasındaki ADMIN_INIT_PASSWORD ile günceller

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[UPDATE] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

Write-Log "Admin sifre guncelleme islemi baslatiliyor..."

# .env dosyasini kontrol et
if (-not (Test-Path ".env")) {
    Write-Error ".env dosyasi bulunamadi! Once .env.production dosyasini kopyala:`n  cp .env.production .env"
}

# .env dosyasini yukle
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Variable -Name $name -Value $value -Scope Script
    }
}

if (-not $ADMIN_INIT_PASSWORD) {
    Write-Error "ADMIN_INIT_PASSWORD .env dosyasinda tanimli degil!"
}

if (-not $ADMIN_EMAIL) {
    $ADMIN_EMAIL = "admin@fincalc.com"
    Write-Warn "ADMIN_EMAIL .env'de yok, varsayilan kullaniliyor: $ADMIN_EMAIL"
}

if (-not $POSTGRES_PASSWORD -or -not $POSTGRES_USER -or -not $POSTGRES_DB) {
    Write-Error ".env dosyasinda POSTGRES_PASSWORD, POSTGRES_USER veya POSTGRES_DB eksik!"
}

Write-Log "Admin bilgileri:"
Write-Log "  Email: $ADMIN_EMAIL"
Write-Log "  Yeni sifre: $ADMIN_INIT_PASSWORD"

# PostgreSQL container'inin calisip calismadigini kontrol et
$postgresRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "fincalc-postgres"
if (-not $postgresRunning) {
    Write-Error "PostgreSQL container'i calismiyor! Once container'i baslat:`n  docker compose -f docker-compose.prod.yml up -d postgres"
}

Write-Log "PostgreSQL container'i hazir."

# Python script'i calistir
Write-Log "Admin sifresi guncelleniyor..."

$pythonScript = @"
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path('apps/api')))

from app.core.database import async_session_factory
from app.core.security import hash_password
from app.core.config import get_settings
from app.models.user import User
from sqlalchemy import select

async def update_admin_password():
    settings = get_settings()
    admin_email = '$ADMIN_EMAIL'
    new_password = '$ADMIN_INIT_PASSWORD'
    
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print(f'Admin kullanici bulunamadi: {admin_email}')
            print('Admin kullanici olusturuluyor...')
            admin = User(
                email=admin_email,
                password_hash=hash_password(new_password),
                full_name='System Admin',
                role='admin',
            )
            session.add(admin)
            await session.commit()
            print(f'✓ Admin kullanici olusturuldu: {admin_email}')
        else:
            print(f'Mevcut admin kullanici bulundu: {admin_email}')
            admin.password_hash = hash_password(new_password)
            await session.commit()
            print(f'✓ Admin sifresi guncellendi: {admin_email}')
        
        print(f'✓ Guncelleme tamamlandi!')
        print(f'Giris bilgileri:')
        print(f'  Email: {admin_email}')
        print(f'  Password: {new_password}')

asyncio.run(update_admin_password())
"@

# Python script'i calistir
$pythonScript | python3

if ($LASTEXITCODE -eq 0) {
    Write-Log "✓ Admin sifresi basariyla guncellendi!"
} else {
    Write-Error "Admin sifresi guncellenemedi!"
}
