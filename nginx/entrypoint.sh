#!/bin/sh
set -e

export DOMAIN="${DOMAIN:-}"
export DOMAIN="${DOMAIN:-localhost}"

envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
echo "[nginx] Internal HTTP gateway ready: domain=$DOMAIN"
echo "[nginx] Listening: $(grep -E '^\s*listen\s+' /etc/nginx/conf.d/default.conf | sort -u | tr '\n' ' ')"

nginx -t || { echo "[nginx] Config test FAILED"; exit 1; }
exec nginx -g 'daemon off;'
