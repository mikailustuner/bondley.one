# Sentry Error Tracking Setup Guide

Sentry is integrated into the FinCalc system to immediately capture and report errors from both the frontend (Next.js) and the backend (FastAPI).

By default, the system runs safely even if Sentry is not configured. However, configuring Sentry is highly recommended for production.

## 1. Create a Sentry Account & Project
1. Go to [sentry.io](https://sentry.io/) and create a free account or log in to your existing account.
2. In the Sentry dashboard, click **Create project** (or add a new project).
3. Choose **Next.js** as the platform (this will give you a DSN that you can use for both the frontend and the backend within the same project, or you can create two separate projects: one for FastApi/Python and one for Next.js).
4. Name your project (e.g., `fincalc-web` and `fincalc-api`).
5. Sentry will provide you with a string called a **DSN** (Data Source Name). It looks like this:
   `https://abc123xyz@o456.ingest.sentry.io/789`

## 2. Configure the Backend (FastAPI)
1. Open your `.env` (or `.env.production`) file located in the root of the project.
2. Add the DSN you obtained from Sentry:
   ```env
   SENTRY_DSN=https://your-backend-dsn-here@o...
   ```
3. Restart the API container (`docker-compose restart api`). The API will now automatically log all `500 Internal Server Error` traces to your Sentry dashboard.

## 3. Configure the Frontend (Next.js)
1. Open the same `.env` (or `.env.production`) file.
2. Add the DSN for the frontend:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn-here@o...
   ```

### (Optional) Uploading Source Maps
To see the exact line of unminified TypeScript code that caused an error in production, Next.js needs to upload Source Maps to Sentry during the build process.

If you wish to enable this:
1. Get a **Sentry Auth Token** from the Settings -> Developer Settings -> Auth Tokens page in your Sentry dashboard.
2. Add to your `.env` file:
   ```env
   SENTRY_AUTH_TOKEN=your_long_auth_token_here
   ```
3. Run the deployment script (`./deploy.sh`). The frontend container build will detect the `SENTRY_AUTH_TOKEN` and push the source maps.

## 4. How to Test It
Once deployed, you can test Sentry manually:
*   **Backend:** Make a request to a non-existent endpoint or trigger a forced error in a Celery task.
*   **Frontend:** Open the browser console and force an exception, or navigate to a broken page.
Both incidents should appear in your Sentry.io "Issues" tab within seconds.
