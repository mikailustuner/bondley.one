# Verified v2 Cutover Runbook

## Ön koşullar

1. PostgreSQL yedeği ve geri yükleme testi.
2. BIST kaynak checksum arşivi.
3. API/worker için aynı image sürümü.

## Migration

```bash
cd apps/api
alembic upgrade 015
```

Favori/not ve `legacy_bond_instrument_map` sayaçlarını doğrula. Eşleşmeyen ISIN
kayıtlarını raporla, silme.

## Kaynak ve kalite

1. Tarihsel TLREF/TLREFK importunu çalıştır.
2. Güncel tbliste snapshot’ını import et.
3. `/api/v2/quality` ve import diagnostics sonuçlarını kontrol et.
4. Quality-gate veya rekonstrüksiyon hatasında trafiği açma.

## Gölge geçiş

```text
VALUATION_V2_READ_ENABLED=true
VALUATION_V2_WRITE_ENABLED=true
VALUATION_SHADOW_ENABLED=true
```

`/api/v2/shadow-report` içinde kritik farkları açıkla. Fiyat yokluğu veya legacy
teorik fallback farkını gerçek piyasa farkı sayma.

## Rollback

Önce yazmayı, gerekirse okumayı kapat:

```text
VALUATION_V2_WRITE_ENABLED=false
VALUATION_V2_READ_ENABLED=false
```

Şema rollback:

```bash
cd apps/api
alembic downgrade 014
```

Downgrade öncesi v2 fiyat/değerleme tablolarını dışa aktar. Eski favori/not
tabloları migration tarafından silinmez.

## Legacy arşiv

`bonds`, `market_data`, `calculations` ve `tlref_rates` yalnız onaylı yedek ve
saklama süresi sonrasında ayrı veri-imha işiyle düşürülebilir. KAP tabloları bu
silme kapsamının dışındadır.

