# FinCalc - Turk Devlet Tahvil Analiz Platformu

Turk Devlet Tahvilleri (TRT/TRB) icin degerleme, fiyat takibi ve analiz sistemi.

## Teknoloji Yigini

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** Python FastAPI, SQLAlchemy (async), numpy-financial
- **Veritabani:** PostgreSQL (tum parasal degerler DECIMAL)
- **Kuyruk:** Celery + Redis
- **Altyapi:** Docker Compose, Turborepo

## Hizli Baslangic

### Docker ile (Onerilen)

```bash
# Tum servisleri baslat
docker-compose up -d

# DB schema'yi olustur (otomatik init.sql ile)
# API: http://localhost:8000/api/docs
# Web: http://localhost:3000
```

### Manuel Gelistirme

```bash
# 1. PostgreSQL ve Redis baslat
docker-compose up -d postgres redis

# 2. Python backend
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# 4. Celery beat (zamanlanmis gorevler)
celery -A app.tasks.celery_app beat --loglevel=info

# 5. Next.js frontend
cd apps/web
npm install
npm run dev
```

## Erisim ve Yonlendirme (Path tabanli, tek origin)

Web uygulamasi **tek origin** (ana domain) uzerinden path ile calisir; oturum (localStorage) tum sayfalarda gecerli olur.

| URL | Aciklama |
|---|---|
| `https://domain.com/` | Urun tanitim (landing) |
| `https://domain.com/dashboard` | Tahvil verileri, grafikler |
| `https://domain.com/admin` | Veri / kullanici yonetimi |
| `https://domain.com/login`, `/signup` | Kimlik dogrulama |
| `https://api.domain.com` veya `https://domain.com/api/v1` | Backend API |

**Subdomain yonlendirme:** `dashboard.domain.com` ve `admin.domain.com` adresleri 301 ile ana domain path'ine yonlendirilir (ornegin `dashboard.domain.com` -> `domain.com/dashboard`). Boylece eski linkler ve yer imleri calisir, oturum tek origin'de korunur.

Lokal gelistirme icin `/etc/hosts` (istege bagli):
```
127.0.0.1 landing.localhost dashboard.localhost admin.localhost
```

## API Endpointleri

- `POST /api/v1/auth/login` - Giris
- `GET /api/v1/bonds/` - Tahvil listesi
- `GET /api/v1/bonds/{isin}` - Tahvil detay
- `GET /api/v1/market-data/{isin}` - Piyasa verileri
- `POST /api/v1/calculations/run` - Hesaplama calistir
- `POST /api/v1/import/csv` - CSV dosyasi yukle
- `GET /api/v1/tlref/latest` - Son TLREF orani
- `POST /api/v1/tlref/fetch-daily` - BIST'ten TLREF cek

## Production: SSL Sertifikasi (Debian)

Tum domain'ler icin tek sertifika alip Nginx container'inin kullandigi volume'a yazmak icin:

```bash
# Proje dizininde
cd /path/to/FinCalc

# .env icinde DOMAIN ve (istege bagli) CERTBOT_EMAIL olmali
export DEBIAN_FRONTEND=noninteractive
chmod +x scripts/obtain-ssl.sh
./scripts/obtain-ssl.sh
```

Sertifikalar `certbot_certs` volume'una yazilir; `docker-compose.prod.yml` ile Nginx zaten bu volume'u `/etc/letsencrypt` olarak mount eder, ekstra kopyalama gerekmez.

**Tek seferde (script olmadan) calistirmak istersen:**

```bash
cd /path/to/FinCalc
export DEBIAN_FRONTEND=noninteractive
source .env
docker volume create certbot_webroot
docker volume create certbot_certs
mkdir -p nginx/temp
cat > nginx/temp/default.conf << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN} dashboard.${DOMAIN} admin.${DOMAIN} api.${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 "OK"; add_header Content-Type text/plain; }
}
EOF
docker rm -f nginx-ssl-temp 2>/dev/null
docker run -d --name nginx-ssl-temp -p 80:80 -v "$(pwd)/nginx/temp:/etc/nginx/conf.d:ro" -v certbot_webroot:/var/www/certbot:rw nginx:alpine
sleep 3
docker run --rm -v certbot_webroot:/var/www/certbot:rw -v certbot_certs:/etc/letsencrypt:rw certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email "${CERTBOT_EMAIL:-admin@$DOMAIN}" --agree-tos --no-eff-email --non-interactive -d "$DOMAIN" -d "www.$DOMAIN" -d "dashboard.$DOMAIN" -d "admin.$DOMAIN" -d "api.$DOMAIN"
docker rm -f nginx-ssl-temp
rm -rf nginx/temp
docker-compose -f docker-compose.prod.yml up -d nginx
```

