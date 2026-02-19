# PostgreSQL Password Update Script
# Bu script PostgreSQL container'indaki kullanici sifresini .env dosyasindaki sifre ile gunceller

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

Write-Log "PostgreSQL sifre guncelleme islemi baslatiliyor..."

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

if (-not $POSTGRES_PASSWORD) {
    Write-Error "POSTGRES_PASSWORD .env dosyasinda tanimli degil!"
}

if (-not $POSTGRES_USER) {
    Write-Error "POSTGRES_USER .env dosyasinda tanimli degil!"
}

# PostgreSQL container'inin calisip calismadigini kontrol et
$postgresRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "fincalc-postgres"
if (-not $postgresRunning) {
    Write-Error "PostgreSQL container'i calismiyor! Once container'i baslat:`n  docker-compose -f docker-compose.prod.yml up -d postgres"
}

Write-Log "PostgreSQL container'i bulundu."
Write-Log "Kullanici: $POSTGRES_USER"
Write-Log "Yeni sifre guncelleniyor..."

# PostgreSQL sifresini guncelle
$updateQuery = "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';"

try {
    # Once postgres superuser ile dene
    docker exec fincalc-postgres psql -U postgres -d postgres -c $updateQuery 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "PostgreSQL sifresi basariyla guncellendi!"
    } else {
        throw "Superuser ile guncelleme basarisiz"
    }
} catch {
    # Eger superuser ile baglanamazsa, mevcut kullanici ile dene
    Write-Warn "Superuser ile baglanamadi, mevcut kullanici ile deneniyor..."
    try {
        docker exec fincalc-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c $updateQuery 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "PostgreSQL sifresi basariyla guncellendi!"
        } else {
            Write-Error "Sifre guncellenemedi! PostgreSQL container loglarini kontrol edin:`n  docker logs fincalc-postgres"
        }
    } catch {
        Write-Error "Sifre guncellenemedi! PostgreSQL container loglarini kontrol edin:`n  docker logs fincalc-postgres"
    }
}

Write-Log "API container'ini yeniden baslatmaniz gerekebilir:"
Write-Log "  docker-compose -f docker-compose.prod.yml restart api"
