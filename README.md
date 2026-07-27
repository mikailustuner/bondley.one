# Bondley

Bondley, Borsa İstanbul’un resmî `tbliste`, TLREF ve TLREFK dosyalarını değişmez
ham kaynak olarak arşivleyen; terimleri açıklamalardan ayrıştıran ve yalnız açık
BIST fiyat bazına göre 100 temiz/kirli fiyat senaryosuyla otomatik teorik
değerleme yapan bir borçlanma araçları uygulamasıdır.

KAP, temel BIST bootstrap/readiness hattını engellemeyen asenkron bir doğrulama
katmanıdır. Eksik değişken-kupon spreadleri resmî geçmiş kuponlardan ve
TLREF/TLREFK endekslerinden doğrulanır; doğrulama sürerken sıfır-spread sonucu
nihai değerleme gibi gösterilmez. Son ihraç fiyatı piyasa fiyatı sayılmaz.
`TRD` ile başlayan katılım kıymetleri TLREFK kullanır. Yayımlanmış değer, cari
projeksiyon ve gelecek kupon senaryosu birbirinden ayrılır; ayrıntılı sözleşme
[değerleme doğruluk matrisinde](docs/VALUATION-ACCURACY-MATRIX.md) tanımlanır.

## Üretim ilk açılışı

```bash
cp .env.example .env
./scripts/generate_secrets.sh
# Üretilen değerleri ve domain/SMTP ayarlarını .env içine girin.
./deploy.sh
```

Deploy sırası tek ve deterministiktir:

```text
PostgreSQL hazır
  → Alembic 001 temiz şema
  → tek-seferlik bootstrap
     → TLREF geçmiş
     → TLREFK geçmiş
     → TLREF günlük
     → TLREFK günlük
     → tbliste
  → API / worker / beat
  → web
  → iç Nginx ağ geçidi (:3050)
```

Bootstrap `Europe/Istanbul` saatini kullanır. Hafta sonu, resmî tatil ve iş günü
16:05’ten önceki ilk açılışta önceki BIST iş günü beklenir. Örneğin pazartesi
14:00’te veri tarihi son cuma olarak çözülür. Arşiv üyesinin adı pazartesi
tarihini taşısa bile snapshot kesim saatinden önce pazartesiye yazılmaz; dosya
tarihi kaynak metadatasında, etkin tarih cuma olarak saklanır. Kaynak içeriği
beklenen tarihten eskiyse `STALE`; eski snapshot yeni verinin üzerine
yayımlanmaz.

Kullanıma açılma koşulu `/health/ready` yanıtının 200 dönmesidir. Bu uç, şema
migration’ı ile bootstrap’ın `READY` veya `DEGRADED` sonucunu ve kullanılabilir
kıymet/benchmark verisini denetler.

## Yerel geliştirme

Web:

```bash
npm ci
npm run dev --workspace @fincalc/web
```

API bağımlılıkları ve test:

```bash
cd apps/api
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## Doğrulama

```bash
python3 -m compileall -q apps/api/app apps/api/tests
npm exec tsc --workspace @fincalc/web -- --noEmit --incremental false
npm run build --workspace @fincalc/web
docker compose -f docker-compose.prod.yml config --quiet
```

Resmî tam dosya denetimi `BIST_AUDIT_FIXTURE_DIR` ile çalışır:

```bash
cd apps/api
BIST_AUDIT_FIXTURE_DIR=/path/to/bist-audit pytest -q \
  tests/test_verified_real_bist_fixtures.py
```

26.07.2026 kanıt manifesti 24.07.2026 `tbliste` dosyasında 2.136 satır,
2.135 tekil ISIN, 4 kaynak açıklaması, 30 grup kodu, 18 sınıflandırma ve tek
çelişkili duplicate bekler. TLREF ve TLREFK geçmişleri endeks rekonstrüksiyonuyla
ayrı ayrı doğrulanır.

## Operasyon

- Admin import görünümü: `/admin/import`
- Liveness: `/health/live`
- Readiness ve bootstrap durumu: `/health/ready`
- Yedek: `./scripts/backup_db.sh`
- Sağlık kontrolü: `./scripts/health-check.sh`
- Ayrıntılı ilk açılış/arıza prosedürü:
  [docs/runbooks/PRODUCTION-FIRST-BOOT.md](docs/runbooks/PRODUCTION-FIRST-BOOT.md)
- Main auto-deploy ve Apache kurulumu:
  [docs/runbooks/AUTO-DEPLOY-APACHE.md](docs/runbooks/AUTO-DEPLOY-APACHE.md)

Ham kaynaklar `bist_source_data`, PostgreSQL verisi `postgres_data` Docker
volume’unda saklanır. İç Nginx yalnız HTTP `3050` yayınlar; TLS host proxy/load
balancer katmanında sonlandırılır.
