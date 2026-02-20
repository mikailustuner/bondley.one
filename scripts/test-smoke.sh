#!/bin/bash
set -e

# ============================================
# FinCalc Smoke Test Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SMOKE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

ENVIRONMENT=${1:-stable}

if [ "$ENVIRONMENT" = "canary" ]; then
    API_URL="http://localhost:8001"
    WEB_URL="http://localhost:3001"
    DOMAIN_URL="https://${DOMAIN:-localhost}"
else
    API_URL="http://localhost:8000"
    WEB_URL="http://localhost:3000"
    DOMAIN_URL="https://${DOMAIN:-localhost}"
fi

source .env 2>/dev/null || true

log "Smoke test baslatiliyor ($ENVIRONMENT ortami)..."
log "API URL: $API_URL"
log "Web URL: $WEB_URL"

FAILED_TESTS=0

# Test 1: API Health Check
log "Test 1: API Health Check..."
if curl -f -s "$API_URL/health" | grep -q "healthy"; then
    log "  ✓ API health check basarili"
else
    error "  ✗ API health check basarisiz"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 2: API Critical Endpoint - Bonds List
log "Test 2: API Bonds Endpoint..."
BONDS_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/bonds" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$BONDS_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    log "  ✓ Bonds endpoint erisilebilir (HTTP $HTTP_CODE)"
else
    warn "  ⚠ Bonds endpoint beklenmeyen yanit (HTTP $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 3: API Critical Endpoint - TLREF Latest
log "Test 3: API TLREF Endpoint..."
TLREF_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/tlref/latest" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$TLREF_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    log "  ✓ TLREF endpoint erisilebilir (HTTP $HTTP_CODE)"
else
    warn "  ⚠ TLREF endpoint beklenmeyen yanit (HTTP $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 4: Web Homepage
log "Test 4: Web Homepage..."
if curl -f -s "$WEB_URL" > /dev/null 2>&1; then
    log "  ✓ Web homepage erisilebilir"
else
    error "  ✗ Web homepage erisilemez"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 5: Web Dashboard Route (should return HTML, not 500)
log "Test 5: Web Dashboard Route..."
DASHBOARD_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_URL/dashboard" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$DASHBOARD_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
    log "  ✓ Dashboard route erisilebilir (HTTP $HTTP_CODE)"
else
    warn "  ⚠ Dashboard route beklenmeyen yanit (HTTP $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 6: API Response Time Check
log "Test 6: API Response Time..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$API_URL/health" 2>/dev/null || echo "999")
# Use awk for floating point comparison (more portable than bc)
if awk "BEGIN {exit !($RESPONSE_TIME < 2.0)}"; then
    log "  ✓ API response time iyi (${RESPONSE_TIME}s)"
else
    warn "  ⚠ API response time yavas (${RESPONSE_TIME}s)"
fi

# Test 7: Container Health Status
log "Test 7: Container Health Status..."
if [ "$ENVIRONMENT" = "canary" ]; then
    if docker ps --filter "name=canary" --format "{{.Status}}" | grep -q "Up"; then
        log "  ✓ Canary container'lar calisiyor"
    else
        error "  ✗ Canary container'lar calismiyor"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    if docker ps --filter "name=fincalc-api" --format "{{.Status}}" | grep -q "Up"; then
        log "  ✓ Stable container'lar calisiyor"
    else
        error "  ✗ Stable container'lar calismiyor"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi

# Summary
log "============================================"
if [ $FAILED_TESTS -eq 0 ]; then
    log "  Smoke test BASARILI!"
    log "============================================"
    exit 0
else
    error "  Smoke test BASARISIZ! ($FAILED_TESTS test basarisiz)"
    log "============================================"
    exit 1
fi
