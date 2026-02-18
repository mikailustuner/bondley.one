#!/bin/sh
set -e

# DOMAIN container env'den gelir (docker-compose: DOMAIN: ${DOMAIN}). Boşsa volume'daki sertifika klasöründen tespit et.
export DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -d /etc/letsencrypt/live ]; then
  for d in /etc/letsencrypt/live/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ "$name" = "README" ] && continue
    if [ -f "${d}fullchain.pem" ]; then
      DOMAIN="$name"
      break
    fi
  done
fi
export DOMAIN="${DOMAIN:-localhost}"

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$CERT" ]; then
  envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
  echo "Using SSL config for domain: $DOMAIN"
else
  envsubst '${DOMAIN}' < /etc/nginx/templates/default-http-only.conf.template > /etc/nginx/conf.d/default.conf
  echo "No cert at $CERT — using HTTP-only config. Get cert: ./scripts/obtain-ssl.sh"
fi

nginx -t || { echo "Nginx config test failed."; exit 1; }
exec nginx -g 'daemon off;'
