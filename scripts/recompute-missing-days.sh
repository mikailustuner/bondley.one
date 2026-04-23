#!/bin/bash
# Eksik Hesaplamaları Tamamlama (Backfill) Wrapper Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BACKFILL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Proje kök dizinini bul
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/recompute-missing-days.py"

# Kullanım yardımı
usage() {
    echo "Kullanım: $0 [seçenekler]"
    echo ""
    echo "Seçenekler:"
    echo "  --days N         Son N günü kontrol et (Varsayılan: 7)"
    echo "  --start YYYY-MM-DD Başlangıç tarihi"
    echo "  --end YYYY-MM-DD   Bitiş tarihi"
    echo "  --force          Eksik olmasa bile tüm günleri yeniden hesapla"
    echo ""
    exit 1
}

# Docker container kontrolü
USE_DOCKER=false
if command -v docker &> /dev/null && docker ps | grep -q fincalc-api; then
    USE_DOCKER=true
    log "Docker container (fincalc-api) bulundu."
fi

# Argümanları python scriptine iletmek için hazırla
ARGS=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --days) ARGS="$ARGS --days $2"; shift 2 ;;
        --start) ARGS="$ARGS --start-date $2"; shift 2 ;;
        --end) ARGS="$ARGS --end-date $2"; shift 2 ;;
        --force) ARGS="$ARGS --force"; shift ;;
        *) usage ;;
    esac
done

if [ "$USE_DOCKER" = true ]; then
    log "Kodlar Docker container içine senkronize ediliyor..."
    # Tüm app klasörünü ve scripti kopyala
    docker cp "$PROJECT_ROOT/apps/api/app" fincalc-api:/app/
    docker cp "$PYTHON_SCRIPT" fincalc-api:/app/recompute-missing-days.py
    
    log "Script Docker container içinde çalıştırılıyor..."
    docker exec -it fincalc-api python3 recompute-missing-days.py $ARGS
else
    log "Lokal Python ortamında çalıştırılıyor..."
    export PYTHONPATH=$PYTHONPATH:$(pwd)/apps/api
    python3 "$PYTHON_SCRIPT" $ARGS
fi

log "İşlem başarıyla tamamlandı!"
