# KAP zenginleştirme işletim kılavuzu

KAP hattı, BIST `tbliste` ve TLREF/TLREFK hattından bağımsız bir zenginleştirme
işidir. KAP erişilemezse API readiness ve ilk bootstrap başarısız olmaz.

## Kaynak ve sıklık

- 08:00–23:00 Türkiye saatinde en erken 15 dakikada bir artımlı sorgu yapılır.
- 23:00–08:00 arasında aynı görev en erken saatte bir çalışır.
- 00:30 görevi son üç takvim gününü (bugün ve önceki iki gün) uzlaştırır.
- 16:45 görevi, 16:30 BIST benchmark güncellemesinden sonra türetilmiş terimleri
  yeniden doğrular.
- 17:00 görevi, aktif TLREF/TLREFK kıymetlerinde BIST açıklamasında sayısal
  spread bulunmayanları öncelikli tarihsel backfill kuyruğuna alır.
- Backfill kuyruğu her dakika tek bir ISIN işler. Kullanıcı eksik spreadli bir
  kıymeti açarsa aynı benzersiz kuyruk kaydı öncelik `0` ile öne alınır ve
  worker hemen dürtülür; aynı ISIN için paralel istek üretilmez.
- Arayüz kuyruk durumunu iki saniyede bir izler. `QUEUED`, `RUNNING` veya
  `RETRY` sürerken doğrulanmamış `%0` spread hesabını göstermez. Sözleşmesel
  spread doğrulanamazsa değerleme `CONTRACTUAL_SPREAD_NOT_VERIFIED` ile
  durdurulur; `%0` spread sonucu üretilmez.

Liste çağrısı KAP web arayüzünün kullandığı tarih aralıklı public sorgudur.
Yalnız borçlanma aracı, kupon/getiri ve kira sertifikasıyla ilgili sonuçların
detayları alınır. Kurumsal kullanım için KAP/Borsa İstanbul'un yetkili veri
servisi ve sözleşmesi mevcutsa public URL yerine o servis tercih edilmelidir.

## Üretim değişkenleri

```dotenv
KAP_INGESTION_ENABLED=true
KAP_PUBLIC_LIST_URL=https://www.kap.org.tr/tr/api/disclosure/members/byCriteria
KAP_PUBLIC_DETAIL_URL_TEMPLATE=https://www.kap.org.tr/tr/Bildirim/{disclosure_id}
KAP_PROXY_URLS=http://user:password@proxy-a.example:8080,http://user:password@proxy-b.example:8080
KAP_PROXY_AUTO_REFRESH_ENABLED=false
KAP_PROXY_REFRESH_HOURS=24
KAP_PROXY_MAX_POOL_SIZE=10
KAP_PROXY_REQUIRE_PROXY=false
KAP_REQUEST_INTERVAL_SECONDS=2.0
KAP_REQUEST_JITTER_MIN_MS=250
KAP_REQUEST_JITTER_MAX_MS=750
KAP_HTTP_TIMEOUT_SECONDS=30
KAP_MAX_DETAILS_PER_RUN=50
KAP_ACTIVE_POLL_MINUTES=15
KAP_NIGHT_POLL_MINUTES=60
```

Proxy zorunlu değildir. Kimlik bilgileri yalnız sunucudaki `.env` içinde
tutulmalı ve repoya yazılmamalıdır. Loglarda kullanıcı adı/parola maskelenir.
Liste boşsa doğrudan bağlantı kullanılır; en az bir proxy tanımlandığında
istemci doğrudan çıkışa sessizce dönmez ve yalnız listedeki proxyleri kullanır.

`KAP_PROXY_AUTO_REFRESH_ENABLED=true` olduğunda ProxyScrape public API'sinden
yalnız HTTPS tünellemeyi destekleyen, elite HTTP proxyleri alınır. Havuz her gün
03:10'da ve 24 saatlik cache süresi dolduğunda yenilenir. Kaynaktan gelen
hostname, credential, private, loopback, link-local ve desteklenmeyen protokol
kayıtları reddedilir; en fazla 10 global IP tutulur. Public proxyler güvenilir
altyapı sayılmaz ve yalnız halka açık KAP içeriği için kullanılır.

## Trafik ve hata politikası

- Tüm doğrudan/proxy rotaları tek limiter ve tek eşzamanlı istek kullanır.
- Proxy yalnız DNS, bağlantı veya TLS gibi transport hatasında değiştirilir.
- `429` geldiğinde `Retry-After` bütün havuz için uygulanır; başka proxyye
  geçilmez.
- `403` bir saatlik circuit-open durumudur ve başka proxy denenmez.
- `5xx` aynı rota üzerinde 30 saniye, 2 dakika ve 10 dakika beklemeyle yeniden
  denenir.
