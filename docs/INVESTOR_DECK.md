# FinCalc Investor Deck

## 1. The Problem
While our initial focus is the Turkish bond and fixed-income market (Kira Sertifikaları / Sukuk, BIST TLREF, Devlet Tahvilleri), the core problem is global: fixed-income markets in emerging and developing economies are opaque, fragmented, and notoriously difficult to analyze using standard retail tools. 

Globally, institutional investors, portfolio managers, and high-net-worth individuals rely on expensive, legacy monolithic software (like Bloomberg Terminals) or manually intensive Excel spreadsheets to track complex disclosures, calculate yields, and monitor reference rates.

## 2. The Solution: FinCalc
FinCalc is a modern, high-performance, and fully automated SaaS platform bridging the gap between raw BIST/KAP data and actionable financial intelligence.

*   **Automated Intelligence:** Instantly parses complex KAP announcements (XML/XLS) into normalized database structures.
*   **Real-time Analytics:** Daily asynchronous ingestion of BIST TLREF indices and dirty/clean price yield calculations.
*   **Precision Tooling:** Bank-grade mathematical precision (using PostgreSQL `NUMERIC` types, never floats) for cash flow and spread analysis.
*   **Modern Accessibility:** A beautiful, responsive Web3-esque dashboard built on Next.js, allowing institutional-grade analysis from any device.

## 3. Market Opportunity & Global Expansion
Turkey's fixed-income market serves as our highly active "beachhead" market, particularly in the rapidly growing Islamic finance sector (Sukuk/Kira Sertifikaları). 

However, our vision is global. The same architectural engine and AI pipelines built for BIST/KAP are designed to be entirely market-agnostic. Following our proving ground in Turkey, we plan to rapidly expand into the MENA region, European corporate bonds, and the multi-trillion-dollar global Sukuk and Eurobond markets.

## 4. Product Architecture (The Moat)
Our competitive advantage lies in our state-of-the-art technology stack, designed for massive scale, zero-downtime, and unyielding accuracy:
*   **Backend:** Python FastAPI + PostgreSQL + Redis + Celery. Asynchronous data pipelines capable of brushing through thousands of KAP disclosures in seconds.
*   **Frontend:** Next.js 14+ Monolith utilizing advanced edge middleware for seamless subdomain routing (`admin.`, `dashboard.`, `api.`).
*   **Security & Reliability:** Integrated MFA (Time-based One Time Passwords), strict rate limiting, automated Google Cloud Storage backups, and real-time Sentry error tracking integrated directly into the CI/CD pipeline.

## 5. Business Model (B2B SaaS)
A tiered subscription model tailored to the needs of the market:
*   **Free Tier:** Basic bond screening, delayed market data, and limited yield calculations.
*   **Premium User:** Real-time data, advanced portfolio calculations, customized KAP alerts, and historical TLREF charting.
*   **Pro/Enterprise User:** API Access, unlimited calculations, Excel exports, dedicated account management, and institutional multi-seat licenses.

## 6. Traction & Roadmap
*   **Phase 1 (Completed):** Core calculation engine, BIST/KAP automated ingestion pipelines, Next.js dashboard infrastructure, Subdomain routing, Core Admin Panel.
*   **Phase 2 (Completed):** Production readiness, Sentry integration, automated backups, Docker swarm/compose container orchestration setups.
*   **Phase 3 (Current):** Sukuk (Kira Sertifikaları) parser integration and enhanced TLREF spread analysis logic.
*   **Phase 4 (Future):** AI-driven announcement summarization, predictive yield curve modeling, mobile application rollout, and integration of first global markets (MENA region Sukuks and Eurobonds).

## 7. The Ask
We are raising capital to accelerate our Go-To-Market strategy in Turkey, hire specialized quantitative developers to expand our instrument coverage (Eurobonds, Global Derivatives), and fund the internationalization of the platform to capture the broader emerging markets and global Islamic finance footprint.
