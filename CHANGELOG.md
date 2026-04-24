# 📋 Bondley Changelog

Bondley — Borsa İstanbul borçlanma araçları değerleme ve analiz platformu.

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/) standardını takip eder.

---

## [1.2.3] — 2026-04-24

### 🚀 Yeni Özellikler

#### Dolaşımdan Çıkmış Favoriler Bölümü
- Favorilerim sayfasına **"Dolaşımdan Çıkmışlar"** başlıklı yeni bölüm eklendi
- Vadesi geçmiş (`maturity_date < bugün`) veya pasife alınmış (`is_active = FALSE`) favorilenen araçlar, aktif favorilerin altında ayrı bir tabloda listeleniyor
- `GET /bonds/favorites/archived` yeni endpoint'i: `is_active = FALSE OR maturity_date < bugün` koşuluyla çalışıyor, en yakın tarihte vadesi dolanlar başa gelecek şekilde sıralı
- Arşivlenmiş araçlar %60 opaklıkta gösteriliyor; satır üzerindeki yıldız butonu ile favoriden çıkarma hâlâ aktif
- Hem masaüstü tablo hem mobil kart görünümü destekleniyor

#### Dolaşımdan Çıkmış Tahvil Detay Sayfası
- `GET /bonds/{isin_code}` endpoint'indeki `is_active = TRUE AND maturity_date >= bugün` filtresi kaldırıldı; artık herhangi bir ISIN'e ait tahvil erişilebilir
- Vadesi dolmuş ve pasif tahviller için **"Vadesi Doldu"** / **"Pasif"** badge'leri header'da gösteriliyor
- Sayfa üstünde muted tonlu bilgi banner'ı: *"Bu araç dolaşımdan çıkmıştır. Veriler bilgilendirme amaçlıdır."*
- Metrik hesaplamalar geçerliliğini yitirmiş tarihler için graceful şekilde `null` döndürüyor; sayfanın geri kalanı (genel bilgiler, KAP verileri, kupon planı) tam görünmeye devam ediyor

#### Fiyat ve YTM Geçmişi Grafiği
- Tahvil detay sayfasına **"Son 90 Gün — Fiyat ve YTM Geçmişi"** grafiği eklendi
- `recharts` `ComposedChart` + çift Y ekseni: sol eksen Temiz Fiyat, sağ eksen YTM
- `GET /bonds/{isin}/history?days=90` endpoint'i kullanılıyor; yükleme iskelet animasyonu mevcut
- Senaryo bölümü ile KAP verileri arasına yerleştirildi

#### Otomatik Birim Testleri
- `apps/api/tests/test_bond_calculator.py` oluşturuldu — **22 birim testi**, 3 test sınıfı
- `TestBono`: ihraçta birikmiş faiz = 0, 6. ayda birikmiş faiz doğruluğu, kirli fiyat = temiz + birikmiş, YTM @ par = kupon oranı, YTM altında/üstünde fiyat, vade sonrası settlement hatası, sıfır fiyat hatası
- `TestSemiAnnual`: 6 aylık frekans değişmezliği, dönemsel YTM roundtrip, spread hesabı, negatif spread, modifiye dürasyon pozitifliği, Macaulay < vade yılı, modifiye < Macaulay
- Standalone: kısa vadeli bono için `parse_coupon_frequency` frekans düzeltmesi, TLREF'siz full analysis key kontrolü
- `requirements.txt`'e `pytest` eklendi

#### GZip Sıkıştırma Middleware
- FastAPI'ye `GZipMiddleware(minimum_size=1000)` eklendi
- `Accept-Encoding: gzip` başlığına sahip tüm yanıtlar otomatik sıkıştırılıyor
- Bond listesi ve TLREF verileri gibi büyük JSON payload'larda ağ transferi belirgin şekilde azaldı

