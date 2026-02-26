# FinCalc Production Deployment & Remediation Guide

This guide details the procedures for deploying FinCalc into a production environment, complete with the latest stability, observability, and security remediations.

## 1. Prerequisites
Before deploying, ensure the target server (e.g., Google Cloud Compute Engine VM) has the following installed:
- Docker & Docker Compose
- `git`
- `openssl` (for secret generation)
- `gsutil` (if using Google Cloud Storage for database backups)

## 2. Secrets Management & Environment Setup

The application relies heavily on secure cryptographic secrets. Never commit `.env.production` to the repository.

1.  Navigate to the project root and run the secrets generator:
    ```bash
    ./scripts/generate_secrets.sh
    ```
2.  Copy `.env.example` (or `.env.production` template) to `.env`:
    ```bash
    cp .env.production .env
    ```
3.  Open `.env` and fill in the fields labeled "SECRETS" with the output from the generator script. Specifically, you need:
    -   `POSTGRES_PASSWORD`
    -   `REDIS_PASSWORD`
    -   `JWT_SECRET_KEY`
    -   `JWT_REFRESH_SECRET_KEY`
    -   `MFA_ENCRYPTION_KEY`
4.  Configure external service credentials in `.env`:
    -   `SENTRY_DSN` (for error tracking)
    -   `DOMAIN` (e.g., `fincalc.com`)
    -   `CERTBOT_EMAIL` (for SSL)
    -   `ADMIN_EMAIL` and `ADMIN_INIT_PASSWORD`

## 3. Sentry Integration (Error Tracking)

Sentry is integrated into both the FastAPI backend and Next.js frontend.
*   **Backend:** Automatically initializes on startup if `SENTRY_DSN` is present in `.env`.
*   **Frontend:** The Next.js build process uses the Sentry webpack plugin to upload sourcemaps. Enusre `NEXT_PUBLIC_SENTRY_DSN` and your Sentry Auth Token are set appropriately in your environment or Vercel/Docker config.

## 4. Database Backups

Database backups are fully automated using a shell script that zips the SQL dump and uploads it to an object storage bucket.

1.  Ensure you have a Google Cloud Storage bucket created (e.g., `gs://fincalc-production-backups`).
2.  Set `GCS_BACKUP_BUCKET` in your `.env` file to your bucket name.
3.  The `deploy.sh` script automatically sets up a nightly cron job (at 03:00 AM) that executes `./scripts/backup_db.sh`.
4.  Local backups (stored in `/tmp/fincalc_backups/`) older than 7 days are automatically purged to prevent disk space exhaustion.

## 5. Deployment Execution

Once your `.env` is fully configured, initiate the zero-downtime deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

**What the deploy script does:**
1.  **Pre-flight Checks:** Verifies `.env` exists and that default weak passwords have been changed. Also verifies DNS propagation for the subdomains (`www`, `admin`, `api`, `dashboard`).
2.  **SSL Certificate:** Uses Certbot via a temporary Nginx container to perform an ACME challenge and fetch wild/multi-domain SSL certificates.
3.  **Docker Build & Up:** Pulls, builds, and runs the `docker-compose.prod.yml` services in detached mode.
4.  **Health Checks:** Verifies container uptime.
5.  **Cron scheduling:** Injects the backup script into the host's crontab.

## 6. Accessing the System
Once deployed, the system is routed via the Nginx proxy:
*   **Landing Page:** `https://your-domain.com`
*   **User Dashboard:** `https://dashboard.your-domain.com`
*   **Admin Panel:** `https://admin.your-domain.com`
*   **API & Docs:** `https://api.your-domain.com/api/docs`

You can monitor continuous health and errors directly from your Sentry dashboard.
