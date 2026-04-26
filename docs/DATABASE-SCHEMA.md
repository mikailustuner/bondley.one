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

**Tam Sütun Listesi:**

```sql
CREATE TABLE bonds (
    id                      SERIAL PRIMARY KEY,
    isin                    VARCHAR(12) UNIQUE NOT NULL,
    name                     VARCHAR(255) NOT NULL,
    issuer                   VARCHAR(255),
    currency                 VARCHAR(3) DEFAULT 'TRY',
    face_value               DECIMAL(18,2),
    coupon_rate              DECIMAL(10,6),
    first_issue_date         DATE,
    maturity_date           DATE,
    next_coupon_date        DATE,
    -- Temel sütunlar (mevcut)
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ek sütunlar (dokümante edilmemiş)
    fund_user               VARCHAR(100),
    source_institution      VARCHAR(100),
    issuance_type         VARCHAR(50),
    yield_type            VARCHAR(50),
    security_type        VARCHAR(50),
    coupon_frequency     VARCHAR(20),
    group_code           VARCHAR(50),
    days_to_maturity     INTEGER,
    total_issue_amount  DECIMAL(20,2),
    last_issue_date_text VARCHAR(50),
    last_issue_price    DECIMAL(18,8),
    last_issue_yield   DECIMAL(10,6),
    first_issue_yield  DECIMAL(10,6),
    quotation_method   VARCHAR(50),
    accrued_interest_text VARCHAR(100),
    clean_price_text   VARCHAR(100),
    dirty_price_formula VARCHAR(500),
    settlement_price_formula VARCHAR(500),
    yield_formula      VARCHAR(500),
    compound_yield_formula VARCHAR(500),
    day_count_convention VARCHAR(50),
    brokerage         VARCHAR(100),
    security_type_detail VARCHAR(200),
    has_data          BOOLEAN DEFAULT FALSE
);
```

---

### 2. `users` Tablosu (Kullanıcılar)

```sql
CREATE TABLE users (
    id                      SERIAL PRIMARY KEY,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    password_hash           VARCHAR(255) NOT NULL,
    full_name                VARCHAR(255),
    role                     VARCHAR(20) DEFAULT 'user',
    is_active                BOOLEAN DEFAULT TRUE,
    email_verified          BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login              TIMESTAMPTZ,
    
    -- Ek sütunlar (dokümante edilmemiş)
    department             VARCHAR(100),
    job_title              VARCHAR(100),
    usage_purpose          VARCHAR(50),
    estimated_daily_views  INTEGER,
    profile_completed       BOOLEAN DEFAULT FALSE,
    privacy_policy_accepted BOOLEAN DEFAULT FALSE,
    privacy_policy_accepted_at TIMESTAMPTZ,
    mfa_enabled            BOOLEAN DEFAULT FALSE,
    mfa_secret_encrypted   VARCHAR(255)
);
```

---

### 3. `market_data` Tablosu (Piyasa Verileri) ✅ Tarih Bazlı
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

