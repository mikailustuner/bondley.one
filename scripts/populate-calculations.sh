#!/bin/bash
# Hesaplamalar (calculations) tablosunu manuel doldurma - Linux/Mac

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[CALC]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Hesaplamalar doldurma islemi baslatiliyor..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/populate-calculations.py"

USE_DOCKER=false
if command -v docker &> /dev/null && docker ps | grep -q fincalc-api; then
    USE_DOCKER=true
    log "Docker container bulundu, container icinde calistirilacak."
fi

if [ "$USE_DOCKER" = true ]; then
    docker cp "$PYTHON_SCRIPT" fincalc-api:/app/populate-calculations.py 2>/dev/null || true
    docker exec fincalc-api python3 /app/populate-calculations.py "$@" || \
        docker exec -w /app fincalc-api python3 scripts/populate-calculations.py "$@"
else
    cd "$PROJECT_ROOT"
    if command -v python3 &> /dev/null; then
        python3 "$PYTHON_SCRIPT" "$@"
    else
        python "$PYTHON_SCRIPT" "$@"
    fi
fi

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    error "Script hata ile sonlandi (exit code: $EXIT_CODE)"
fi
log "Islem tamamlandi!"
