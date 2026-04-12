# Manuel Tahvil Hesaplama Scripti

Bu script, XLS dosyasından tahvil verilerini okuyup hesaplamaları yapar.

## Gereksinimler

```bash
pip install xlrd numpy-financial
```

Script tamamen bağımsızdır ve proje modüllerine ihtiyaç duymaz.

## Kullanım

### Windows PowerShell'de:

```powershell
python calculate_bond_manual.py
```

Script çalıştığında sizden şunları isteyecek:
1. **XLS dosya yolu**: Varsayılan: `manu@_tbliste_extracted/tbliste_20260218.xls`
2. **ISIN kodu**: Varsayılan: `TRDEMVK22619`
3. **Hesaplama tarihi**: Format: `YYYY-MM-DD` (örn: `2026-02-19`), varsayılan: bugün

### Örnek Çalıştırma:

```powershell
python calculate_bond_manual.py
```

Çıktıda şunları göreceksiniz:
- Tahvil temel bilgileri
- Kupon dönemi bilgileri
- Birikmiş faiz
- Kirli fiyat
- YTM (Vadeye Kadar Getiri)
- Durasyon metrikleri (Modifiye, Macaulay)
- Konveksite
- Kupon ödeme tutarı

## Notlar

- **TLREF Verisi**: Script, TLREF verisi olmadan çalışır ancak şu metrikler hesaplanamaz:
  - Yıllık Gösterge Faiz Oranı
  - Yıllık Kupon Faiz Oranı
  - Dönemsel Kupon Faiz Oranı
  - Spread
  - Oran Değişimi

- **Clean Price**: Script önce XLS'deki clean_price değerini kullanır. Eğer yoksa `last_issue_price`, o da yoksa nominal değer (100) kullanılır.

## Hata Ayıklama

Eğer script çalışmazsa:

1. **Modül bulunamadı hatası**: Proje root dizininde çalıştırdığınızdan emin olun.
2. **XLS okuma hatası**: Dosya yolunun doğru olduğundan ve dosyanın mevcut olduğundan emin olun.
3. **Hesaplama hatası**: Tahvil verilerinin eksiksiz olduğundan emin olun (özellikle `first_issue_date` ve `maturity_date`).

## Çıktı Örneği

```
============================================================
TAHVIL HESAPLAMA SCRIPTI
============================================================

XLS dosyasi okunuyor: manu@_tbliste_extracted/tbliste_20260218.xls
Toplam 2150 satir bulundu
Tahvil bulundu: TRDEMVK22619 (Satir 1234)

============================================================
TAHVIL BILGILERI
============================================================
ISIN: TRDEMVK22619
Ihracci: ...
...

============================================================
HESAPLAMA TARIHI: 2026-02-19
TEMIZ FIYAT: 98.50
============================================================

Kupon Donemi:
  Baslangic: 2025-12-15
  Bitis: 2026-06-15
  Donem Gun Sayisi: 182
  Yillik Frekans: 2

Birikmis Faiz: 1.23456789
Kirli Fiyat: 99.73456789

============================================================
HESAPLANAN METRIKLER
============================================================
Temiz Fiyat (Kullanilan): 98.50000000
Birikmis Faiz: 1.23456789
Kirli Fiyat: 99.73456789
Vadeye Kadar Getiri (YTM): 12.3456%
Modifiye Durasyon: 4.567890
Macaulay Durasyon: 4.789012
Konveksite: 0.123456
Kupon Odeme Tutari: 5.00000000
```
