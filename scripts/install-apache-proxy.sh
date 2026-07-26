#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "HATA: Bu script sunucuda sudo ile çalıştırılmalı."
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_CONFIG="$PROJECT_ROOT/ops/apache/bondley.conf"
TARGET_CONFIG="/etc/apache2/sites-available/bondley.conf"

test -f "$SOURCE_CONFIG" || {
  echo "HATA: Apache config bulunamadı: $SOURCE_CONFIG"
  exit 2
}

test -f /etc/letsencrypt/live/bondley.one/fullchain.pem || {
  echo "HATA: bondley.one sertifikası bulunamadı. Önce Certbot ile sertifika oluşturun."
  exit 3
}

a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
install -m 0644 "$SOURCE_CONFIG" "$TARGET_CONFIG"
if [ -L /etc/apache2/sites-enabled/bondley-http-bootstrap.conf ]; then
  a2dissite bondley-http-bootstrap.conf
fi
a2ensite bondley.conf
apache2ctl configtest
systemctl reload apache2

echo "Apache reverse proxy etkin: https://bondley.one -> http://127.0.0.1:3050"
