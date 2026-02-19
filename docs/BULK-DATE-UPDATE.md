# Toplu Tarih Güncelleme Rehberi

Veritabanındaki tarih kayıtlarını toplu olarak güncellemek için kullanabileceğiniz yöntemler.

## Dikkat!

⚠️ **Bu işlemler veritabanındaki verileri kalıcı olarak değiştirir!**
- İşlem öncesi mutlaka **backup** alın
- Test ortamında önce deneyin
- Production'da dikkatli kullanın

---

## Senaryo 1: Belirli Bir Tahvilin Tüm Tarihlerini Değiştirme

### market_data Tablosu

```sql
-- Örnek: TRDEMVK22619 tahvilinin tüm tarihlerini 1 gün ileriye al
UPDATE market_data
SET trade_date = trade_date + INTERVAL '1 day'
WHERE bond_id = (
    SELECT id FROM bonds WHERE isin_code = 'TRDEMVK22619'
);

-- Veya belirli bir tarih aralığını değiştir
UPDATE market_data
SET trade_date = trade_date + INTERVAL '1 day'
WHERE bond_id = (
    SELECT id FROM bonds WHERE isin_code = 'TRDEMVK22619'
)
AND trade_date BETWEEN '2026-02-18' AND '2026-02-20';
```

### calculations Tablosu

```sql
-- Aynı tahvilin hesaplama tarihlerini güncelle
UPDATE calculations
SET calc_date = calc_date + INTERVAL '1 day'
WHERE bond_id = (
    SELECT id FROM bonds WHERE isin_code = 'TRDEMVK22619'
);
```

---

## Senaryo 2: Tüm Tahvillerin Tarihlerini Değiştirme

### Tüm market_data kayıtlarını 1 gün ileriye al:

```sql
UPDATE market_data
SET trade_date = trade_date + INTERVAL '1 day';
```

### Tüm calculations kayıtlarını 1 gün ileriye al:

```sql
UPDATE calculations
SET calc_date = calc_date + INTERVAL '1 day';
```

---

## Senaryo 3: Belirli Bir Tarihi Başka Bir Tarihe Çevirme

### market_data:

```sql
-- 2026-02-18 tarihli tüm kayıtları 2026-02-19'a çevir
UPDATE market_data
SET trade_date = '2026-02-19'
WHERE trade_date = '2026-02-18';
```

### calculations:

```sql
-- 2026-02-18 tarihli tüm hesaplamaları 2026-02-19'a çevir
UPDATE calculations
SET calc_date = '2026-02-19'
WHERE calc_date = '2026-02-18';
```

---

## Senaryo 4: Tarih Aralığını Kaydırma

### Belirli bir tarih aralığını X gün ileriye/geriye al:

```sql
-- 2026-02-18 ile 2026-02-20 arasındaki tüm kayıtları 3 gün ileriye al
UPDATE market_data
SET trade_date = trade_date + INTERVAL '3 days'
WHERE trade_date BETWEEN '2026-02-18' AND '2026-02-20';

UPDATE calculations
SET calc_date = calc_date + INTERVAL '3 days'
WHERE calc_date BETWEEN '2026-02-18' AND '2026-02-20';
```

---

## Senaryo 5: Tarihleri Geriye Alma

```sql
-- Tüm tarihleri 1 gün geriye al
UPDATE market_data
SET trade_date = trade_date - INTERVAL '1 day';

UPDATE calculations
SET calc_date = calc_date - INTERVAL '1 day';
```

---

## Senaryo 6: Sadece Belirli Tahvillerin Tarihlerini Değiştirme

```sql
-- Sadece aktif tahvillerin tarihlerini güncelle
UPDATE market_data md
SET trade_date = trade_date + INTERVAL '1 day'
FROM bonds b
WHERE md.bond_id = b.id
AND b.is_active = TRUE;

UPDATE calculations c
SET calc_date = calc_date + INTERVAL '1 day'
FROM bonds b
WHERE c.bond_id = b.id
AND b.is_active = TRUE;
```

---

## Senaryo 7: Tarihleri Hafta Sonlarından İş Günlerine Taşıma

```sql
-- Cumartesi (6) ve Pazar (0) tarihlerini bir sonraki Pazartesi'ye taşı
UPDATE market_data
SET trade_date = trade_date + 
    CASE 
        WHEN EXTRACT(DOW FROM trade_date) = 6 THEN INTERVAL '2 days'  -- Cumartesi -> Pazartesi
        WHEN EXTRACT(DOW FROM trade_date) = 0 THEN INTERVAL '1 day'     -- Pazar -> Pazartesi
        ELSE INTERVAL '0 days'
    END
WHERE EXTRACT(DOW FROM trade_date) IN (0, 6);
```

---

## Python Script ile Toplu Güncelleme

Daha kontrollü bir güncelleme için Python script'i kullanabilirsiniz:

