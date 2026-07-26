#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_SHA="${1:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_LOCK_FILE="${BONDLEY_DEPLOY_LOCK_FILE:-/tmp/bondley-production-deploy.lock}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "HATA: Beklenen commit SHA geçersiz."
  exit 2
fi

exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  echo "HATA: Başka bir production deploy işlemi devam ediyor."
  exit 3
fi

cd "$PROJECT_ROOT"

if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo "HATA: Sunucu çalışma ağacı temiz değil; deploy durduruldu."
  git status --short
  exit 4
fi

POSTGRES_CONTAINER_ID="$(
  docker compose -f docker-compose.prod.yml ps --status running -q postgres
)"
if [ -n "$POSTGRES_CONTAINER_ID" ]; then
  echo "[server-deploy] Deploy öncesi veritabanı yedeği alınıyor."
  ./scripts/backup_db.sh
else
  echo "[server-deploy] Çalışan PostgreSQL yok; ilk kurulum yedeği atlandı."
fi

echo "[server-deploy] origin/$DEPLOY_BRANCH güncelleniyor."
git fetch --prune origin "$DEPLOY_BRANCH"
REMOTE_SHA="$(git rev-parse FETCH_HEAD)"

if [ "$REMOTE_SHA" != "$EXPECTED_SHA" ]; then
  echo "[server-deploy] $EXPECTED_SHA artık origin/$DEPLOY_BRANCH ucu değil; eski deploy atlandı."
  exit 0
fi

if ! git merge-base --is-ancestor HEAD "$EXPECTED_SHA"; then
  echo "HATA: Sunucu HEAD'i hedef commit'e fast-forward edilemiyor."
  exit 5
fi

git merge --ff-only "$EXPECTED_SHA"

if [ "$(git rev-parse HEAD)" != "$EXPECTED_SHA" ]; then
  echo "HATA: Çalışma ağacı beklenen commit'e geçemedi."
  exit 6
fi

echo "[server-deploy] $EXPECTED_SHA deploy ediliyor."
./deploy.sh
echo "[server-deploy] Deploy tamamlandı: $EXPECTED_SHA"
