#!/bin/sh
set -e

# Domain: once volume'daki sertifika klasorunden tespit et (live/DOMAIN/fullchain.pem), yoksa env'den.
export DOMAIN="${DOMAIN:-}"
if [ -d /etc/letsencrypt/live ]; then
  for d in /etc/letsencrypt/live/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ "$name" = "README" ] && continue
    if [ -r "${d}fullchain.pem" ] && [ -r "${d}privkey.pem" ]; then
      DOMAIN="$name"
      break
    fi
  done
fi
export DOMAIN="${DOMAIN:-localhost}"

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
if [ -r "$CERT" ] && [ -r "$KEY" ]; then
  envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
  echo "[nginx] SSL OK: domain=$DOMAIN -> ports 80 and 443"
else
  envsubst '${DOMAIN}' < /etc/nginx/templates/default-http-only.conf.template > /etc/nginx/conf.d/default.conf
  echo "[nginx] HTTP only: $CERT or $KEY not readable -> port 80 only"
fi
echo "[nginx] Listening: $(grep -E '^\s*listen\s+' /etc/nginx/conf.d/default.conf | sort -u | tr '\n' ' ')"

nginx -t || { echo "[nginx] Config test FAILED"; exit 1; }
exec nginx -g 'daemon off;'
