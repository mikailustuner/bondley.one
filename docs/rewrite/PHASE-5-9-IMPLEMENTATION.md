# Faz 5–9 Uygulama Kaydı

Durum: **TAMAMLANDI — 26.07.2026**

## Faz 5 — Finansal çekirdek

- `valuation-engine-v2.0.0`, yalnız `Decimal` aritmetiği kullanır.
- Ay/anchor tabanlı, ay-sonunu koruyan kupon takvimi uygulandı.
- Düzensiz frekansta açık kupon tarihleri yoksa `MISSING_SCHEDULE` döner.
- ACT/365F, ACT/360, ACT/ACT ISDA, 30/360 US ve 30E/360 desteklenir.
- Sabit, değişken, TLREF, TLREFK ve TÜFE BAP formül kataloğu eklendi.
- Temiz/kirli fiyat ve getiri round-trip; accrued, cash-flow, duration ve convexity üretir.
- Eksik/veri hataları typed failure’dır; sahte sıfır yoktur.

## Faz 6 — Şema ve v2 API

`015_add_valuation_v2.py` ile legacy eşleme, yeni favori/not, fiyat gözlemi,
değerleme request/result ve shadow karşılaştırma tabloları eklendi.

V2; enstrüman, benchmark, kalite, değerleme, provenance, favori/not ve admin
import/review uçlarını içerir. GET uçlarında indirme veya DB düzeltme yoktur.

## Faz 7 — Web

- Liste/detay ekranları v2’ye geçirildi.
- Ham kaynak, AST ve değerleme ayrı gösterilir.
- Kalite/uygunluk rozetleri, TLREF/TLREFK ayrımı ve kullanıcı fiyat/getiri formu eklendi.
- Son ihraç fiyatı piyasa fiyatı olarak gösterilmez.
- Cash-flow, ara değerler ve provenance kullanıcıya açıktır.

## Faz 8 — Gölge geçiş

- Legacy ve v2 sonuçları alan bazlı toleranslarla karşılaştırılır.
- Teorik legacy fiyatlar açıklanmış fark, gerçek tolerans aşımı kritik farktır.
- V2 read/write/shadow rollback feature flag’leri eklendi.

## Faz 9 — Legacy temizliği

Eski BondCalculator, tbliste/TLREF fetcher, sentetik market-data üreticisi,
calculation servisleri, v1 yazma route’ları ve eski worker görevleri kaldırıldı.
KAP fiziksel olarak korundu ancak v2’ye bağlı değildir. Eski veri tabloları yedeksiz
silinmemiş ve v2 tarafından yazılmaz.

## Kapanış kanıtları

- Nihai paket: 29 test geçti; iki DB entegrasyon testi varsayılan koşuda atlandı.
- Ayrı PostgreSQL koşularında resmî tam import ve gerçek TRD/TLREFK v2 değerlemesi geçti.
- `014 → 015 → 014 → 015` migrasyonu geçti.
- Favori/not instrument ID geçişi ve downgrade koruması doğrulandı.
- Next.js production build, TypeScript, Compose, OpenAPI/metadata ve Celery denetimleri geçti.
- Yerel ölçüm: 500 değerleme 0,445 sn (ortalama 0,891 ms); tam resmî import 11,77 sn.
- Geçici HTTP 503 retry testi geçti.