**HTTPS "connection refused" (ERR_CONNECTION_REFUSED) ise:** Sertifika yokken Nginx sadece 80 acar, 443 acilmaz. Cozum: sertifika al, sonra Nginx'i zorla yeniden baslat:

```bash
./scripts/obtain-ssl.sh
docker-compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Kontrol: `chmod +x scripts/check-https.sh && ./scripts/check-https.sh` — sertifika, 443 ve firewall kontrolu yapar. Sunucuda 80/443 portlari acik olmali (ufw veya cloud guvenlik kurallari).

**"cert not readable" / HTTP only:** Sertifikalar `obtain-ssl.sh` ile `certbot_certs` volume'una yazilir. Compose proje adiyla farkli bir volume (ornegin `FinCalc_certbot_certs`) kullanirsa nginx bos volume'a bakar. `docker-compose.prod.yml` icinde volume isimleri sabitlendi (`name: certbot_certs`). Nginx'i yeniden olustur: `docker-compose -f docker-compose.prod.yml up -d --force-recreate nginx`.

**Nginx hâlâ 443 acmiyorsa (config/sertifika):**

```bash
# Nginx loglarinda hangi config kullanildigini gor (SSL mi HTTP-only mi)
docker logs fincalc-nginx 2>&1

# Volume icinde sertifika var mi, domain adi ne?
docker run --rm -v certbot_certs:/etc/letsencrypt:ro alpine ls -la /etc/letsencrypt/live/

