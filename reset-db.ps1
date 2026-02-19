# FinCalc Database Reset Script
# Bu script tum veritabani verilerini siler ve yeniden kurar

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[RESET] $Message" -ForegroundColor Green
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

Write-Log "Veritabani sifirlama islemi baslatiliyor..."

# Docker compose dosyasini kontrol et
if (-not (Test-Path "docker-compose.yml")) {
    Write-Error "docker-compose.yml dosyasi bulunamadi!"
}

# Kullanici onayi
Write-Warn "Bu islem TUM VERILERI SILECEK!"
Write-Warn "Tum tahviller, kullanici verileri, loglar ve metrikler silinecek."
$confirm = Read-Host "Devam etmek istiyor musunuz? (yes/no)"

if ($confirm -ne "yes") {
    Write-Log "Islem iptal edildi."
    exit 0
}

# Servisleri durdur
Write-Log "Servisler durduruluyor..."
docker-compose down

# PostgreSQL volume'unu sil
Write-Log "PostgreSQL volume siliniyor..."
$volumeName = "fincalc_postgres_data"
$volumes = docker volume ls -q
if ($volumes -contains $volumeName) {
    docker volume rm $volumeName
    Write-Log "Volume silindi."
} else {
    Write-Warn "Volume zaten silinmis veya bulunamadi"
}

# Servisleri yeniden baslat
Write-Log "Servisler yeniden baslatiliyor..."
docker-compose up -d postgres

# PostgreSQL'in hazir olmasini bekle
Write-Log "PostgreSQL'in hazir olmasini bekliyor..."
Start-Sleep -Seconds 5

# PostgreSQL'in hazir oldugunu kontrol et
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts) {
    $result = docker exec fincalc-postgres pg_isready -U fincalc 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Log "PostgreSQL hazir!"
        $ready = $true
        break
    }
    $attempt++
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Error "PostgreSQL hazir olmadi!"
}

# Veritabanini tamamen sifirla
Write-Log "Veritabani tamamen sifirlaniyor..."
$dropScript = @"
DO `$\$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END `$\$;
"@

docker exec -i fincalc-postgres psql -U fincalc -d fincalc -c $dropScript

# init.sql'i tekrar calistir
Write-Log "Veritabani schema'si yeniden olusturuluyor..."
Get-Content database/init.sql | docker exec -i fincalc-postgres psql -U fincalc -d fincalc

Write-Log "Veritabani basariyla sifirlandi!"
Write-Log "Default admin kullanici:"
Write-Log "  Email: admin@fincalc.com"
Write-Log "  Password: admin123"

# Tum servisleri baslat
Write-Log "Tum servisler baslatiliyor..."
docker-compose up -d

Write-Log "Islem tamamlandi!"
