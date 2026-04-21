#!/bin/bash
# Market Data Doldurma Script'i (Bash)
# Bonds tablosundaki clean_price_text değerlerini parse edip market_data tablosuna yazar.

set -e  # Hata durumunda dur

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[POPULATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "Market Data doldurma islemi baslatiliyor..."

# Proje kök dizinini bul
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/populate-market-data.py"

# Docker container kontrolü
USE_DOCKER=false
if command -v docker &> /dev/null && docker ps | grep -q fincalc-api; then
    USE_DOCKER=true
    log "Docker container bulundu, container içinde çalıştırılacak."
elif [ -f "$PROJECT_ROOT/.env" ] || [ -f "$PROJECT_ROOT/.env.production" ]; then
    # .env dosyası varsa Docker kullanmayı dene
    if command -v docker &> /dev/null; then
        warn "API container çalışmıyor. Container'ı başlatmak ister misiniz? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cd "$PROJECT_ROOT"
            docker-compose up -d api 2>/dev/null || docker-compose -f docker-compose.prod.yml up -d api 2>/dev/null || {
                warn "Container başlatılamadı, lokal Python kullanılacak."
                USE_DOCKER=false
            }
            sleep 3
            if docker ps | grep -q fincalc-api; then
                USE_DOCKER=true
            fi
        fi
    fi
fi

if [ "$USE_DOCKER" = true ]; then
    # Docker container içinde çalıştır
    log "Script Docker container içinde çalıştırılıyor..."
    
    # Script'i container'a kopyala
    docker cp "$PYTHON_SCRIPT" fincalc-api:/app/populate-market-data.py 2>/dev/null || {
        warn "Script kopyalanamadı, direkt çalıştırılıyor..."
    }
    
    # Container içinde çalıştır
    docker exec fincalc-api python3 /app/populate-market-data.py "$@" || {
        # Eğer /app/populate-market-data.py yoksa, scripts dizininden çalıştır
        warn "Script /app/ altında bulunamadı, scripts dizininden çalıştırılıyor..."
        docker exec -w /app fincalc-api python3 scripts/populate-market-data.py "$@"
    }
else
    # Lokal Python ile çalıştır
    log "Lokal Python ile çalıştırılıyor..."
    
    # Python'un yolunu bul
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        error "Python bulunamadı!\n   Lütfen Python 3.x'i yükleyin veya Docker container'ı başlatın."
    fi
    
    # Python versiyonunu kontrol et
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}' | cut -d. -f1)
    if [ "$PYTHON_VERSION" -lt 3 ]; then
        error "Python 3.x gerekli!"
    fi
    
    # Proje dizinine git
    cd "$PROJECT_ROOT"
    
    # Script'i çalıştır
    $PYTHON_CMD "$PYTHON_SCRIPT" "$@"
fi

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    error "Script hata ile sonlandı (exit code: $EXIT_CODE)"
fi

log "İşlem tamamlandı!"
