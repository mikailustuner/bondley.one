-- FinCalc Database Schema
-- Tum parasal ve oran alanlari DECIMAL/NUMERIC kullanir, asla FLOAT kullanilmaz.

BEGIN;

-- bonds: BIST borclanma araclari (tbliste.zip XLS'den)
CREATE TABLE IF NOT EXISTS bonds (
    id                       SERIAL PRIMARY KEY,
    isin_code                VARCHAR(30) UNIQUE NOT NULL,
    issuer                   VARCHAR(255),
    issuance_type            VARCHAR(100),
    yield_type               VARCHAR(255),
    security_type            VARCHAR(255),
    coupon_frequency         VARCHAR(50),
    currency                 VARCHAR(20) NOT NULL DEFAULT 'TRY',
    group_code               INT,
    first_issue_date         DATE,
    maturity_date            DATE,
    days_to_maturity         INT,
    total_issue_amount       DECIMAL(22,3),
    last_issue_date_text     VARCHAR(100),
    last_issue_price         DECIMAL(18,6),
    last_issue_yield         DECIMAL(12,4),
    first_issue_yield        DECIMAL(12,4),
    next_coupon_date         DATE,
    next_coupon_rate         DECIMAL(12,6),
    spread                   DECIMAL(12,6),
    first_issue_price        DECIMAL(18,6),
    quotation_method         VARCHAR(100),
    accrued_interest_text    VARCHAR(100),
    clean_price_text         VARCHAR(100),
    dirty_price_formula      VARCHAR(100),
    settlement_price_formula VARCHAR(100),
    yield_formula            VARCHAR(100),
    compound_yield_formula   VARCHAR(100),
    day_count_convention     VARCHAR(100),
    remarks                  TEXT,
    brokerage                VARCHAR(255),
    security_type_detail     VARCHAR(50),
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- tlref_rates: Borsa Istanbul BIST TLREF Endeks degerleri
CREATE TABLE IF NOT EXISTS tlref_rates (
    id              SERIAL PRIMARY KEY,
    rate_date       DATE UNIQUE NOT NULL,
    index_value     DECIMAL(18,8) NOT NULL,
    daily_rate      DECIMAL(18,10),
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
    role            VARCHAR(20) NOT NULL DEFAULT 'free_user'
                    CHECK (role IN ('admin', 'premium_user', 'pro_user', 'free_user')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bonds_isin ON bonds(isin_code);
CREATE INDEX IF NOT EXISTS idx_bonds_active ON bonds(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bonds_currency ON bonds(currency);
CREATE INDEX IF NOT EXISTS idx_bonds_maturity ON bonds(maturity_date);
CREATE INDEX IF NOT EXISTS idx_bonds_security_type ON bonds(security_type);
CREATE INDEX IF NOT EXISTS idx_market_data_bond_date ON market_data(bond_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_calculations_bond_date ON calculations(bond_id, calc_date);
CREATE INDEX IF NOT EXISTS idx_tlref_rates_date ON tlref_rates(rate_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- audit_logs: Sistem loglari ve audit kayitlari
CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     VARCHAR(255),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    request_method  VARCHAR(10),
    request_path    VARCHAR(500),
    status_code     INT,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- bond_views: Tahvil goruntulenme takibi
CREATE TABLE IF NOT EXISTS bond_views (
    id              SERIAL PRIMARY KEY,
    bond_id         INT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(id) ON DELETE SET NULL,
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    settlement_date DATE
);

CREATE INDEX IF NOT EXISTS idx_bond_views_bond ON bond_views(bond_id);
CREATE INDEX IF NOT EXISTS idx_bond_views_user ON bond_views(user_id);
CREATE INDEX IF NOT EXISTS idx_bond_views_date ON bond_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_bond_views_bond_date ON bond_views(bond_id, viewed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bond_views_unique ON bond_views(bond_id, user_id, DATE(viewed_at));

-- user_metrics: Kullanici metrikleri
CREATE TABLE IF NOT EXISTS user_metrics (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date     DATE NOT NULL,
    bonds_viewed    INT DEFAULT 0,
    api_calls       INT DEFAULT 0,
    calculations_run INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_user_metrics_user ON user_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_metrics_date ON user_metrics(metric_date);

-- refresh_tokens: Refresh token'ları saklamak için tablo
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, expires_at, revoked_at) WHERE revoked_at IS NULL;

-- Seed: Default admin user (password: admin123 - bcrypt hashed)
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'admin@fincalc.com',
    '$2b$12$LJ3m4ys3Lk0TSwHjnF4ureYM0QkOMC8RqVc5y8ZGH0OxMOOKJ6AWy',
    'System Admin',
    'admin'
) ON CONFLICT (email) DO NOTHING;

COMMIT;
