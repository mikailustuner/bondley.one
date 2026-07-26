#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

docker compose -f docker-compose.prod.yml ps

LIVE="$(curl -fsS http://localhost:3050/health/live)"
READY="$(curl -fsS http://localhost:3050/health/ready)"
NGINX="$(curl -fsS http://localhost:3050/nginx-health)"

echo "[health] live:  $LIVE"
echo "[health] ready: $READY"
echo "[health] nginx: $NGINX"

echo "$LIVE" | grep -q '"status":"healthy"'
echo "$READY" | grep -q '"status":"ready"'
test "$NGINX" = "OK"
