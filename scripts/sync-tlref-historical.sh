#!/bin/bash
# TLREFORANI_D.zip Tarihsel Oran Senkronizasyonu (Bash)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[TLREF]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Proje kök dizinini bul
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/sync-tlref-historical.py"

# Docker container kontrolü
USE_DOCKER=false
if command -v docker &> /dev/null && docker ps | grep -q fincalc-api; then
    USE_DOCKER=true
    log "Docker container bulundu, container içinde çalıştırılacak."
fi

if [ "$USE_DOCKER" = true ]; then
    log "Kodlar Docker container içine senkronize ediliyor..."
    # Tüm app klasörünü ve scripti kopyala
    docker cp "$PROJECT_ROOT/apps/api/app" fincalc-api:/app/
    docker cp "$PYTHON_SCRIPT" fincalc-api:/app/sync-tlref-historical.py

    log "Script Docker container içinde çalıştırılıyor..."
    docker exec -w /app fincalc-api python3 sync-tlref-historical.py
else
    log "Lokal Python ile çalıştırılıyor..."
    
    # Python'un yolunu bul
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        error "Python bulunamadı! Lütfen Docker container'ı başlatın veya Python yükleyin."
    fi
    
    cd "$PROJECT_ROOT"
    export PYTHONPATH=$PYTHONPATH:$(pwd)/apps/api
    $PYTHON_CMD "$PYTHON_SCRIPT"
fi

log "İşlem tamamlandı!"
