# 📋 Bondley Changelog

Bondley — Borsa İstanbul borçlanma araçları değerleme ve analiz platformu.

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/) standardını takip eder.

---

## [1.2] — 2026-04-22

### 🚀 Yeni Özellikler

#### Favoriler Sayfası
- Dashboard sidebar'a **"Favorilerim"** bölümü eklendi (⭐ simgesi ile)
- Favori borçlanma araçlarını tek sayfada listeleme, arama ve filtreleme
- Tahvil detay sayfasından tek tıkla favorilere ekleme/çıkarma
- Favori listesi boşken yönlendirici boş durum ekranı

#### Teorik Fiyatlama Motoru
- Piyasa verisi güncel olmadığında **teorik fiyat hesaplama** altyapısı devreye alındı
- `is_theoretical` bayrağı ile teorik fiyatlanan tahviller UI'da sarı badge ile işaretleniyor
- Stale (bayat) piyasa verisi fallback mantığı: en güncel mevcut veriyi kullanarak hesaplama
- Hesaplanan metrikler kartında *"Teorik Fiyat (Tahmini)"* rozeti gösterimi

#### Hesaplanan Spread Metriği
- **İki farklı spread** artık ayrı ayrı gösteriliyor:
  - `bond.spread` → Sözleşmesel Ek Getiri (tbliste kaynaklı, ihraçta sabitlenen)
  - `calculated_metrics.spread` → Hesaplanan Spread (YTM − TLREF), piyasanın ima ettiği fark
- Finansal Veriler tablosuna **"Hesaplanan Spread (YTM − TLREF) %"** satırı eklendi
- Hesaplanan metrikler bölümünde de sözleşmesel spread görüntüleniyor

#### TLREF Tarihsel Veri Senkronizasyonu
- Haziran 2019'dan bugüne **tüm TLREF endeks ve oran verilerinin** tarihsel senkronizasyonu
- `sync-tlref-historical.py` ve `sync-tlref-historical.sh` script'leri eklendi
- Docker container içinde çalıştırma desteği
- Hem endeks (TLREFK) hem günlük oran verisi kaynağı desteği

#### Yaklaşan Kupon Ticker
- Landing sayfasında **"Kupon Ödemesine X Gün Kalanlar"** canlı ticker bileşeni
- API'ye `upcoming_bonds` verisi eklendi (sonraki güne yakın kupon ödemeleri)

#### Versiyon Sistemi
- `lib/constants.ts` üzerinden merkezi versiyon yönetimi
- Dashboard sidebar alt kısmında `v1.2` versiyon gösterimi
- Landing sayfası footer'ında copyright yanında versiyon gösterimi

### 🔧 İyileştirmeler

#### Tipografi & Font Sistemi
- Sayısal veri fontu **JetBrains Mono** → **Inter (tabular-nums)** olarak değiştirildi
- JetBrains Mono'nun "dotted zero" (0'ın ortasında nokta) sorunu kökten çözüldü
- `font-feature-settings: "tnum" 1` ile sayılar hizalı ve temiz render ediliyor
- Sayısal alanlarda `font-weight: 500` ile okunabilirlik artırıldı

#### Arama UI
- Tüm arama input'ları `rounded-full` stile güncellendi
- Input boyutları büyütüldü, padding artırıldı
- Focus durumlarında gelişmiş ring efekti

#### TLREF Veri İşleme
- CSV ayrıştırmada UTF-16 öncelikli, UTF-8-sig fallback encoding desteği
- Header algılama mantığı güçlendirildi
- Günlük bileşik yıllıklaştırılmış oran hesaplaması eklendi (`annualized_rate_pct`)
- Yayınlanan yıllık oran (`published_annual_rate_pct`) takibi

#### Getiri Hesaplama Motoru
- `numpy_financial` bağımlılığı kaldırıldı → saf Python **bisection yöntemi** ile YTM hesaplama
- Kesirli `t_i` kullanımı ile dönem içi settlement'ta doğru iskontolama
- `formatPercent()` fonksiyonu null değer ve dinamik hassasiyet desteği