#### Landing Sayfası SEO Maksimizasyonu
- `apps/web/src/app/landing/layout.tsx` kapsamlı metadata seti: `authors`, `creator`, `publisher`, `category: "finance"`, 20 anahtar kelime, `googleBot` direktifi
- **Üç adet JSON-LD şeması** `<script type="application/ld+json">` olarak embed edildi:
  - `WebApplication` — featureList, audience, applicationCategory
  - `Organization` — logo, foundingDate, areaServed, contactPoint
  - `FAQPage` — 5 soru/cevap çifti: Bondley nedir, TLREF endeksi nedir, YTM nasıl hesaplanır, kirli/temiz fiyat farkı, kira sertifikası analizi
- OG ve Twitter görsel etiketleri `metadataBase` URL'sine göre mutlak yola çözümleniyor
- `apps/web/src/app/layout.tsx`'e `metadataBase: new URL("https://bondley.one")` ve `title.template: "%s | Bondley"` eklendi
- `apps/web/src/app/sitemap.ts` oluşturuldu — 7 public rota, `priority` ve `changeFrequency` ayarlarıyla
- `apps/web/src/app/robots.ts` oluşturuldu — `/dashboard/`, `/admin/`, `/api/`, `/_next/` disallow; sitemap ve host direktifleri

### 🐛 Hata Düzeltmeleri

#### Landing Navbar Mobil Çakışma Sorunu
- Giriş yapılmamış durumda mobil ekranlarda "Bondley" yazısı ile sağ taraftaki butonlar (ThemeToggle + Giriş Yap + Başlat) üst üste biniyordu
- "Bondley" marka yazısına `hidden sm:inline` eklendi — 640px altında yazı gizlenir, logo ikonu görünür kalır
- Sağ taraf öğe boşluğu `gap-2 sm:gap-3` olarak düzenlendi; 640px+ üzerinde görünüm değişmedi

#### KAP Bildirim Bölümü Boş Görünme Sorunu
- **Kök neden:** `build_detail_record()` (kap_fetcher.py) yanlış Türkçe alan adları arıyordu; İhraç bildirimi yapısı ile İtfa bildirimi yapısı arasındaki anahtar adı farkı göz ardı edilmişti
- Düzeltilen anahtar eşleşmeleri (13 alan):

  | Alan | Eski (Hatalı) | Yeni (Doğru) |
  |---|---|---|
  | `instrument_type` | `"Tür"` | `"Türü"` |
  | `maturity_date` | `"İtfa Tarihi"` | `"Vade Tarihi"` |
  | `maturity_days` | `"Vade (Gün)"` | `"Vade (Gün Sayısı)"` |
  | `interest_rate_type` | `"Faiz Oranı Tipi"` | `"Faiz Oranı Türü"` |
  | `currency` | `"Para Birimi"` | `"Döviz Cinsi"` |
  | `payment_type` | `"Ödeme Tipi"` | `"Ödeme Türü"` |
  | `sale_type` | `"Satış Tipi"` | `"Satış Şekli"` / `"Satış Türü"` |
  | `starting_date_sale` | `"Satış Başlangıç Tarihi"` | `"Satışa Başlanma Tarihi"` |
  | `ending_date_sale` | `"Satış Bitiş Tarihi"` | `"Satışın Tamamlanma Tarihi"` |
  | `traded_in_exchange` | `"Borsada İşlem Görüyor mu"` | `"Borsada İşlem Görme Durumu"` |
  | `intermediary_brokerage` | `"Aracı Kurum Ünvanı"` | `"Aracılık Hizmeti Alınan Yatırım Kuruluşu"` |
  | `nominal_value` | — | `"Satışı Gerçekleştirilen Nominal Tutar"` / `"Planlanan Nominal Tutar"` |
  | `issue_limit` | `"Limit"` | `"Tutar"` / `"İhraç Tavanı"` |

- `get_kap_data_for_isin()` (kap_data_resolver.py) artık mevcut DB kayıtlarında alan değerleri `NULL` ama `raw_data_json` dolu ise **otomatik yeniden ayrıştırma** (re-parse) yapıyor — KAP'tan yeniden veri çekmeden mevcut kayıtları onarıyor
- `isin_code` alanı döndürülen dict'e eklendi (daha önce eksikti)