### 4. `calculations` Tablosu (Hesaplama Sonuçları) ✅ Tarih Bazlı
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
    -- Ek sütunlar (dokümante edilmemiş)
    is_theoretical     BOOLEAN DEFAULT FALSE,
    UNIQUE(bond_id, calc_date)                   -- Aynı tahvil + tarih = tek kayıt
);
```

**Örnek:**
- TRDEMVK22619 için 2026-02-18 → 1 hesaplama kaydı
- TRDEMVK22619 için 2026-02-19 → 1 hesaplama kaydı
- TRDEMVK22619 için 2026-02-20 → 1 hesaplama kaydı

**Kullanım:** Hesaplanan metrikler (kirli fiyat, YTM, durasyon vb.) tarih bazlı cache olarak saklanır.

---

### 5. `bond_views` Tablosu (Görüntülenme Kayıtları) ✅ Tarih Bazlı
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

### 6. `tlref_rates` Tablosu (TLREF Endeks Değerleri)
Her tarih için **tek bir kayıt** tutulur (tahvil bazlı değil).

```sql
CREATE TABLE tlref_rates (
    id                        SERIAL PRIMARY KEY,
    rate_date               DATE UNIQUE NOT NULL,        -- Her tarih için tek kayıt
    index_value              DECIMAL(18,8) NOT NULL,
    daily_rate               DECIMAL(18,10),
    source                   VARCHAR(50) NOT NULL DEFAULT 'BIST',
    -- Ek sütunlar (dokümante edilmemiş)
    published_annual_rate_pct DECIMAL(10,6),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 7. `refresh_tokens` Tablosu (JWT Refresh Token'ları)

```sql
CREATE TABLE refresh_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id),
    token           VARCHAR(255) UNIQUE NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,
    revoked        BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    device_info    VARCHAR(255),
    ip_address     VARCHAR(45)
);
```

---

### 8. `user_alerts` Tablosu (Kullanıcı Fiyat Alarmları)

```sql
CREATE TABLE user_alerts (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id),
    bond_id         INT NOT NULL REFERENCES bonds(id),
    alert_type      VARCHAR(20) NOT NULL,  -- 'above', 'below', 'yield_above', 'yield_below'
    target_value    DECIMAL(18,8) NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE,
    triggered_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 9. `user_favorite_bonds` Tablosu (Kullanıcı Favori Tahvilleri)

```sql
CREATE TABLE user_favorite_bonds (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id),
    bond_id         INT NOT NULL REFERENCES bonds(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, bond_id)
);
```

---

### 10. `user_mfa_backup_codes` Tablosu (MFA Yedek Kodları)

```sql
CREATE TABLE user_mfa_backup_codes (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id),
    code_hash       VARCHAR(255) NOT NULL,
    used           BOOLEAN DEFAULT FALSE,
    used_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 11. `notifications` Tablosu (Kullanıcı Bildirimleri)

```sql
CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(30) DEFAULT 'info',  -- 'info', 'warning', 'alert', 'success'
    read_at         TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data           JSONB
);
```

---

### 12. `bond_user_notes` Tablosu (Kullanıcı Tahvil Notları)

```sql
CREATE TABLE bond_user_notes (
    id              SERIAL PRIMARY KEY,
    bond_id         INT NOT NULL REFERENCES bonds(id),
    user_id         INT NOT NULL REFERENCES users(id),
    note            TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bond_id, user_id)
);
```

---

### 13. `kap_companies` Tablosu (KAP Şirket Eşleştirmesi)

```sql
CREATE TABLE kap_companies (
    id              SERIAL PRIMARY KEY,
    bond_id         INT REFERENCES bonds(id),
    kap_company_id  VARCHAR(50) UNIQUE NOT NULL,
    company_name    VARCHAR(255) NOT NULL,
    ticker         VARCHAR(20),
    industry       VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 14. `kap_disclosures` Tablosu (KAP Bildirim Başlıkları)

```sql
CREATE TABLE kap_disclosures (
    id              SERIAL PRIMARY KEY,
    kap_company_id  VARCHAR(50) NOT NULL REFERENCES kap_companies(kap_company_id),
    disclosure_id  VARCHAR(50) NOT NULL,
    title          VARCHAR(500) NOT NULL,
    disclosure_date TIMESTAMPTZ NOT NULL,
    disclosure_type VARCHAR(50),
    url            TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(kap_company_id, disclosure_id)
);
```

---

### 15. `kap_disclosure_details` Tablosu (KAP Bildirim Detayları)

```sql
CREATE TABLE kap_disclosure_details (
    id                  SERIAL PRIMARY KEY,
    kap_disclosure_id    INT NOT NULL REFERENCES kap_disclosures(id),
    section            VARCHAR(100),
    content            TEXT,
    table_data         JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

### Tarih aral��ğı sorgusu:
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

-- users için
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- user_alerts için
CREATE INDEX idx_user_alerts_user_bond ON user_alerts(user_id, bond_id);
CREATE INDEX idx_user_alerts_active ON user_alerts(is_active);

-- notifications için
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

-- refresh_tokens için
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

---

## Tablo Özeti

| Tablo | Açıklama | Tarih Bazlı |
|-------|----------|-------------|
| bonds | Tahvil temel bilgileri | Hayır |
| users | Kullanıcı hesapları | Hayır |
| market_data | Piyasa verileri | EVET |
| calculations | Hesaplama sonuçları | EVET |
| bond_views | Görüntülenme kayıtları | EVET |
| tlref_rates | TLREF endeks değerleri | Hayır |
| refresh_tokens | JWT refresh token'ları | Hayır |
| user_alerts | Kullanıcı fiyat alarmları | Hayır |
| user_favorite_bonds | Kullanıcı favorileri | Hayır |
| user_mfa_backup_codes | MFA yedek kodları | Hayır |
| notifications | Kullanıcı bildirimleri | Hayır |
| bond_user_notes | Tahvil notları | Hayır |
| kap_companies | KAP şirket eşleştirmesi | Hayır |
| kap_disclosures | KAP bildirim başlıkları | Hayır |
| kap_disclosure_details | KAP bildirim detayları | Hayır |

---

## Sonuç

✅ **Her tahvil için tarih bazl�� kayıtlar tutulmaktadır:**

1. **market_data**: Her tarih için piyasa verisi (clean_price, volume vb.)
2. **calculations**: Her tarih için hesaplama sonuçları (dirty_price, YTM, durasyon vb.)
3. **bond_views**: Her görüntülenme için kayıt (analitik için)

✅ **Dokümante edilmemiş ek tablolar:**

4. **refresh_tokens**: JWT refresh token yönetimi
5. **user_alerts**: Fiyat alarmları
6. **user_favorite_bonds**: Favori tahviller
7. **user_mfa_backup_codes**: MFA yedek kodları
8. **notifications**: Bildirim sistemi
9. **bond_user_notes**: Kullanıcı notları
10. **kap_companies**: KAP şirket eşleştirmesi
11. **kap_disclosures**: KAP bildirim başlıkları
12. **kap_disclosure_details**: KAP bildirim detayları

Bu sayede:
- Geçmiş tarihli veriler sorgulanabilir
- Tarih bazlı analizler yapılabilir
- Hesaplama sonuçları cache'lenir (performans)
- Metrikler ve istatistikler toplanabilir
- KAP verileri ile entegrasyon sağlanabilir