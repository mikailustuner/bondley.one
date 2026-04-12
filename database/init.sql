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

-- kap_companies: CSV'deki sirket-KAP ID eslemesi
CREATE TABLE IF NOT EXISTS kap_companies (
    id                  SERIAL PRIMARY KEY,
    sirket_adi          VARCHAR(255) NOT NULL,
    kap_id              VARCHAR(100) UNIQUE NOT NULL,
    stock_code          VARCHAR(20),
    api_url             TEXT,
    last_fetched_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kap_companies_kap_id ON kap_companies(kap_id);

-- kap_disclosures: Her bir KAP bildirimi
CREATE TABLE IF NOT EXISTS kap_disclosures (
    id                  SERIAL PRIMARY KEY,
    kap_company_id      INTEGER NOT NULL REFERENCES kap_companies(id) ON DELETE CASCADE,
    disclosure_index    INTEGER UNIQUE NOT NULL,
    disclosure_id       VARCHAR(100),
    title               TEXT,
    summary             TEXT,
    publish_date        TIMESTAMPTZ,
    isin_code           VARCHAR(30),
    disclosure_class    VARCHAR(20),
    disclosure_type     VARCHAR(20),
    disclosure_category VARCHAR(20),
    company_title       VARCHAR(255),
    stock_code          VARCHAR(20),
    related_stocks      VARCHAR(100),
    is_changed          VARCHAR(50),
    is_late             BOOLEAN,
    attachment_count    INTEGER DEFAULT 0,
    has_multi_language  VARCHAR(5),
    period              VARCHAR(10),
    year                VARCHAR(10),
    disclosure_url      TEXT,
    fetch_date          DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kap_disclosures_isin ON kap_disclosures(isin_code);
CREATE INDEX IF NOT EXISTS idx_kap_disclosures_publish ON kap_disclosures(publish_date);
CREATE INDEX IF NOT EXISTS idx_kap_disclosures_company ON kap_disclosures(kap_company_id);
CREATE INDEX IF NOT EXISTS idx_kap_disclosures_fetch ON kap_disclosures(fetch_date);

-- kap_disclosure_details: Excel export'tan parse edilen detaylar
CREATE TABLE IF NOT EXISTS kap_disclosure_details (
    id                          SERIAL PRIMARY KEY,
    disclosure_id               INTEGER UNIQUE NOT NULL REFERENCES kap_disclosures(id) ON DELETE CASCADE,
    isin_code                   VARCHAR(30),
    instrument_type             VARCHAR(50),
    maturity_date               DATE,
    maturity_days               INTEGER,
    nominal_value               NUMERIC(22,3),
    issue_price                 NUMERIC(18,6),
    interest_rate_type          VARCHAR(50),
    floating_rate_reference     VARCHAR(50),
    additional_return_pct       NUMERIC(12,6),
    coupon_number               INTEGER,
    coupon_frequency            VARCHAR(50),
    currency                    VARCHAR(10),
    payment_type                VARCHAR(50),
    sale_type                   VARCHAR(100),
    starting_date_sale          DATE,
    ending_date_sale            DATE,
    maturity_starting_date      DATE,
    traded_in_exchange          BOOLEAN,
    intermediary_brokerage      VARCHAR(255),
    issue_limit                 NUMERIC(22,3),
    issue_limit_security_type   VARCHAR(100),
    issue_limit_currency        VARCHAR(10),
    issuer_has_rating           BOOLEAN,
    issuer_rating_company       VARCHAR(100),
    issuer_rating_note          VARCHAR(20),
    issuer_rating_date          DATE,
    issuer_rating_investment_grade BOOLEAN,
    instrument_has_rating       BOOLEAN,
    originator_has_rating       BOOLEAN,
    coupon_payments_json        JSONB,
    additional_explanation      TEXT,
    board_decision_date         DATE,
    subject_of_notification     VARCHAR(100),
    raw_data_json               JSONB,
    fetched_at                  TIMESTAMPTZ DEFAULT NOW(),
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kap_details_isin ON kap_disclosure_details(isin_code);
CREATE INDEX IF NOT EXISTS idx_kap_details_disclosure ON kap_disclosure_details(disclosure_id);

COMMIT;
