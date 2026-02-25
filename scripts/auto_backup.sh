#!/bin/bash

# ==============================================================================
# Veritabanı Otomatik Yedekleme Scripti
# ==============================================================================
# Bu script FinCalc/Bondley projesi için günlük PostgreSQL yedeği alır.
# 7 günden eski yedekleri otomatik olarak siler.

# Dizin yapılandırması (Scriptin olduğu klasörün bir üstüne /backups klasörü açar)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Zaman damgası üret
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="fincalc_backup_$TIMESTAMP.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$FILENAME"

# Docker container detayları
CONTAINER="fincalc-postgres"
DB_USER="fincalc"
DB_NAME="fincalc"

# Backup dizinini oluştur(yoksa)
mkdir -p "$BACKUP_DIR"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Yedekleme işlemi başlatılıyor..."

# Docker çalışıyor mu kontrol et
if ! docker info >/dev/null 2>&1; then
    echo "HATA: Docker servisine erişilemiyor!"
    exit 1
fi

# Container ayakta mı kontrol et
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    echo "HATA: $CONTAINER container'ı çalışmıyor!"
    exit 1
fi

# pg_dump ile yedek al ve gzip ile sıkıştır
docker exec -t $CONTAINER pg_dump -U $DB_USER -c $DB_NAME | gzip > "$BACKUP_PATH"

if [ $? -eq 0 ]; then
    FILE_SIZE=$(ls -lh "$BACKUP_PATH" | awk '{print $5}')
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Yedekleme BAŞARILI: $BACKUP_PATH (Boyut: $FILE_SIZE)"
    
    # 7 günden eski yedekleri temizle
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Eski yedekler temizleniyor (7 günden eski)..."
    find "$BACKUP_DIR" -name "fincalc_backup_*.sql.gz" -type f -mtime +7 -delete
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] İşlem tamamlandı."
else
    echo "HATA: Yedekleme işlemi başarısız oldu!"
    rm -f "$BACKUP_PATH" # Başarısız yarım kalan dosyayı sil
    exit 1
fi
