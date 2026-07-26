#!/bin/bash

# ============================================
# Bondley Secure Environment Secrets Generator
# ============================================

echo "+---------------------------------------------------+"
echo "| Generating Secure Secrets for Bondley Production   |"
echo "+---------------------------------------------------+"
echo ""

# Helper function to generate a 32-byte (64 char) hex string
generate_hex_string() {
    openssl rand -hex 32
}

# Helper function to generate a 32-byte base64 string (often preferred for some JWT libs, but hex is safe universally)
generate_fernet_key() {
    openssl rand -base64 32 | tr '/+' '_-'
}

JWT_SECRET_KEY=$(generate_hex_string)
JWT_REFRESH_SECRET_KEY=$(generate_hex_string)
MFA_ENCRYPTION_KEY=$(generate_fernet_key)

# PostgreSQL password should ideally not have special chars that break connection URIs without encoding. Alphanumeric + some safe symbols is best.
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
ADMIN_INIT_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo "Copy these values into your .env file:"
echo ""
echo "==================== SECRETS ===================="
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo "JWT_SECRET_KEY=$JWT_SECRET_KEY"
echo "JWT_REFRESH_SECRET_KEY=$JWT_REFRESH_SECRET_KEY"
echo "MFA_ENCRYPTION_KEY=$MFA_ENCRYPTION_KEY"
echo "ADMIN_INIT_PASSWORD=$ADMIN_INIT_PASSWORD"
echo "================================================="
echo ""
echo "CRITICAL: Do not lose these keys. If JWT_SECRET_KEY is lost, all users will be logged out."
echo "CRITICAL: If MFA_ENCRYPTION_KEY is lost, users will not be able to use their 2FA codes!"
echo ""
