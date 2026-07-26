# BIST Doğrulanmış Yeniden Yazım Planı

Durum (26.07.2026): **Faz 0–11 uygulandı; son doğrulama çıktıları README’de tutulur.**

## Kapsam kararları

- Resmî BIST `tbliste`, TLREF ve TLREFK kaynakları değişmez ham dosya olarak saklanır.
- KAP temel veri/değerleme akışının dışında tutulur.
- İlk sürümde değerleme fiyatı/getirisi yalnız açık kullanıcı girdisidir.
- Son ihraç fiyatı piyasa fiyatı değildir.
- `TRD` ailesinde değişken referans TLREFK’dir; TLREF ile karıştırılmaz.
- Belirsiz/çelişkili terimler görüntülenebilir fakat otomatik değerlenemez.
- Kullanıcı, favori ve not verileri korunur.

## Fazlar

1. **Faz 0 — Kanıt seti:** Mevcut davranış envanteri, resmî fixture ve karar kayıtları.
2. **Faz 1 — Ham import:** Checksum, güvenli ZIP, source/import/raw/diagnostic modeli.
3. **Faz 2 — tbliste parserı:** 33 sütun, iki sayfa, footer/not ve conflict motoru.
4. **Faz 3 — Açıklama AST:** Benchmark, spread/birim, lag, kupon rejimi ve güven durumu.
5. **Faz 4 — TLREF/TLREFK:** Günlük+tarihsel oran/endeks, iş günü `g`, rekonstrüksiyon.
6. **Faz 5 — Finansal çekirdek:** Decimal, takvim/day-count, formül dispatcher, typed failure.
7. **Faz 6 — v2 şema/API:** Fiyat gözlemi, değerleme kayıtları, provenance ve kullanıcı geçişi.
8. **Faz 7 — Web:** Kaynak/AST/değerleme ayrımı, fiyat formu ve kalite ekranları.
9. **Faz 8 — Operasyon UI:** Bootstrap/import gözlemi, tazelik ve hata tanıları.
10. **Faz 9 — Üretim:** Tek migration, ilk-açılış bootstrap, readiness ve deploy.
11. **Faz 10 — Doğrulama:** Resmî fixture, unit/integration, TypeScript/build/Compose.
12. **Faz 11 — Temizlik:** Legacy/KAP/canary/scratch ve yinelenen dosyaların kaldırılması.

## Kabul kriterleri

- 33 sütun ve kaynak notları kayıpsızdır.
- Çelişkili ISIN ezilmez.
- Birimsiz spread tahmin edilmez.
- TLREF/TLREFK ayrı ve tam doğrulanır.
- Kuponlar `365 // frequency` ile üretilmez.
- Eksik fiyat/benchmark/takvim `0` sonucu üretmez.
- Her sonuç dosya, satır, parser, benchmark, formül, takvim ve engine sürümüne izlenir.
- GET çağrıları dış veri çekmez veya DB düzeltmez.
- KAP olmadan temel akış çalışır.
- Favori/not yalnız temiz enstrüman kimliğine bağlıdır.

Kanıtlar:

- `README.md`
- `docs/runbooks/PRODUCTION-FIRST-BOOT.md`
- `apps/api/tests/fixtures/bist/manifest.json`
