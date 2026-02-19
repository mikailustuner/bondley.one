# Market Data Doldurma Script'i (PowerShell)
# Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.

param(
    [string]$Date = "",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

# Proje kök dizinini bul
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

# Python script'ini çalıştır
$pythonScript = Join-Path $scriptPath "populate-market-data.py"

$args = @()
if ($Date) {
    $args += "--date", $Date
}
if ($DryRun) {
    $args += "--dry-run"
}

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Market Data Doldurma Script'i" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Python'un yolunu kontrol et
$pythonCmd = "python"
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
}

try {
    & $pythonCmd $pythonScript $args
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Script hata ile sonlandı (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "❌ Hata: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Python'un yüklü olduğundan ve proje bağımlılıklarının kurulu olduğundan emin olun." -ForegroundColor Yellow
    exit 1
}