- Aynı anda iki Celery görevinin KAP'a çıkmasını PostgreSQL advisory lock
  engeller.
- Artımlı tarama, kontrollü tek bildirim çekimi ve hedefli tarihsel tarama aynı
  advisory locku kullanır; böylece farklı worker süreçleri de KAP alan adına
  paralel çıkamaz. Hedefli kuyruğun kendisi tek tüketicili ve önceliklidir.
- Bildirim gövdesi SHA-256 ile immutable arşivlenir; bildirim kimliği tekrar
  işlenmez.

## Veri ve hesap önceliği

1. Aynı ödeme tarihine ait KAP dönemsel kupon oranı.
2. KAP metnindeki açık yıllık basit ek getiri.
3. En az iki KAP kuponundan aynı çıkan spread (`KAP_MULTI_COUPON_VERIFIED`).
4. Tek KAP kuponundan doğrulanan spread (`KAP_SINGLE_COUPON_DERIVED`).
5. BIST `tbliste` açıklamasındaki açık spread.
6. Spread bulunamazsa değerleme durur; bilinmeyen spread sıfır kabul edilmez.

Hedefli backfill, `tbliste` içindeki ihraç/vade/kupon sıklığı/sonraki kupon
tarihinden geçmiş ödeme tarihlerini deterministik çıkarır. Her ödeme için
`T-2 … T+1` KAP liste penceresi sorgulanır; yalnız metadata içinde tam ISIN
bulunan kupon/oran bildirimleri indirilir. En fazla iki ilgili detay alınır ve
türetim yalnız istenen ISIN üzerinde çalışır.

`TRD` ile başlayan kıymetler yalnız `TLREFK`; diğer referanslı kıymetler AST
benchmark tanımına göre `TLREF` veya `TLREFK` kullanır. `kap-spread-t1-v2`
türetimi, doğrulanmış mevcut kıymetlerde yalnız sözleşmesel T-1 sınır
gözlemlerini kullanır. Hedef gözlem yoksa daha eski tarihe düşmez; bir baz
puana yuvarlanan spread KAP'ın gösterim hassasiyeti içinde kuponu yeniden
üretmeden yayımlanmaz.

Eski `(T,T-1,T-2)` aday seçimiyle yayımlanmış aktif terimler sürüm dışı kabul
edilir. 17:00 eksik/stale spread taraması veya kullanıcının kıymeti açması bu
ISIN'i yeniden kuyruğa alır. Yeni terim başarılı yayımlanana kadar eski spread
API'de kullanılmaz.

## Değerleme v3 üretim geçişi

- Yeni istekler `valuation-engine-v3.0.0` ile immutable sonuç kaydı oluşturur.
- Eski değerleme kayıtları silinmez veya yerinde değiştirilmez; motor sürümüyle
  denetim izi olarak korunur.
- Deploy sonrası worker loglarında `kap-spread-t1-v2` backfill kuyruğu ve API
  sonuçlarında `accrued_method=BIST_BAP_4_4_INDEX_CHANGE` kontrol edilir.
- Geri dönüş gerekirse önceki uygulama imajına dönülür. Şema değişikliği
  olmadığı ve eski sonuçlar değiştirilmediği için veri geri alma işlemi
  gerekmez.

## İlk devreye alma

```bash
cd /home/admin/bondley.one
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 celery-worker celery-beat
```

Migration `002_kap_enrichment` dört KAP kanıt tablosunu,
`003_kap_backfill_queue` ise benzersiz ISIN backfill kuyruğunu ekler. İlk deployda
`KAP_INGESTION_ENABLED=false` ile migration ve servis sağlığı doğrulanabilir;
sonra `.env` değeri `true` yapılarak yalnız worker ve beat yeniden
oluşturulabilir:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate celery-worker celery-beat
```

Admin panelindeki “KAP zenginleştirme” alanı bildirim, kupon olayı, aktif terim
ve çelişki sayılarını gösterir. KAP sorunu bootstrap/readiness sorunu olarak
yorumlanmamalıdır.

Kontrollü ilk tarihsel yüklemede bildirim kimlikleri admin uç noktasına tek tek
verilir; istek yalnız Celery kuyruğuna yazar:

```text
POST /api/v2/operations/kap/disclosures/{disclosure_id}
```

Genel son üç gün uzlaştırması için:

```text
POST /api/v2/operations/kap/poll
```

Kuyruk ve worker denetimi:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select isin,status,priority,attempt_count,requested_at,completed_at from kap_backfill_requests order by priority,requested_at;"
docker compose -f docker-compose.prod.yml logs --tail=200 celery-worker celery-beat
```