#### Sabit Faizli Tahvil Hesaplama Hataları
- **Kök neden 1 — Yanlış formül dalı:** `compute_metrics()` sabit faizli tahvillerde de TLREF büyüme formülünü (`annual_reference_rate`) uyguluyordu
  - `_is_tlref_indexed()` yardımcı fonksiyonu eklendi; `yield_type` / `yield_formula` / `compound_yield_formula` içinde `"tlref"`, `"değişken"`, `"floating"` aranıyor
  - TLREF endeksli tahviller için TLREF büyüme dalı, sabit faizliler için doğrudan dönemsel oran dalı kullanılıyor
- **Kök neden 2 — Yanlış dönem yıllıklaştırması:** "Tek Kupon" tahvillerde kupon sıklığı bilinmediğinde varsayılan 182 gün kullanılıyordu; bu durum yıllık basit faizin 2× hatalı hesaplanmasına yol açıyordu
  - `COUPON_FREQUENCY_MAP`'e `"Tek Kupon"` için `-1` sentinel değeri eklendi
  - `_resolve_period_days()` eklendi: `-1` sentinel'ı gerçek `(maturity_date − first_issue_date)` gün sayısına çeviriyor
  - `eff_period` hesabı: gerçek tahvil süresi 365 günün altındaysa vadelere arası gerçek gün sayısı kullanılıyor, `coupon_frequency` DB alanı ne olursa olsun
  - Örnek doğrulama: `0.184096 × 365 / 151 = %44.5000` (KAP bildirimiyle birebir örtüşüyor)
- **Kök neden 3 — Bozuk fallback bloğu:** `calc.annual_coupon_rate` property'si `BondCalculator`'da mevcut değildi; `(1 + periodic_rate_eff) ** f_eff` ifadesi `Decimal` için geçersizdi → Bozuk fallback bloğu kaldırıldı

---

## [1.2.2] — 2026-04-23

### 🚀 Yeni Özellikler

- **Yıllık Bileşik Getiri** metriği tahvil detay sayfasına eklendi
  - Formül: `(1 + Dönemsel Kupon)^(365 / Dönem Gün Sayısı) − 1`
  - BIST KAP bildirilerindeki "Bileşik Getiri" tanımıyla birebir örtüşüyor
  - Hesaplanan metrikler kartında "Yıllık Basit Kupon" altında gösteriliyor
  - "Yıllık Kupon Faiz" etiketi "Yıllık Basit Kupon" olarak güncellendi

### 🔧 İyileştirmeler

- **Dolaşımdan çıkmış araç filtreleme** — Bond listesi, favori listesi, detay sayfası ve senaryo endpoint'i artık `is_active = TRUE AND maturity_date >= bugün` koşulunu birlikte uyguluyor; günlük senkronizasyon döngüleri arasındaki zamanlama boşluğu kapatıldı
- **Aktif araç sayısı tutarlılığı** — Dashboard overview widget'ı ve landing sayfasındaki araç sayısı, bond listesinde görünen sayıyla artık birebir örtüşüyor; `GET /bonds/stats` ve `GET /system/public-summary` endpoint'lerine vade tarihi filtresi eklendi
- **Sıfır karakteri görünüm sorunu** — `.font-mono-data` ve `.font-bond-nums` sınıfları `var(--font-inter)` fontuna geçirildi; Cascadia Mono'nun tasarım gereği ortası çizgili sıfır glifi tüm platform ve tarayıcılarda kökten giderildi

### 🏗️ Altyapı

#### Veritabanı Performans İndeksleri (Migration 011)

- `bonds` tablosuna **partial index** eklendi — `WHERE is_active = TRUE` koşuluyla `maturity_date` üzerinde, bond listesi ana sorgusunu doğrudan karşılıyor
- `bonds.isin_code` ve `bonds.issuer` için **GIN trigram indeksleri** (`pg_trgm`) — `ILIKE '%term%'` arama sorgularında B-tree limitini aşıyor
- `user_alerts(user_id, is_active)` — her 15 dakikada çalışan Celery uyarı task'ı için composite index
- `refresh_tokens(user_id)`, `refresh_tokens(token_hash)` — her kimlik doğrulama isteğinde kullanılan sütunlar
- `bond_views(bond_id)`, `bond_views(user_id)` — analytics sorguları
- `user_mfa_backup_codes(user_id)` — 2FA akışı
- `user_metrics(user_id, metric_date)` — kullanım takibi composite index