# Container icinde DOMAIN ve sertifika kontrolu
docker exec fincalc-nginx sh -c 'echo "DOMAIN=$DOMAIN"; ls -la /etc/letsencrypt/live/$DOMAIN/ 2>/dev/null || ls /etc/nginx/conf.d/'
```

Nginx image'i guncellendi (entrypoint: sertifika klasorunden DOMAIN otomatik tespit, config testi). Tekrar build edip ac: `docker-compose -f docker-compose.prod.yml build nginx --no-cache && docker-compose -f docker-compose.prod.yml up -d --force-recreate nginx`

## Varsayilan Giris (sadece gelistirme)

- Email: `admin@fincalc.com`
- Sifre: `admin123` (production'da `ADMIN_INIT_PASSWORD` ile ilk admin olusturulur; ilk giriste sifreyi degistirin).

**Production icin:** [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) dosyasindaki maddeleri uygulayin (ENVIRONMENT, secret'lar, sifre degisimi).

## Proje Yapisi

```
FinCalc/
├── apps/
│   ├── web/          # Next.js 14 Frontend
│   └── api/          # Python FastAPI Backend
├── packages/
│   └── shared/       # Paylasimli TypeScript tipleri
├── database/
│   └── init.sql      # PostgreSQL schema
└── docker-compose.yml
```

## Sistem Mimarisi

### Genel Mimari

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
    end
    
    subgraph "Frontend Layer - Next.js"
        Landing[Landing Page]
        Dashboard[Dashboard]
        Admin[Admin Panel]
        Auth[Auth Pages]
    end
    
    subgraph "Reverse Proxy"
        Nginx[Nginx<br/>SSL Termination<br/>Load Balancing]
    end
    
    subgraph "API Layer - FastAPI"
        API[FastAPI Application]
        AuthRouter[Auth Router<br/>/auth/*]
        BondsRouter[Bonds Router<br/>/bonds/*]
        MarketRouter[Market Data Router<br/>/market-data/*]
        CalcRouter[Calculations Router<br/>/calculations/*]
        AdminRouter[Admin Router<br/>/admin/*]
        MetricsRouter[Metrics Router<br/>/metrics/*]
        TLREFRouter[TLREF Router<br/>/tlref/*]
    end
    
    subgraph "Middleware Layer"
        CORSMiddleware[CORS Middleware]
        AuditMiddleware[Audit Middleware<br/>Request Logging]
        AuthMiddleware[Auth Middleware<br/>JWT Validation]
    end
    
    subgraph "Service Layer"
        BondFetcher[BondFetcher<br/>BIST Data Fetching]
        TLREFFetcher[TLREFFetcher<br/>TLREF Index Fetching]
        BondMetricsService[BondMetricsService<br/>Financial Calculations]
        MarketDataService[MarketDataService<br/>Market Data Management]
        MetricsService[MetricsService<br/>Analytics & Tracking]
        SecurityService[SecurityService<br/>JWT & Password Hashing]
    end
    
    subgraph "Background Tasks - Celery"
        CeleryWorker[Celery Worker<br/>Concurrency: 2]
        CeleryBeat[Celery Beat<br/>Scheduler]
        DailyTLREFTask[Daily TLREF Fetch<br/>18:30 Weekdays]
        BondListTask[Bond List Fetch<br/>19:00 Weekdays]
    end
    
    subgraph "Database Layer - PostgreSQL"
        BondsTable[(bonds<br/>Tahvil Bilgileri)]
        MarketDataTable[(market_data<br/>Tarih Bazlı Piyasa Verileri)]
        CalculationsTable[(calculations<br/>Tarih Bazlı Hesaplamalar)]
        TLREFRatesTable[(tlref_rates<br/>TLREF Endeks Değerleri)]
        UsersTable[(users<br/>Kullanıcılar)]
        AuditLogsTable[(audit_logs<br/>Sistem Logları)]
        BondViewsTable[(bond_views<br/>Görüntülenme Kayıtları)]
    end
    
    subgraph "Cache Layer - Redis"
        Redis[(Redis<br/>Task Queue & Cache)]
    end
    
    subgraph "External Services"
        BIST[Borsa Istanbul<br/>BIST API]
    end
    
    Browser --> Nginx
    Nginx --> Landing
    Nginx --> Dashboard
    Nginx --> Admin
    Nginx --> Auth
    Nginx --> API
    
    Landing --> API
    Dashboard --> API
    Admin --> API
    Auth --> API
    
    API --> CORSMiddleware
    CORSMiddleware --> AuditMiddleware
    AuditMiddleware --> AuthMiddleware
    
    AuthMiddleware --> AuthRouter
    AuthMiddleware --> BondsRouter
    AuthMiddleware --> MarketRouter
    AuthMiddleware --> CalcRouter
    AuthMiddleware --> AdminRouter
    AuthMiddleware --> MetricsRouter
    AuthMiddleware --> TLREFRouter
    
    BondsRouter --> BondFetcher
    BondsRouter --> BondMetricsService
    BondsRouter --> MetricsService
    MarketRouter --> MarketDataService
    CalcRouter --> MarketDataService
    TLREFRouter --> TLREFFetcher
    
    BondFetcher --> BIST
    TLREFFetcher --> BIST
    
    CeleryWorker --> Redis
    CeleryBeat --> Redis
    DailyTLREFTask --> TLREFFetcher
    BondListTask --> BondFetcher
    
    BondFetcher --> BondsTable
    TLREFFetcher --> TLREFRatesTable
    BondMetricsService --> CalculationsTable
    BondMetricsService --> BondsTable
    BondMetricsService --> TLREFRatesTable
    BondMetricsService --> MarketDataTable
    MarketDataService --> MarketDataTable
    MarketDataService --> CalculationsTable
    MetricsService --> BondViewsTable
    SecurityService --> UsersTable
    
    style API fill:#10b981,stroke:#059669,stroke-width:3px
    style Nginx fill:#3b82f6,stroke:#2563eb,stroke-width:2px
    style BondsTable fill:#f59e0b,stroke:#d97706,stroke-width:2px
    style MarketDataTable fill:#f59e0b,stroke:#d97706,stroke-width:2px
    style CalculationsTable fill:#f59e0b,stroke:#d97706,stroke-width:2px
```

### Veritabanı Şeması

