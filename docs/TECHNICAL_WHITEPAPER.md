# FinCalc Technical Whitepaper
**A High-Performance Framework for Advanced Fixed Income & Sukuk Analysis**

## 1. Abstract
FinCalc is designed from the ground up to solve the computational and data-ingestion challenges inherent in the Turkish fixed income market (BIST / KAP). By strictly adhering to a microservices-inspired monolithic model, combining an asynchronous Python backend, a decoupled Next.js frontend, and a highly resilient PostgreSQL relational database, FinCalc guarantees absolute mathematical precision and real-time observability.

## 2. Core Architecture
The system employs a multi-tiered architecture orchestrated completely via Docker Compose.

*   **API Layer (Python / FastAPI):** Selected for its asynchronous capabilities via standard `async`/`await` patterns. It natively handles massive concurrent data fetching (BIST TLREF zips, KAP disclosures).
*   **Web Layer (TypeScript / Next.js):** The frontend relies on Next.js edge-networking capabilities and native monolithic middleware to route users automatically between `landing`, `dashboard`, and `admin` portals without loading heavy micro-apps.
*   **Reverse Proxy (Nginx):** Manages SSL termination (managed automatically by a Certbot sidecar container) and domain routing.
*   **Broker & Worker (Redis / Celery):** In order to prevent the FastAPI `uvicorn` workers from locking during heavy Excel parsing, all ingestion tasks (parsing hundreds of Megabytes of KAP ZIP files) are strictly delegated to a Celery worker array.

## 3. Data Integrity & Mathematics
Financial integrity is the paramount concern within FinCalc.

*   **Floating-Point Elimination:** The database strictly uses `DECIMAL(22, 3)` and `DECIMAL(18, 6)` for all financial numbers (Price, Yield, Volume, Ratios). Python’s internal representation bridges directly with PostgreSQL's `pg_catalog.numeric` types without precision loss.
*   **Calculations Module:** The `app.services.formulas` module utilizes `numpy` and exact mathematical models (Dirty Price, Accrued Interest, Modified Duration) according to Borsa Istanbul's official bond valuation methodologies. Yields to Maturity (YTM) are iteratively processed via root-finding algorithms where standard analytic solutions are unavailable.

## 4. Automation & Data Pipelines
The BIST and KAP markets publish data inconsistently. FinCalc resolves this via robust, scheduled Celery Tasks (Celery Beat):

1.  **TLREF Daily Index Pipeline:** Fetches the `.csv` payload daily at scheduled market closure times, validating the index signature against prior days to ensure continuity.
2.  **KAP Batch Processing:** Polling KAP index feeds, downloading specific XML disclosures or attachments, converting them to structured `kap_disclosure_details` tabular formats, and linking them to internal `bonds` records via the `isin_code` foreign key.

## 5. Security & Availability Operations
*   **Authentication Flow:** OAuth2 Password Bearer implementation utilizing short-lived access JWTs and long-lived Refresh tokens stored with hardware-backed peppered bcrypt hashing.
*   **MFA Storage:** TOTP secrets are encrypted at rest using a symmetric AES-256 key injected via the `MFA_ENCRYPTION_KEY` environment variable.
*   **Incident Response (Sentry):** All runtime exceptions in both frontend and backend are asynchronously funneled to Sentry.io, mapping back to original source code using Next.js sourcemaps and FastAPI stack traces.
*   **Disaster Recovery:** Automated cron-driven `/scripts/backup_db.sh` scripts safely serialize the entire PostgreSQL volume nightly to Google Cloud Storage.

## 6. Frontend Ecosystem
*   **Styling:** A meticulously crafted Shadcn/UI and Tailwind CSS foundational layer. The theme favors dark, glassmorphic designs ("Precision Command Center" aesthetic) reducing eye strain for portfolio managers staring at the screen for 8+ hours a day.
*   **State Management:** React Server Components (RSC) handle data fetching. Client components utilize React’s standard hook ecosystems minimizing heavy global state containers (no Redux).
*   **Subdomain Middleware:** The `src/proxy.ts` intercepts Host headers and NextUrl paths, transparently redirecting/rewriting `dashboad.` vs `admin.` requests to their respective `/src/app/(dashboard)` sub-routers.

## 7. Market Ontology & Global Scalability Vectors
While the current ingestion pipelines are heavily optimized for the Turkish context (BIST / KAP), the underlying data models and calculation engines are fundamentally market-agnostic. 

The schema's deliberate generic nature—abstracting concepts like `currency`, `day_count_convention`, `yield_formula`, and `coupon_frequency`—ensures that the system can seamlessly ingest and process instruments from any global exchange. The architectural roadmap includes rapid horizontal scaling to incorporate global Eurobonds, US Treasuries, MENA regional corporate debt, and complex, multi-tranche global Islamic finance derivatives.
