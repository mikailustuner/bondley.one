-- FinCalc Database Schema
-- Tum parasal ve oran alanlari DECIMAL/NUMERIC kullanir, asla FLOAT kullanilmaz.

BEGIN;

-- bonds: Tahvilin statik verileri
CREATE TABLE IF NOT EXISTS bonds (
    id              SERIAL PRIMARY KEY,
    isin_code       VARCHAR(20) UNIQUE NOT NULL,
    bond_type       VARCHAR(10) NOT NULL,
    issue_date      DATE NOT NULL,
    maturity_date   DATE NOT NULL,
    coupon_rate     DECIMAL(10,6) NOT NULL,
    coupon_frequency INT NOT NULL DEFAULT 2,
    face_value      DECIMAL(18,2) NOT NULL DEFAULT 100.00,
    currency        VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- market_data: Gunluk degisen piyasa verileri
CREATE TABLE IF NOT EXISTS market_data (
    id              SERIAL PRIMARY KEY,
    bond_id         INT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
    trade_date      DATE NOT NULL,
    clean_price     DECIMAL(18,8) NOT NULL,
    tlref_index     DECIMAL(18,8),
    fark            DECIMAL(18,8),
    volume          DECIMAL(18,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bond_id, trade_date)
);

-- calculations: Hesaplanan sonuclar (cache)
CREATE TABLE IF NOT EXISTS calculations (
    id                  SERIAL PRIMARY KEY,
    bond_id             INT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
    calc_date           DATE NOT NULL,
    dirty_price         DECIMAL(18,8) NOT NULL,
    accrued_interest    DECIMAL(18,8) NOT NULL,
    yield_to_maturity   DECIMAL(10,6) NOT NULL,
    spread              DECIMAL(10,6),
    modified_duration   DECIMAL(10,6),
    macaulay_duration   DECIMAL(10,6),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bond_id, calc_date)
);

-- tlref_rates: Borsa Istanbul'dan cekilen TLREF gunluk oranlari
CREATE TABLE IF NOT EXISTS tlref_rates (
    id              SERIAL PRIMARY KEY,
    rate_date       DATE UNIQUE NOT NULL,
    rate_value      DECIMAL(10,6) NOT NULL,
    isin            VARCHAR(20) NOT NULL DEFAULT 'TRIXIST00015',
    source          VARCHAR(50) NOT NULL DEFAULT 'BIST',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users: Kullanici bilgileri ve yetkileri (B2B)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    company         VARCHAR(255),
    location        VARCHAR(255),
    role            VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'user')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bonds_isin ON bonds(isin_code);
CREATE INDEX IF NOT EXISTS idx_bonds_active ON bonds(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_market_data_bond_date ON market_data(bond_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_calculations_bond_date ON calculations(bond_id, calc_date);
CREATE INDEX IF NOT EXISTS idx_tlref_rates_date ON tlref_rates(rate_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Seed: Default admin user (password: admin123 - bcrypt hashed)
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'admin@fincalc.com',
    '$2b$12$LJ3m4ys3Lk0TSwHjnF4ureYM0QkOMC8RqVc5y8ZGH0OxMOOKJ6AWy',
    'System Admin',
    'admin'
) ON CONFLICT (email) DO NOTHING;

COMMIT;
