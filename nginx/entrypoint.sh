#!/bin/sh
set -e
export DOMAIN="${DOMAIN:-localhost}"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$CERT" ]; then
  envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
else
  envsubst '${DOMAIN}' < /etc/nginx/templates/default-http-only.conf.template > /etc/nginx/conf.d/default.conf
fi
exec nginx -g 'daemon off;'
