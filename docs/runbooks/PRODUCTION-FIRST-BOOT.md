# Production First-Boot Runbook

## 1. Ön koşullar

- Sunucuda güncel Docker Engine ve `docker compose` eklentisi bulunmalı.
- Host Apache/TLS, `127.0.0.1:3050` hedefine yönlenmeli. Kurulum için
  `docs/runbooks/AUTO-DEPLOY-APACHE.md` izlenmeli.
- Borsa İstanbul kaynaklarına HTTPS/DNS çıkışı açık olmalı.
- `.env.example`, `.env` olarak kopyalanmalı; placeholder kalmamalı.
- `BIST_HOLIDAYS`, ilgili yılın BIST tam gün kapanışlarıyla güncellenmeli.

`./deploy.sh` secret varlığını ve Compose çözümlemesini daha image oluşturmadan
kontrol eder. API ve bootstrap üretim modunda zayıf JWT, varsayılan DB parolası,
geçersiz MFA anahtarı veya 12 karakterden kısa ilk admin parolasıyla açılmaz.

## 2. Tarih çözümleme

Tüm takvim kararları `Europe/Istanbul` ile alınır:

- Cumartesi/pazar: önceki iş günü.
- Sabit resmî tatil veya `BIST_HOLIDAYS`: önceki iş günü.
- İş günü 16:05’ten önce: önceki iş günü.
- İş günü 16:05 ve sonrası: o gün.

Bu tarih `requested_business_date` olarak her kaynak kaydına yazılır.
`effective_date` mümkün olduğunda dosya adı veya içerikten gelir. Böylece tarih
“bugün indirildi” bilgisinden tahmin edilmez. Kesim saatinden önce arşiv içindeki
dosya adı takvim gününü gösteriyorsa bu tarih doğrudan yayımlanmaz:
`date_origin=CUTOFF_CAPPED_SOURCE_FILENAME` ile kaynak metadatası korunur ve
`effective_date`, çözümlenen önceki BIST iş gününe sabitlenir.

## 3. İlk açılış sırası

`migrate` tek-seferlik container’ı Alembic `001` şemasını kurar. Başarı olmadan
bootstrap başlamaz. `bist-source-init`, kalıcı ham-veri volume'unu API
kullanıcısına yazılabilir hale getirir. Bootstrap PostgreSQL advisory lock alır;
aynı anda iki import çalışamaz. Bootstrap ve veri çeken worker, veritabanının
izole backend ağından ayrı bir egress ağıyla yalnız dış kaynaklara çıkar.

Bootstrap sırası:

1. TLREF tarihsel oran + endeks.
2. TLREFK tarihsel oran + endeks.
3. TLREF günlük dosyası: yayımlanmış yıllık oran + endeks.
4. TLREFK günlük dosyası: yayımlanmış yıllık oran + endeks.
5. `tbliste.zip`.

Tarihsel benchmark endeksi yayımlanan oranlardan yeniden kurulur ve tolerans
dışındaki fark kalite kapısını düşürür. `tbliste` ZIP traversal, şifreli arşiv,
magic-byte, boyut ve zip-bomb kontrollerinden geçer. 33 sütun, ikinci referans
sayfası ve sonda yer alan açıklamalar ham satır olarak saklanır.

## 4. Yayın kuralları

- `CURRENT`: içerik beklenen iş gününe ait.
- `STALE`: içerik daha eski; veri korunur, bootstrap `DEGRADED` olabilir.
- `HISTORICAL`: tarihsel arşiv.
- `FUTURE`: kesim-saati kuralıyla açıklanamayan ileri tarih reddedilir.

Yeni import parse/kalite kapısını geçmeden yayımlanan snapshot değişmez. Daha
eski tarih mevcut yeni snapshot’ın üzerine yazılamaz. Aynı hash + parser sürümü
idempotent biçimde `already_published` döner.

TRD kıymetlerinde açık TLREF ifadesi TLREFK beklentisiyle çelişirse otomatik
değerleme kapatılır. Birimsiz spread tahmin edilmez; ham açıklama, normalize
metin, AST ve diagnostics birlikte saklanır.

## 5. Açılış doğrulaması

```bash
docker compose -f docker-compose.prod.yml ps --all
docker logs bondley-migrate
docker logs bondley-bootstrap
curl -fsS http://127.0.0.1:3050/health/live
curl -fsS http://127.0.0.1:3050/health/ready
./scripts/health-check.sh
```

Readiness cevabında `bootstrap_status`, `published_instruments`,
`benchmark_observations`, `requested_business_date` ve `completed_at`
görülmelidir.

## 6. Hata yönetimi

Migration başarısızsa API açılmaz. Migration logunu düzeltmeden şemayı elle
oluşturmayın.

Bootstrap indirme hatasında:

1. Kaynak URL/DNS/TLS erişimini kontrol edin.
2. `bondley-bootstrap` logunda başarısız adımı bulun.
3. Admin `/admin/import` ekranından veya şu komutla yeniden çalıştırın:

```bash
docker compose -f docker-compose.prod.yml run --rm bootstrap
```

Kalite kapısı hatasında dosyayı elle düzeltip yayımlamayın. Ham hash, diagnostics
ve parser sürümüyle inceleyin. Önceki yayımlanmış veri yerinde kalır.

## 7. Yedek ve geri dönüş

Deploy öncesi:

```bash
./scripts/backup_db.sh
```

Image geri dönüşü image tag’i sabitlenerek yapılır. Veritabanını geri yüklemek
ayrı ve onay gerektiren bir operasyondur; otomatik deploy scripti veri silmez,
volume düşürmez ve migration downgrade çalıştırmaz.
