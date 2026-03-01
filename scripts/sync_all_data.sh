#!/bin/bash
# Master Data Sync Script for FinCalc
# Bu script sirasiyla KAP verilerini, Piyasa Verilerini (Market Data) 
# ve Hesaplamalari (Calculations) tek seferde arka arkaya calistirir.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "${CYAN}[SYNC_MASTER]${NC} $1"; }
success() { echo -e "${GREEN}[BASARILI]${NC} $1"; }
warn() { echo -e "${YELLOW}[UYARI]${NC} $1"; }
error() { echo -e "${RED}[HATA]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log "================================================="
log " FINCALC TEK TUS VERI SENKRONIZASYONU BASLIYOR..."
log "================================================="
echo ""

# ADIM 1: KAP Verilerini Cek
log "ADIM 1: KAP Bildirimleri Cekiliyor (fetch_kap_data.sh)..."
if bash "$SCRIPT_DIR/fetch_kap_data.sh"; then
    success "KAP verileri basariyla cekildi!"
else
    error "KAP verilerini cekerken hata olustu. Islem durduruldu."
fi
echo ""

# ADIM 2: Market Data (Piyasa Verileri) Doldur
log "ADIM 2: Market Data Dolduruluyor (populate-market-data.sh)..."
if bash "$SCRIPT_DIR/populate-market-data.sh"; then
    success "Market Data basariyla dolduruldu!"
else
    error "Market Data islenirken hata olustu. Islem durduruldu."
fi
echo ""

# ADIM 3: Fiyat ve Getiri Hesaplamalari
log "ADIM 3: Hesaplamalar Gerceklestiriliyor (populate-calculations.sh)..."
if bash "$SCRIPT_DIR/populate-calculations.sh"; then
    success "Hesaplamalar basariyla tamamlandi!"
else
    error "Hesaplamalar yapilirken hata olustu. Islem durduruldu."
fi
echo ""

log "================================================="
success "TUM SENKRONIZASYON ISLEMLERI EKSIKSIZ TAMAMLANDI!"
log "================================================="
