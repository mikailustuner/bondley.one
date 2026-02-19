#!/bin/bash
# Toplu tarih güncelleme scripti (Bash)
# PostgreSQL container'ına direkt SQL komutları gönderir

set -e

echo "============================================================"
echo "TOPLU TARIH GUNCELLEME SCRIPTI"
echo "============================================================"
echo ""
echo "⚠️  DİKKAT: Bu script veritabanındaki verileri kalıcı olarak değiştirir!"
echo "    İşlem öncesi mutlaka backup alın!"
echo ""

# Container adı
CONTAINER="fincalc-postgres"
DB_USER="fincalc"
DB_NAME="fincalc"

# Backup önerisi
read -p "Backup almak ister misiniz? [E/h]: " backup_choice
if [[ "$backup_choice" != "h" ]]; then
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "Backup alınıyor: $BACKUP_FILE"
    docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"
    echo "✓ Backup tamamlandı: $BACKUP_FILE"
    echo ""
fi

# Güncelleme tipi
echo "Güncelleme tipi:"
echo "  1. Tüm kayıtları X gün ileriye/geriye al"
echo "  2. Belirli bir tahvil (ISIN kodu)"
echo "  3. Belirli bir tarih aralığı"
echo "  4. Belirli bir tarihi başka tarihe çevir"
read -p "Seçiminiz (1-4): " choice

case $choice in
    1)
        read -p "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): " days_offset
        SQL_MARKET="UPDATE market_data SET trade_date = trade_date + INTERVAL '$days_offset days';"
        SQL_CALC="UPDATE calculations SET calc_date = calc_date + INTERVAL '$days_offset days';"
        ;;
    2)
        read -p "ISIN kodunu girin: " isin_code
        read -p "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): " days_offset
        SQL_MARKET="UPDATE market_data SET trade_date = trade_date + INTERVAL '$days_offset days' WHERE bond_id = (SELECT id FROM bonds WHERE isin_code = '$isin_code');"
        SQL_CALC="UPDATE calculations SET calc_date = calc_date + INTERVAL '$days_offset days' WHERE bond_id = (SELECT id FROM bonds WHERE isin_code = '$isin_code');"
        ;;
    3)
        read -p "Başlangıç tarihi (YYYY-MM-DD): " start_date
        read -p "Bitiş tarihi (YYYY-MM-DD): " end_date
        read -p "Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): " days_offset
        SQL_MARKET="UPDATE market_data SET trade_date = trade_date + INTERVAL '$days_offset days' WHERE trade_date BETWEEN '$start_date' AND '$end_date';"
        SQL_CALC="UPDATE calculations SET calc_date = calc_date + INTERVAL '$days_offset days' WHERE calc_date BETWEEN '$start_date' AND '$end_date';"
        ;;
    4)
        read -p "Değiştirilecek tarih (YYYY-MM-DD): " old_date
        read -p "Yeni tarih (YYYY-MM-DD): " new_date
        SQL_MARKET="UPDATE market_data SET trade_date = '$new_date' WHERE trade_date = '$old_date';"
        SQL_CALC="UPDATE calculations SET calc_date = '$new_date' WHERE calc_date = '$old_date';"
        ;;
    *)
        echo "HATA: Geçersiz seçim"
        exit 1
        ;;
esac

# Dry run
read -p "Dry run yapmak istiyor musunuz? (sadece önizleme) [E/h]: " dry_run
if [[ "$dry_run" != "h" ]]; then
    echo ""
    echo "[DRY RUN MODU] - Sadece önizleme yapılacak"
    echo ""
    echo "market_data önizleme:"
    docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT trade_date, COUNT(*) as count FROM market_data GROUP BY trade_date ORDER BY trade_date DESC LIMIT 10;"
    echo ""
    echo "calculations önizleme:"
    docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT calc_date, COUNT(*) as count FROM calculations GROUP BY calc_date ORDER BY calc_date DESC LIMIT 10;"
    echo ""
    echo "Dry run tamamlandı. Gerçek güncelleme için script'i tekrar çalıştırın ve 'h' seçeneğini seçin."
    exit 0
fi

# Onay
read -p "⚠️  GERÇEKTEN GÜNCELLEME YAPMAK İSTİYOR MUSUNUZ? (evet yazın): " confirm
if [[ "$confirm" != "evet" ]]; then
    echo "İşlem iptal edildi"
    exit 0
fi

echo ""
echo "Güncelleme yapılıyor..."

# Transaction içinde güncelle
docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME <<EOF
BEGIN;

-- market_data güncelle
$SQL_MARKET

-- calculations güncelle
$SQL_CALC

-- Sonuçları göster
SELECT 'market_data' as table_name, COUNT(*) as total, MIN(trade_date) as min_date, MAX(trade_date) as max_date FROM market_data
UNION ALL
SELECT 'calculations' as table_name, COUNT(*) as total, MIN(calc_date)::text as min_date, MAX(calc_date)::text as max_date FROM calculations;

COMMIT;
EOF

echo ""
echo "============================================================"
echo "GÜNCELLEME TAMAMLANDI!"
echo "============================================================"
