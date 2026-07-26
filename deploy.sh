#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

test -f .env || {
  echo "HATA: .env yok. Önce 'cp .env.example .env' ve gerçek secret/değerleri girin."
  exit 1
}

required=(DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB REDIS_PASSWORD JWT_SECRET_KEY JWT_REFRESH_SECRET_KEY MFA_ENCRYPTION_KEY ADMIN_INIT_PASSWORD CORS_ORIGINS FRONTEND_URL)
for key in "${required[@]}"; do
  value="$(sed -n "s/^${key}=//p" .env | tail -n 1)"
  if [ -z "$value" ] || [[ "$value" == replace-* ]]; then
    echo "HATA: .env içinde $key gerçek bir değer olmalı."
    exit 1
  fi
done

echo "[deploy] Compose yapılandırması doğrulanıyor."
docker compose -f "$COMPOSE_FILE" config --quiet

echo "[deploy] Image'lar oluşturuluyor ve servisler başlatılıyor."
docker compose -f "$COMPOSE_FILE" up -d --build

# Nginx şablonları bind mount ile gelir. Image kimliği değişmese bile çalışan
# process yeni şablonu kendiliğinden yüklemez; gateway'i kontrollü biçimde
# yeniden oluşturarak envsubst ve nginx -t adımlarını her deploy'da çalıştır.
echo "[deploy] Nginx gateway yapılandırması yenileniyor."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx

for job in bondley-bist-source-init bondley-migrate bondley-bootstrap; do
  for _attempt in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Status}}' "$job" 2>/dev/null || true)"
    [ "$status" = "exited" ] && break
    sleep 2
  done
  exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$job" 2>/dev/null || echo 1)"
  if [ "$exit_code" != "0" ]; then
    echo "HATA: $job başarısız. Loglar:"
    docker logs "$job" 2>&1 || true
    exit 1
  fi
done

for _attempt in $(seq 1 60); do
  if curl -fsS http://localhost:3050/health/ready >/dev/null 2>&1; then
    echo "[deploy] Hazır: http://localhost:3050"
    ./scripts/health-check.sh
    exit 0
  fi
  sleep 2
done

echo "HATA: readiness zaman aşımına uğradı."
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs --tail=100 api bootstrap
exit 1
