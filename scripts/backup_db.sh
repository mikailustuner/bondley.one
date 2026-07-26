#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_PATH="${BACKUP_DIR}/bondley-${STAMP}.sql.gz"

cd "$PROJECT_DIR"
test -f .env || { echo "HATA: .env bulunamadı."; exit 1; }
mkdir -p "$BACKUP_DIR"

echo "[backup] PostgreSQL yedeği alınıyor: $BACKUP_PATH"
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'exec pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$BACKUP_PATH"
gzip -t "$BACKUP_PATH"
echo "[backup] Tamamlandı: $(du -h "$BACKUP_PATH" | cut -f1)"

# Retention can be overridden by BACKUP_RETENTION_DAYS.
find "$BACKUP_DIR" -type f -name 'bondley-*.sql.gz' \
  -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
