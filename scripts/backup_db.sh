#!/bin/bash
set -e

# ============================================
# FinCalc Database Backup Script
# PostgreSQL -> GZIP -> Google Cloud Storage
# ============================================

# Environment variables should ideally be loaded from a secure location or passed at runtime
# This script expects to run on the host machine where docker compose is running
source "$(dirname "$0")/../.env"

BACKUP_DIR="/tmp/fincalc_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="fincalc_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
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

# (Optional) You can add your own custom sync logic here (e.g., rsync, scp, AWS CLI)
# if you decide to push backups to another server in the future.

# 3. Cleanup old local backups (keep last 7 days)
echo "Cleaning up local backups older than 7 days..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete

echo "Backup process completed successfully at $(date)."
