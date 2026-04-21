#!/bin/bash
# HTTPS neden çalışmıyor kontrolü (ERR_CONNECTION_REFUSED için)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

[ -f .env ] && source .env
DOMAIN="${DOMAIN:-udkdigital.design}"

echo "=== 1. Nginx çalışıyor mu? ==="
if docker ps --format '{{.Names}}' | grep -q fincalc-nginx; then
  echo "  OK: fincalc-nginx running"
else
  echo "  HATA: fincalc-nginx yok. Başlat: docker compose -f docker-compose.prod.yml up -d nginx"
  exit 1
fi

echo ""
echo "=== 2. Sertifika volume'da var mı? ==="
if docker run --rm -v certbot_certs:/etc/letsencrypt:ro alpine ls "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null; then
  echo "  OK: Sertifika mevcut"
else
  echo "  HATA: Sertifika yok. Önce: ./scripts/obtain-ssl.sh"
  echo "  Geçici çözüm: http://${DOMAIN} (sadece HTTP) kullan."
  exit 1
fi

echo ""
echo "=== 3. Nginx 443 dinliyor mu? (container içi) ==="
if docker exec fincalc-nginx cat /etc/nginx/conf.d/default.conf 2>/dev/null | grep -q "listen 443"; then
  echo "  OK: 443 açık"
else
  echo "  HATA: Nginx sadece HTTP (80) ile başlamış. Sertifika sonrası Nginx'i yeniden başlat:"
  echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate nginx"
  exit 1
fi

echo ""
echo "=== 4. Sunucuda 80/443 açık mı? ==="
for port in 80 443; do
  if command -v ss >/dev/null 2>&1; then
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then echo "  OK: Port $port listening"; else echo "  UYARI: Port $port dinlenmiyor"; fi
  else
    echo "  (ss yok, port kontrolü atlandı)"
  fi
done

echo ""
echo "=== 5. Firewall (ufw) ==="
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  sudo ufw status | grep -E "80|443" || echo "  80/443 kuralları yoksa ekle: sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw reload"
else
  echo "  ufw aktif değil veya yok (cloud'ta güvenlik duvarı panelden 80/443 açık olmalı)"
fi

echo ""
echo "============================================="
echo "  Tüm kontroller geçtiyse https://${DOMAIN} açılmalı."
echo "============================================="
