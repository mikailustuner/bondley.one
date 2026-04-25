#!/bin/bash
# Bondley PostgreSQL -> gzip -> EC2 yedekleme scripti
# Cron örneği (her gece 02:00):
#   0 2 * * * /path/to/scripts/backup_bondley.sh >> /var/log/bondley_backup.log 2>&1
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/bondley_${DATE}.sql.gz"
EC2_HOST="admin@ec2-16-171-71-125.eu-north-1.compute.amazonaws.com"
EC2_PEM="/home/mikailustuner/.ssh/ec2-backup.pem"
EC2_DIR="/home/admin/backups/bondley"
CONTAINER="fincalc-postgres"
DB_USER="bondley"
DB_NAME="bondley"

echo "[$(date)] Yedek alınıyor..."

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

scp -i "$EC2_PEM" -o StrictHostKeyChecking=no "$BACKUP_FILE" "$EC2_HOST:$EC2_DIR/"

rm -f "$BACKUP_FILE"

ssh -i "$EC2_PEM" -o StrictHostKeyChecking=no "$EC2_HOST" \
    "find $EC2_DIR -name '*.sql.gz' -mtime +30 -delete"

echo "[$(date)] Tamamlandı: bondley_${DATE}.sql.gz"
