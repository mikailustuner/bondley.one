# Toplu tarih güncelleme scripti (PowerShell)
# PostgreSQL container'ına direkt SQL komutları gönderir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "TOPLU TARIH GUNCELLEME SCRIPTI" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  DİKKAT: Bu script veritabanındaki verileri kalıcı olarak değiştirir!" -ForegroundColor Yellow
Write-Host "    İşlem öncesi mutlaka backup alın!" -ForegroundColor Yellow
Write-Host ""

$CONTAINER = "fincalc-postgres"
$DB_USER = "fincalc"
$DB_NAME = "fincalc"

# Backup önerisi
$backupChoice = Read-Host "Backup almak ister misiniz? [E/h]"
if ($backupChoice -ne "h") {
    $backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    Write-Host "Backup alınıyor: $backupFile" -ForegroundColor Yellow
    docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME | Out-File -FilePath $backupFile -Encoding utf8
    Write-Host "✓ Backup tamamlandı: $backupFile" -ForegroundColor Green
    Write-Host ""
}

# Güncelleme tipi
Write-Host "Güncelleme tipi:"
Write-Host "  1. Tüm kayıtları X gün ileriye/geriye al"
Write-Host "  2. Belirli bir tahvil (ISIN kodu)"
Write-Host "  3. Belirli bir tarih aralığı"
Write-Host "  4. Belirli bir tarihi başka tarihe çevir"
$choice = Read-Host "Seçiminiz (1-4)"

switch ($choice) {
    "1" {
        $daysOffset = Read-Host "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.)"
        $sqlMarket = "UPDATE market_data SET trade_date = trade_date + INTERVAL '$daysOffset days';"
        $sqlCalc = "UPDATE calculations SET calc_date = calc_date + INTERVAL '$daysOffset days';"
    }
    "2" {
        $isinCode = Read-Host "ISIN kodunu girin"
        $daysOffset = Read-Host "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.)"
        $sqlMarket = "UPDATE market_data SET trade_date = trade_date + INTERVAL '$daysOffset days' WHERE bond_id = (SELECT id FROM bonds WHERE isin_code = '$isinCode');"
        $sqlCalc = "UPDATE calculations SET calc_date = calc_date + INTERVAL '$daysOffset days' WHERE bond_id = (SELECT id FROM bonds WHERE isin_code = '$isinCode');"
    }
    "3" {
        $startDate = Read-Host "Başlangıç tarihi (YYYY-MM-DD)"
        $endDate = Read-Host "Bitiş tarihi (YYYY-MM-DD)"
        $daysOffset = Read-Host "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.)"
        $sqlMarket = "UPDATE market_data SET trade_date = trade_date + INTERVAL '$daysOffset days' WHERE trade_date BETWEEN '$startDate' AND '$endDate';"
        $sqlCalc = "UPDATE calculations SET calc_date = calc_date + INTERVAL '$daysOffset days' WHERE calc_date BETWEEN '$startDate' AND '$endDate';"
    }
    "4" {
        $oldDate = Read-Host "Değiştirilecek tarih (YYYY-MM-DD)"
        $newDate = Read-Host "Yeni tarih (YYYY-MM-DD)"
        $sqlMarket = "UPDATE market_data SET trade_date = '$newDate' WHERE trade_date = '$oldDate';"
        $sqlCalc = "UPDATE calculations SET calc_date = '$newDate' WHERE calc_date = '$oldDate';"
    }
    default {
        Write-Host "HATA: Geçersiz seçim" -ForegroundColor Red
        exit 1
    }
}

# Dry run
$dryRun = Read-Host "Dry run yapmak istiyor musunuz? (sadece önizleme) [E/h]"
if ($dryRun -ne "h") {
    Write-Host ""
    Write-Host "[DRY RUN MODU] - Sadece önizleme yapılacak" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "market_data önizleme:"
    docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT trade_date, COUNT(*) as count FROM market_data GROUP BY trade_date ORDER BY trade_date DESC LIMIT 10;"
    Write-Host ""
    Write-Host "calculations önizleme:"
    docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT calc_date, COUNT(*) as count FROM calculations GROUP BY calc_date ORDER BY calc_date DESC LIMIT 10;"
    Write-Host ""
    Write-Host "Dry run tamamlandı. Gerçek güncelleme için script'i tekrar çalıştırın ve 'h' seçeneğini seçin." -ForegroundColor Yellow
    exit 0
}

# Onay
$confirm = Read-Host "⚠️  GERÇEKTEN GÜNCELLEME YAPMAK İSTİYOR MUSUNUZ? (evet yazın)"
if ($confirm -ne "evet") {
    Write-Host "İşlem iptal edildi" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Güncelleme yapılıyor..." -ForegroundColor Yellow

# Transaction içinde güncelle
$sqlScript = @"
BEGIN;

$sqlMarket

$sqlCalc

-- Sonuçları göster
SELECT 'market_data' as table_name, COUNT(*) as total, MIN(trade_date) as min_date, MAX(trade_date) as max_date FROM market_data
UNION ALL
SELECT 'calculations' as table_name, COUNT(*) as total, MIN(calc_date)::text as min_date, MAX(calc_date)::text as max_date FROM calculations;

COMMIT;
"@

docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c $sqlScript

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "GÜNCELLEME TAMAMLANDI!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