```python
# update-dates.py
import asyncio
from datetime import date, timedelta
from sqlalchemy import text
from app.core.database import engine

async def update_dates():
    """Tarihleri toplu olarak güncelle"""
    async with engine.begin() as conn:
        # Örnek: Tüm market_data tarihlerini 1 gün ileriye al
        await conn.execute(
            text("UPDATE market_data SET trade_date = trade_date + INTERVAL '1 day'")
        )
        
        # Örnek: Tüm calculations tarihlerini 1 gün ileriye al
        await conn.execute(
            text("UPDATE calculations SET calc_date = calc_date + INTERVAL '1 day'")
        )
        
        print("Tarihler güncellendi!")

if __name__ == "__main__":
    asyncio.run(update_dates())
```

---

## Güvenli Güncelleme Adımları

### 1. Backup Alın

```bash
# PostgreSQL dump alın
docker exec fincalc-postgres pg_dump -U fincalc fincalc > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Önce Test Edin (SELECT ile)

```sql
-- Güncellemeden önce kaç kayıt etkilenecek?
SELECT COUNT(*) FROM market_data WHERE trade_date = '2026-02-18';

-- Güncelleme sonrası nasıl görünecek? (UPDATE yapmadan)
SELECT trade_date, trade_date + INTERVAL '1 day' as new_date
FROM market_data
WHERE trade_date = '2026-02-18'
LIMIT 10;
```

### 3. Transaction İçinde Çalıştırın

```sql
BEGIN;

-- Güncellemeleri yapın
UPDATE market_data SET trade_date = trade_date + INTERVAL '1 day' WHERE ...;

-- Sonuçları kontrol edin
SELECT COUNT(*) FROM market_data WHERE trade_date = '2026-02-19';

-- Eğer sonuçlar doğruysa:
COMMIT;

-- Eğer yanlışsa:
ROLLBACK;
```

---

## Örnek Kullanım Senaryoları

### Senaryo A: Yanlış tarihli verileri düzeltme

```sql
-- 2026-02-18 tarihli verileri 2026-02-19'a taşı
BEGIN;

UPDATE market_data
SET trade_date = '2026-02-19'
WHERE trade_date = '2026-02-18';

UPDATE calculations
SET calc_date = '2026-02-19'
WHERE calc_date = '2026-02-18';

COMMIT;
```

### Senaryo B: Tüm tarihleri 1 hafta ileriye alma

```sql
BEGIN;

UPDATE market_data
SET trade_date = trade_date + INTERVAL '7 days';

UPDATE calculations
SET calc_date = calc_date + INTERVAL '7 days';

COMMIT;
```

### Senaryo C: Belirli bir tahvilin sadece belirli tarihlerini değiştirme

```sql
BEGIN;

UPDATE market_data
SET trade_date = '2026-02-20'
WHERE bond_id = (SELECT id FROM bonds WHERE isin_code = 'TRDEMVK22619')
AND trade_date IN ('2026-02-18', '2026-02-19');

COMMIT;
```

---

## Kontrol Sorguları

### Güncelleme öncesi kontrol:

```sql
-- Hangi tarihlerde kaç kayıt var?
SELECT trade_date, COUNT(*) as count
FROM market_data
GROUP BY trade_date
ORDER BY trade_date DESC
LIMIT 20;

-- Hangi tahvillerin hangi tarihlerde kaydı var?
SELECT b.isin_code, md.trade_date, COUNT(*) as count
FROM market_data md
JOIN bonds b ON md.bond_id = b.id
GROUP BY b.isin_code, md.trade_date
ORDER BY b.isin_code, md.trade_date DESC
LIMIT 50;
```

### Güncelleme sonrası kontrol:

```sql
-- Güncelleme başarılı mı?
SELECT 
    'market_data' as table_name,
    COUNT(*) as total_records,
    MIN(trade_date) as min_date,
    MAX(trade_date) as max_date
FROM market_data
UNION ALL
SELECT 
    'calculations' as table_name,
    COUNT(*) as total_records,
    MIN(calc_date)::text as min_date,
    MAX(calc_date)::text as max_date
FROM calculations;
```

---

## Önemli Notlar

1. **Unique Constraint:** `market_data` ve `calculations` tablolarında `UNIQUE(bond_id, trade_date)` kısıtı var. Eğer güncelleme sonrası duplicate kayıt oluşursa hata alırsınız.

2. **Foreign Key:** `bond_views` tablosundaki `settlement_date` alanı da güncellenebilir ama bu genellikle gerekli değildir (analitik verisi).

3. **Index'ler:** Tarih güncellemeleri index'leri etkilemez, performans sorunu olmaz.

4. **Cascade:** `market_data` ve `calculations` tabloları `bonds` tablosuna bağlıdır. Eğer bir tahvil silinirse, ilgili tarih kayıtları da otomatik silinir.

---

## Hızlı Referans

| İşlem | SQL Komutu |
|-------|------------|
| 1 gün ileriye al | `SET trade_date = trade_date + INTERVAL '1 day'` |
| 1 gün geriye al | `SET trade_date = trade_date - INTERVAL '1 day'` |
| Belirli tarihe çevir | `SET trade_date = '2026-02-19'` |
| X gün ileriye al | `SET trade_date = trade_date + INTERVAL 'X days'` |
| X gün geriye al | `SET trade_date = trade_date - INTERVAL 'X days'` |
