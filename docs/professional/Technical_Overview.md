# Bondley: Advanced Technical Overview (v2.0)

This document provides a comprehensive deep-dive into the Bondley architecture, serving as the technical source of truth for engineering audits and institutional stakeholders.

## 1. Executive Summary
Bondley is a financial engineering platform that provides high-fidelity analytics for the Turkish Fixed-Income market. It distinguishes itself by integrating real-time KAP (Public Disclosure Platform) data with official BIST (Borsa Istanbul) listings, resolving data conflicts mathematically to provide the most accurate yield and duration metrics available in the market.

## 2. Directory Architecture (Turborepo)
The project utilizes a monorepo structure powered by **Turborepo** for unified dependency management and rapid CI/CD pipelines.

```text
.
├── apps
│   ├── api              # FastAPI Backend (Python 3.11+)
│   │   ├── app
│   │   │   ├── api      # v1 REST Routes
│   │   │   ├── core     # Security, Config, Database initialization
│   │   │   ├── models   # SQLAlchemy 2.0 (Async) models
│   │   │   ├── schemas  # Pydantic v2 validation models
│   │   │   ├── services # Domain Logic & Bond Mathematics
│   │   │   └── tasks    # Celery Workers & Periodic Schedules
│   │   └── migrations   # Alembic Database Migration scripts
│   └── web              # Next.js Frontend (React 18+)
│       ├── src
│       │   ├── app      # App Router (Pages & Layouts)
│       │   ├── components # Shadcn/UI Component Library
│       │   └── lib      # API Client & State Management
├── docs                 # Professional & Technical Documentation
└── docker               # Production configuration files
```

## 3. Financial Domain Logic & Services
The core intelligence of Bondley is encapsulated in granular services that follow the Single Responsibility Principle.

### Bond Calculation Motor (`app/services/bond_calculator.py`)
- **Engine**: Pure Python implementation using the `Decimal` library to ensure 0-tolerance for floating-point errors.
- **Algorithms**:
    - **Yield to Maturity (YTM)**: Employs the Newton-Raphson approximation for IRR calculation.
    - **Duration/Convexity**: Implements Macualay and Modified Duration formulas with second-order convexity analysis.
    - **Day Count**: Standardizes on `Act/Act` (ISMA-compliant) for government and corporate yields.

### Data Resolution Engine (`app/services/kap_data_resolver.py`)
- **Arbitration**: A proprietary logic layer that compares BIST `tbliste` metadata with active KAP disclosures.
- **Overriding**: Automatically triggers a "resolved state" if KAP data (e.g., a new coupon rate for a floating bond) is timestamped after the last BIST official update.

## 4. Data Persistence Layer
Bondley uses **PostgreSQL 15+** with optimized indexing strategy for time-series financial data.

| Table | Purpose | Volume / Density |
| :--- | :--- | :--- |
| `bonds` | Official metadata (ISIN, Issuer, Coupon Freq). | ~3,000+ active records. |
| `market_data` | Daily price snapshots (Clean Price). | Time-series, indexed by `(bond_id, trade_date)`. |
| `calculations` | Pre-computed metrics (YTM, Duration, Spread). | High-density daily snapshots. |
| `kap_disclosures`| Text and metadata from KAP announcements. | Semi-structured (JSON) storage for transparency. |
| `tlref_rates` | Benchmark overnight rates for BIST. | Critical dependency for interest rate modeling. |

## 5. API Ecosystem (FastAPI Manifest)
The API is designed to be highly modular and RESTful, allowing for future "API-as-a-Service" monetization.

- **Auth Endpoints (`/api/v1/auth`)**: JWT Login, Refresh Cycle, MFA Setup, E-mail Verification.
- **Bond Insights (`/api/v1/bonds`)**: Multi-filter listing, historical metrics, and individual ISIN-level detail.
- **Scenarios (`/api/v1/bonds/{isin}/scenario`)**: Real-time simulation of TLREF shocks (+/- bp changes) on bond price.
- **KAP Feed (`/api/v1/kap`)**: Aggregated news feed filtered by ISIN or Category.
- **Admin Tools (`/api/v1/admin`)**: Manual synchronization triggers, user management, and system health telemetry.

## 6. Asynchronous Task Choreography
Background tasks are orchestrated via **Celery** with **Redis** as a transmission broker.

```mermaid
sequenceDiagram
    participant S as Scheduler (Beat)
    participant W as Worker Cluster
    participant E as External API (BIST/KAP)
    participant D as DB

    S->>W: TRIGGER (17:00 IST) KAP Fetch
    W->>E: Scraping Disclosures
    E-->>W: Raw Data
    W->>D: Upsert Disclosures
    
    S->>W: TRIGGER (17:15 IST) Market Data Sync
    W->>E: Fetch tbliste.zip
    E-->>W: XLS Data
    W->>D: Update Prices
    
    S->>W: TRIGGER (17:20 IST) Calculations
    W->>D: Fetch Prices & Overrides
    W->>W: Math Engine Execution
    W->>D: Store YTM/Duration
```

## 7. Infrastructure & Deployment
Bondley is a container-first application, ensuring 1:1 environment parity between development and production.

- **Orchestration**: Docker Compose with distinct service layers.
- **External Proxy**: Apache2 handles system-level SSL and HSTS.
- **Internal Proxy**: Nginx handles internal routing, static file serving, and load balancing between Web and API.
- **Reliability**: Automated health checks for the Postgres and Redis containers ensure high availability for the worker cluster.