#### Dashboard UI
- Sidebar ve header logoları ana sayfaya yönlendiren link olarak güncellendi
- Hover geçiş efektleri eklendi
- TLREF widget kaldırılıp dashboard layout sadeleştirildi
- Database refresh mekanizması bonds API'ye eklendi

#### Kupon ve Getiri Hesaplamaları
- Yaklaşan kupon mantığı güncellendi
- Spread metrik gösteriminde `em-dash (—)` yerine boş satır bırakılmaması sağlandı
- Bond yield hesaplamaları iyileştirildi

### 🏗️ Altyapı

#### Next.js 16 Migrasyonu
- Next.js **v16.2.3** (Turbopack) sürümüne yükseltme
- CI/CD workflow dosyaları temizlendi
- `docker-compose` → `docker compose` V2 migrasyonu

#### i18n — Tam Türkçe Lokalizasyon
- Tüm UI metinleri `locales/tr.ts` üzerinden merkezi Türkçe çeviri sistemi
- Dashboard, admin, bonds, settings, alerts, analytics — tüm modüller lokalize
- Namespace yapısı dashboard altında yeniden düzenlendi (`dashboard.*`)

#### Veri Sağlığı & Doğrulama
- KAP bildiri verileri ile tbliste verileri arası otomatik çapraz doğrulama
- `data_conflicts` tablosu ile veri uyuşmazlıkları kullanıcıya gösteriliyor
- `data_sources` ile hangi kaynağın kullanıldığı izleniyor

### 🐛 Hata Düzeltmeleri

- **Font "dotted zero" sorunu**: JetBrains Mono'nun varsayılan sıfır glyph'indeki nokta Inter fontuna geçilerek çözüldü
- **Binlik ayracı noktası**: `formatDecimal` fonksiyonuna `useGrouping: false` eklenerek `tr-TR` locale'inde binlik ayracı devre dışı bırakıldı
- **TLREF CSV encoding**: UTF-16 / UTF-8-sig encoding çakışması düzeltildi
- **Docker script path**: sync-tlref-historical.sh'de Python script yolu düzeltildi
- **Null handling**: Admin sync mesajlarında bond upsert/deactivate count null kontrolleri eklendi
- **DB commit**: Bond view tracking ve hesaplama metrikleri için eksik database commit düzeltildi
- **Maintenance toast**: Bakım modu hata mesajı genel çeviri anahtarına güncellendi

---

## [1.1] — 2026-04-18

### 🚀 Yeni Özellikler

#### Bildirim Sistemi
- Sistem genelinde **bildirim modülü** (notification) altyapısı
- Database destekli bildirim saklama
- Admin panelinden **toplu bildirim yayınlama** (broadcast)
- **Tümünü okundu olarak işaretle** fonksiyonu
- `NotificationBell` bileşeni portal tabanlı overlay ile yeniden tasarlandı
- Özel `formatRelativeTime` utility'si ile zaman gösterimi (date-fns bağımlılığı kaldırıldı)

#### Uyarı Sistemi (Alerts)
- YTM eşiği, TLREF günlük oran ve vadeye kalan gün bazlı **özel uyarılar**
- Uyarı oluşturma, düzenleme, silme ve aktif/pasif yönetimi
- Tetiklenen uyarılar paneli ile geçmiş uyarı takibi

#### Hukuki Sayfalar
- **Gizlilik Politikası**: KVKK uyumlu, kapsamlı yasal metin
- **Kullanım Şartları**: Sorumluluk reddi ve hak saklama bildirimi
- **Çerez Onay Banner'ı**: GDPR uyumlu, kategori bazlı çerez tercihi (temel, analiz, pazarlama)

#### Güvenlik
- **E-posta doğrulama** sistemi: kayıt sonrası doğrulama maili, yeniden gönderme
- **İki Adımlı Doğrulama (2FA)**: TOTP tabanlı, QR kod ve manual secret desteği, yedek kodlar
- Şifre değiştirme ve e-posta değiştirme işlevleri

