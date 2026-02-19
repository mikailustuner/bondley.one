# Veritabanı Şeması ve Tarih Kayıtları

## Özet

**Evet, veritabanında her tahvil için tarih bazlı kayıtlar tutulmaktadır.**

## Tablolar ve Tarih Kayıtları

### 1. `bonds` Tablosu (Tahvil Temel Bilgileri)
Her tahvil için **tek bir kayıt** bulunur. Tarih alanları:

- `first_issue_date` (DATE) - İlk ihraç tarihi
- `maturity_date` (DATE) - Vade tarihi
- `next_coupon_date` (DATE) - Sonraki kupon tarihi
- `created_at` (TIMESTAMPTZ) - Kayıt oluşturulma zamanı
- `updated_at` (TIMESTAMPTZ) - Son güncelleme zamanı

**Not:** Bu tablo tarih bazlı değil, her tahvil için tek kayıt içerir.

---

### 2. `market_data` Tablosu (Piyasa Verileri) ✅ Tarih Bazlı
Her tahvil için **her tarih için ayrı kayıt** tutulur.

```sql
CREATE TABLE market_data (
    id              SERIAL PRIMARY KEY,
    bond_id         INT NOT NULL REFERENCES bonds(id),
    trade_date      DATE NOT NULL,           -- Her tarih için ayrı kayıt
    clean_price     DECIMAL(18,8) NOT NULL,
    tlref_index     DECIMAL(18,8),
    fark            DECIMAL(18,8),
    volume          DECIMAL(18,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bond_id, trade_date)              -- Aynı tahvil + tarih = tek kayıt
);
```

**Örnek:**
- TRDEMVK22619 için 2026-02-18 → 1 kayıt
- TRDEMVK22619 için 2026-02-19 → 1 kayıt
- TRDEMVK22619 için 2026-02-20 → 1 kayıt

**Kullanım:** Her gün için temiz fiyat ve piyasa verileri saklanır.

---

### 3. `calculations` Tablosu (Hesaplama Sonuçları) ✅ Tarih Bazlı
Her tahvil için **her hesaplama tarihi için ayrı kayıt** tutulur.

```sql
CREATE TABLE calculations (
    id                  SERIAL PRIMARY KEY,
    bond_id             INT NOT NULL REFERENCES bonds(id),
    calc_date           DATE NOT NULL,           -- Her tarih için ayrı kayıt
    dirty_price         DECIMAL(18,8) NOT NULL,
    accrued_interest    DECIMAL(18,8) NOT NULL,
    yield_to_maturity   DECIMAL(10,6) NOT NULL,
    spread              DECIMAL(10,6),
    modified_duration   DECIMAL(10,6),
    macaulay_duration   DECIMAL(10,6),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bond_id, calc_date)                   -- Aynı tahvil + tarih = tek kayıt
);
```

**Örnek:**
- TRDEMVK22619 için 2026-02-18 → 1 hesaplama kaydı
- TRDEMVK22619 için 2026-02-19 → 1 hesaplama kaydı
- TRDEMVK22619 için 2026-02-20 → 1 hesaplama kaydı

**Kullanım:** Hesaplanan metrikler (kirli fiyat, YTM, durasyon vb.) tarih bazlı cache olarak saklanır.

---

### 4. `bond_views` Tablosu (Görüntülenme Kayıtları) ✅ Tarih Bazlı
Her tahvil için **her görüntülenme için kayıt** tutulur.

```sql
CREATE TABLE bond_views (
    id              SERIAL PRIMARY KEY,
    bond_id         INT NOT NULL REFERENCES bonds(id),
    user_id         INT REFERENCES users(id),
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Görüntülenme zamanı
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    settlement_date DATE                                  -- Hangi tarih için görüntülendi
);
```

**Örnek:**
- Kullanıcı TRDEMVK22619'u 2026-02-19 için görüntüledi → 1 kayıt
- Aynı kullanıcı aynı tahvili 2026-02-20 için görüntüledi → 1 kayıt daha

**Kullanım:** Metrikler ve analitik için kullanılır.

---

### 5. `tlref_rates` Tablosu (TLREF Endeks Değerleri)
Her tarih için **tek bir kayıt** tutulur (tahvil bazlı değil).

```sql
CREATE TABLE tlref_rates (
    id              SERIAL PRIMARY KEY,
    rate_date       DATE UNIQUE NOT NULL,        -- Her tarih için tek kayıt
    index_value     DECIMAL(18,8) NOT NULL,
    daily_rate      DECIMAL(18,10),
    source          VARCHAR(50) NOT NULL DEFAULT 'BIST',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Tarih Bazlı Sorgulama Örnekleri

### Belirli bir tarih için piyasa verisi:
```sql
SELECT * FROM market_data 
WHERE bond_id = 123 AND trade_date = '2026-02-19';
```

### Belirli bir tarih için hesaplama sonuçları:
```sql
SELECT * FROM calculations 
WHERE bond_id = 123 AND calc_date = '2026-02-19';
```

### Bir tahvilin tüm tarih kayıtları:
```sql
-- Piyasa verileri
SELECT trade_date, clean_price 
FROM market_data 
WHERE bond_id = 123 
ORDER BY trade_date DESC;

-- Hesaplama sonuçları
SELECT calc_date, dirty_price, yield_to_maturity 
FROM calculations 
WHERE bond_id = 123 
ORDER BY calc_date DESC;
```

### Tarih aralığı sorgusu:
```sql
SELECT * FROM market_data 
WHERE bond_id = 123 
  AND trade_date BETWEEN '2026-02-18' AND '2026-02-20'
ORDER BY trade_date;
```

---

## Index'ler

Veritabanında tarih bazlı sorguları hızlandırmak için index'ler mevcut:

```sql
-- market_data için
CREATE INDEX idx_market_data_bond_date ON market_data(bond_id, trade_date);

-- calculations için
CREATE INDEX idx_calculations_bond_date ON calculations(bond_id, calc_date);

-- bond_views için
CREATE INDEX idx_bond_views_bond_date ON bond_views(bond_id, viewed_at);
CREATE INDEX idx_bond_views_date ON bond_views(viewed_at);
```

---

## Sonuç

✅ **Her tahvil için tarih bazlı kayıtlar tutulmaktadır:**

1. **market_data**: Her tarih için piyasa verisi (clean_price, volume vb.)
2. **calculations**: Her tarih için hesaplama sonuçları (dirty_price, YTM, durasyon vb.)
3. **bond_views**: Her görüntülenme için kayıt (analitik için)

Bu sayede:
- Geçmiş tarihli veriler sorgulanabilir
- Tarih bazlı analizler yapılabilir
- Hesaplama sonuçları cache'lenir (performans)
- Metrikler ve istatistikler toplanabilir