```mermaid
erDiagram
    BONDS ||--o{ MARKET_DATA : "has"
    BONDS ||--o{ CALCULATIONS : "has"
    BONDS ||--o{ BOND_VIEWS : "viewed"
    USERS ||--o{ BOND_VIEWS : "views"
    USERS ||--o{ USER_METRICS : "has"
    USERS ||--o{ AUDIT_LOGS : "performs"
    
    BONDS {
        int id PK
        string isin_code UK
        string issuer
        date first_issue_date
        date maturity_date
        date next_coupon_date
        decimal next_coupon_rate
        decimal spread
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    MARKET_DATA {
        int id PK
        int bond_id FK
        date trade_date
        decimal clean_price
        decimal volume
        timestamp created_at
    }
    
    CALCULATIONS {
        int id PK
        int bond_id FK
        date calc_date
        decimal dirty_price
        decimal accrued_interest
        decimal yield_to_maturity
        decimal modified_duration
        decimal macaulay_duration
        timestamp created_at
    }
    
    TLREF_RATES {
        int id PK
        date rate_date UK
        decimal index_value
        decimal daily_rate
        timestamp created_at
    }
    
    USERS {
        int id PK
        string email UK
        string password_hash
        string role
        boolean is_active
        timestamp created_at
    }
    
    BOND_VIEWS {
        int id PK
        int bond_id FK
        int user_id FK
        timestamp viewed_at
        date settlement_date
    }
    
    USER_METRICS {
        int id PK
        int user_id FK
        date metric_date
        int bonds_viewed
        int api_calls
    }
    
    AUDIT_LOGS {
        int id PK
        int user_id FK
        string action
        string request_path
        int status_code
        timestamp created_at
    }
```

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User as Kullanıcı
    participant Frontend as Next.js Frontend
    participant API as FastAPI API
    participant AuthRouter as Auth Router
    participant SecurityService as Security Service
    participant DB as PostgreSQL
    
    User->>Frontend: Email + Password gir
    Frontend->>API: POST /api/v1/auth/login
    API->>AuthRouter: Route to /auth/login
    AuthRouter->>DB: SELECT user WHERE email = ?
    DB-->>AuthRouter: User record
    AuthRouter->>SecurityService: verify_password()
    SecurityService-->>AuthRouter: Boolean result
    
    alt Password Doğru & User Aktif
        AuthRouter->>SecurityService: create_access_token()
        SecurityService-->>AuthRouter: JWT Token
        AuthRouter-->>API: {access_token, user}
        API-->>Frontend: 200 OK + Token
        Frontend->>Frontend: localStorage.setItem('token')
        Frontend-->>User: Redirect to Dashboard
    else Password Yanlış
        AuthRouter-->>API: 401 Unauthorized
        API-->>Frontend: Error message
    end
    
    Note over User,DB: Authenticated Request
    
    User->>Frontend: API request (örn: GET /bonds)
    Frontend->>API: GET /api/v1/bonds<br/>Header: Bearer {token}
    API->>SecurityService: decode_access_token(token)
    SecurityService-->>API: Payload {sub, role}
    API->>DB: SELECT user WHERE id = ?
    DB-->>API: User object
    API->>API: Check user.is_active & role
    alt User Aktif & Authorized
        API->>DB: SELECT bonds WHERE is_active = TRUE
        DB-->>API: Bond records
        API-->>Frontend: 200 OK + Data
    else Unauthorized
        API-->>Frontend: 401/403 Error
    end
```

### Bond Detail & Calculation Flow

```mermaid
sequenceDiagram
    participant User as Kullanıcı
    participant Frontend as Dashboard
    participant API as FastAPI API
    participant BondsRouter as Bonds Router
    participant BondMetricsService as BondMetricsService
    participant DB as PostgreSQL
    participant Calculator as BondCalculator
    
    User->>Frontend: Select Bond + Date
    Frontend->>API: GET /api/v1/bonds/{isin}?settlement_date=2026-02-19
    
    API->>BondsRouter: Route to get_bond()
    BondsRouter->>DB: SELECT bond WHERE isin_code = ?
    DB-->>BondsRouter: Bond record
    
    BondsRouter->>DB: SELECT calculation<br/>WHERE bond_id = ? AND calc_date = ?
    DB-->>BondsRouter: Calculation or None
    
    alt Calculation Exists in Cache
        BondsRouter->>DB: SELECT market_data.clean_price
        DB-->>BondsRouter: Clean price
        BondsRouter-->>API: BondDetailWithMetrics (cached)
        API-->>Frontend: 200 OK + Data
    else Calculation Not Cached
        BondsRouter->>BondMetricsService: compute_metrics(bond, settlement_date)
        BondMetricsService->>DB: SELECT market_data.clean_price
        DB-->>BondMetricsService: Clean price or None
        
        alt Market Data Exists
            BondMetricsService->>BondMetricsService: parse_coupon_frequency()
            BondMetricsService->>BondMetricsService: get_current_coupon_period()
            BondMetricsService->>DB: SELECT tlref_rates (period start/end)
            DB-->>BondMetricsService: TLREF values
            BondMetricsService->>BondMetricsService: Calculate Accrued Interest
            BondMetricsService->>BondMetricsService: dirty_price = clean_price + accrued_interest
            BondMetricsService->>Calculator: BondCalculator()
            Calculator-->>BondMetricsService: Calculator instance
            BondMetricsService->>Calculator: yield_to_maturity()
            Calculator->>Calculator: numpy_financial.irr()
            Calculator-->>BondMetricsService: YTM
            BondMetricsService->>Calculator: modified_duration()
            BondMetricsService->>Calculator: macaulay_duration()
            Calculator-->>BondMetricsService: Durations
            BondMetricsService-->>BondsRouter: Metrics dict
            BondsRouter-->>API: BondDetailWithMetrics
            API-->>Frontend: 200 OK + Data
        else Market Data Missing
            BondMetricsService-->>BondsRouter: None
            BondsRouter-->>API: calculated_metrics = None
            API-->>Frontend: 200 OK (no metrics)
        end
    end
    
    Frontend-->>User: Display bond info + metrics