#### Kullanıcı Yönetimi (Admin)
- Admin panelinde kullanıcı detay modalı (departman, unvan, kullanım amacı)
- Rol değiştirme onay akışı
- Kullanıcı silme ve aktif/pasif yönetimi
- User data background sync mekanizması

#### Onboarding
- Yeni kullanıcı profil tamamlama formu
- Departman, unvan, kullanım amacı ve günlük tahmini inceleme sayısı
- Profil tamamlanmadan dashboard'a erişim engeli

### 🏗️ Altyapı

#### Production Deployment
- Apache2 reverse proxy ile SSL termination
- Docker Compose resource limits (CPU/memory) tüm servislere
- Celery task scheduling (TLREF günlük, hesaplama günlük)
- Sentry hata takibi entegrasyonu (frontend + backend)
- bondley.one domain migrasyonu

---

## [1.0] — 2026-04-10

### 🚀 İlk Sürüm

#### Borçlanma Araçları
- **2.100+** aktif borçlanma aracı (tahvil, bono, kira sertifikası, VDMK)
- ISIN kodu, ihraççı, para birimi, vade, getiri türü bazlı **gelişmiş filtreleme**
- Detay sayfası: genel bilgiler, finansal veriler, tarihler, formüller, KAP verileri
- Kupon ödeme planı tablosu (KAP bildirimlerinden)

#### TLREF Endeks
- BIST TLREF Endeksi tarihsel veri takibi
- Günlük oran ve endeks değeri grafikleri (TradingView entegrasyonu)
- Endeks kayıtları tablosu

#### Hesaplama Motoru
- **Kirli Fiyat** (Dirty Price) hesaplama
- **Birikmiş Faiz** (Accrued Interest) — Act/Act
- **Vadeye Kadar Getiri** (YTM) — Bisection DCF
- **Modifiye Dürasyon** ve **Macaulay Dürasyon**
- **Konveksite** hesaplaması
- **TLREF Şok Senaryosu** (±100bp slider)
- **İhraçtan Bugüne Getiri** hesaplama
- Tarih seçici ile geçmiş tarih bazlı yeniden hesaplama

#### Piyasa Verisi
- BIST'ten otomatik günlük veri çekimi (ZIP/CSV)
- Temiz fiyat, günlük oran değişimi takibi
- KAP (Kamuyu Aydınlatma Platformu) bildirim verisi entegrasyonu
- tbliste vs KAP veri çapraz doğrulama

#### Dashboard
- Genel bakış: TLREF endeks, günlük oran, yıllık bileşik, aktif araç sayısı
- Vade dağılımı (kısa/orta/uzun)
- Vadesi yaklaşan ve yüksek getirili araç listeleri
- En çok görüntülenen araçlar
- Bu ay kullanım istatistikleri

#### Analiz Sayfası
- TLREF tarihsel endeks grafiği
- Günlük oran değişimi grafiği
- Araç türü, getiri türü ve para birimi dağılım analizi

#### Admin Paneli
- Sistem istatistikleri (tahvil, TLREF, kullanıcı sayıları)
- Manuel veri senkronizasyonu tetikleme
- Kullanıcı yönetimi (rol, durum)
- Audit log görüntüleme
- Veri sağlığı kontrol paneli
- Bakım modu açma/kapama
- Metrikler: en çok görüntülenen tahviller, kullanıcı aktivitesi

#### Kimlik Doğrulama
- JWT tabanlı auth (access + refresh token)
- Otomatik token yenileme (silent refresh)
- Oturum yönetimi (tekil / tüm oturumları kapat)

#### Teknik Altyapı
- **Frontend**: Next.js 16 (Turbopack), React, TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery
- **Monorepo**: Turborepo ile web + API ortak yönetim
- **Docker Compose**: Tüm servisler containerized
- **Europe/Istanbul** timezone desteği
- Resilient API client (retry + backoff + dedup)

---

_Bondley — Kurumsal Borçlanma Araçları Değerleme Platformu_  
_© 2026 Bondley · İstanbul, Türkiye_