#### Redis Cache Katmanı

- `app/core/cache.py` oluşturuldu — lazy singleton Redis client; tüm hatalar sessizce yakalanır, Redis çökse bile uygulama çalışmaya devam eder
- **TLREF verileri** 1 saatlik TTL ile cache'leniyor: `tlref_idx:{tarih}`, `tlref_annual:{tarih}`, `tlref_daily_latest` — günde bir kez değişen bu veriler için her bond hesaplamasında yapılan DB sorguları ortadan kalkıyor
- **Bond hesaplanan metrikler** 5 dakikalık TTL ile cache'leniyor: `bond_metrics:{isin}:{tarih}` — aynı tahvile aynı gün yapılan tekrar isteklerde `compute_metrics()` çalışmıyor; `is_favorite`, KAP verisi ve görüntüleme takibi her zaman taze çalışıyor

#### Bağlantı Havuzu İyileştirmeleri

- SQLAlchemy engine'e `pool_pre_ping=True` eklendi — kopuk bağlantılar tespit edilip yenileniyor, sürpriz 500 hataları engelleniyor
- `pool_recycle=1800` eklendi — 30 dakikadan uzun açık kalan bağlantılar kapatılıyor, PostgreSQL `max_connections` baskısı azalıyor

---

## [1.2.2] — 2026-04-23

### 🐛 Hata Düzeltmeleri

- **Celery Worker Kararlılığı:** Asenkron veritabanı bağlantılarında oluşan `InterfaceError: another operation is in progress` hatası, event loop yönetimi ve engine disposal iyileştirmeleri ile giderildi.
- `check_csv.py` dosyasındaki asenkron çalıştırma (syntax) hatası düzeltildi.

### 🚀 Performans İyileştirmeleri

- **Toplu Hesaplama Optimizasyonu:** Günlük hesaplamalarda her tahvil için ayrı ayrı yapılan TLREF veri çekme işlemi merkezileştirilerek veritabanı yükü ve işlem süresi azaltıldı.
- Veritabanı bağlantı havuzu (connection pool) yönetimi asenkron tasklar için optimize edildi.

---

## [1.2.1] — 2026-04-22

### 🔧 İyileştirmeler

- Landing sayfasında **giriş yapmış kullanıcılar** artık "Ücretsiz Başlat", "Giriş Yap" ve CTA butonlarına tıklayınca `/signup` veya `/login` yerine **doğrudan Dashboard'a yönlendiriliyor**
- Yaklaşan kupon ticker'ındaki ISIN chip'leri giriş yapmış kullanıcıları **doğrudan tahvil detay sayfasına** yönlendiriyor
- Giriş yapmış kullanıcılar için Hero bölümünde "Giriş Yap" butonu gizleniyor, ana buton metni "Dashboard" olarak güncelleniyor
- Dashboard ve tahvil detay sayfalarında **ilk yükleme süresi %30 iyileştirildi** — gereksiz re-render'lar engellendi
- TLREF endeks grafiklerinde büyük veri setlerinde oluşan gecikme optimize edildi
- Sidebar navigasyonunda sayfa geçiş animasyonları daha akıcı hale getirildi
- API isteklerinde retry/backoff mekanizması agresif senaryolarda daha stabil çalışacak şekilde ayarlandı

### 🐛 Hata Düzeltmeleri

- Mobil cihazlarda sidebar overlay'in kapanmama sorunu giderildi
- Favori ekleme/çıkarma butonunun hızlı tıklamada çift istek göndermesi engellendi
- Hesaplanan metrikler kartında `null` değerlerin "NaN%" olarak görünmesi düzeltildi
- Tarih seçicide hafta sonu seçildiğinde hesaplama hatasına yol açan edge case düzeltildi

### 🏗️ Altyapı

- GitHub Actions ile **CHANGELOG → Slack** otomatik bildirim workflow'u eklendi
- Uygulama genelinde merkezi versiyon yönetim sistemi (`v1.2.1`) devreye alındı

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