```

### Bond Data Fetching Flow (BIST'ten)

```mermaid
flowchart TD
    Start([Celery Beat<br/>19:00 Weekdays]) --> Trigger[Trigger fetch_bond_list Task]
    Trigger --> CeleryWorker[Celery Worker]
    CeleryWorker --> Download[Download tbliste.zip<br/>from BIST]
    Download --> Extract[Extract XLS from ZIP]
    Extract --> Parse[Parse XLS File<br/>xlrd.open_workbook]
    Parse --> ProcessRow[Process Each Row]
    ProcessRow --> ExtractISIN[Extract ISIN Code]
    ExtractISIN --> ValidateISIN{ISIN Valid?}
    ValidateISIN -->|No| NextRow[Skip Row]
    ValidateISIN -->|Yes| ExtractFields[Extract All Fields<br/>Dates, Prices, Rates]
    ExtractFields --> ParseDates[Parse Dates & Decimals]
    ParseDates --> CreateRecord[Create Bond Record]
    CreateRecord --> AddToBatch[Add to Batch]
    AddToBatch --> CheckBatch{Batch Size<br/>= 200?}
    CheckBatch -->|No| NextRow
    CheckBatch -->|Yes| UpsertBatch[UPSERT Batch to DB<br/>ON CONFLICT UPDATE]
    UpsertBatch --> NextRow
    NextRow --> MoreRows{More Rows?}
    MoreRows -->|Yes| ProcessRow
    MoreRows -->|No| GetCurrentISINs[Get Current Active ISINs]
    GetCurrentISINs --> Compare[Compare DB vs File ISINs]
    Compare --> FindMissing[Find Missing ISINs]
    FindMissing --> Deactivate[UPDATE bonds<br/>SET is_active = FALSE]
    Deactivate --> Commit[Commit Transaction]
    Commit --> End([Task Complete])
    
    style Start fill:#10b981,stroke:#059669,stroke-width:2px
    style Download fill:#3b82f6,stroke:#2563eb,stroke-width:2px
    style UpsertBatch fill:#f59e0b,stroke:#d97706,stroke-width:2px
    style End fill:#10b981,stroke:#059669,stroke-width:2px
```

### API Request Flow (Middleware Chain)

```mermaid
flowchart LR
    Request[HTTP Request] --> Nginx[Nginx<br/>Reverse Proxy]
    Nginx --> CORS[CORS Middleware<br/>Check Origin]
    CORS -->|Invalid| Reject1[403 Forbidden]
    CORS -->|Valid| Audit[Audit Middleware<br/>Extract Token]
    Audit --> ExtractToken[Extract JWT Token]
    ExtractToken --> LogRequest[Log to audit_logs]
    LogRequest --> Route{Route to Endpoint}
    Route -->|/auth/*| AuthEndpoint[Auth Endpoints]
    Route -->|/bonds/*| BondsEndpoint[Bonds Endpoints]
    Route -->|/admin/*| AdminEndpoint[Admin Endpoints]
    BondsEndpoint --> AuthCheck[get_current_user<br/>Dependency]
    AdminEndpoint --> AdminCheck[get_admin_user<br/>Dependency]
    AuthCheck --> DecodeToken[Decode JWT Token]
    DecodeToken --> ValidateToken{Token Valid?}
    ValidateToken -->|No| Reject2[401 Unauthorized]
    ValidateToken -->|Yes| GetUser[Get User from DB]
    GetUser --> CheckActive{User Active?}
    CheckActive -->|No| Reject3[401 Unauthorized]
    CheckActive -->|Yes| ProcessRequest[Process Request]
    AdminCheck --> CheckRole{Role = admin?}
    CheckRole -->|No| Reject4[403 Forbidden]
    CheckRole -->|Yes| ProcessRequest
    ProcessRequest --> Response[Return Response]
    AuthEndpoint --> Response
    Response --> End([End])
    Reject1 --> End
    Reject2 --> End
    Reject3 --> End
    Reject4 --> End
    
    style Request fill:#3b82f6,stroke:#2563eb,stroke-width:2px
    style AuthCheck fill:#f59e0b,stroke:#d97706,stroke-width:2px
    style ProcessRequest fill:#10b981,stroke:#059669,stroke-width:2px
```

## Detaylı Dokümantasyon

Tüm sistem akış şemaları, algoritmalar ve detaylı diagramlar için: [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)
