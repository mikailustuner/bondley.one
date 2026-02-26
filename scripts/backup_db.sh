#!/bin/bash
set -e

# ============================================
# FinCalc Database Backup Script
# PostgreSQL -> GZIP -> Google Cloud Storage
# ============================================

# Environment variables should ideally be loaded from a secure location or passed at runtime
# This script expects to run on the host machine where docker-compose is running
source "$(dirname "$0")/../.env"

BACKUP_DIR="/tmp/fincalc_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="fincalc_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
GCS_BUCKET="gs://${GCS_BACKUP_BUCKET:-fincalc-backups}/db-backups/"
CONTAINER_NAME="fincalc-postgres"

# Create local backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $(date)"

# 1. Dump the database and compress it
echo "Dumping database from container $CONTAINER_NAME..."
docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_PATH"

if [ $? -ne 0 ]; then
    echo "Error: Database dump failed."
    exit 1
fi

echo "Database dumped successfully to $BACKUP_PATH"

# 2. Upload to Google Cloud Storage
echo "Uploading backup to $GCS_BUCKET..."
if command -v gsutil &> /dev/null; then
    gsutil cp "$BACKUP_PATH" "$GCS_BUCKET"
    if [ $? -eq 0 ]; then
        echo "Backup uploaded successfully to GCS."
    else
        echo "Error: Failed to upload backup to GCS."
        exit 1
    fi
else
    echo "Warning: gsutil not found. Skipping Google Cloud Storage upload."
    echo "Please ensure Google Cloud SDK is installed and authorized."
fi

# 3. Cleanup old local backups (keep last 7 days)
echo "Cleaning up local backups older than 7 days..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete

echo "Backup process completed successfully at $(date)."
