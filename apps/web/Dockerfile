FROM node:20-alpine AS base
WORKDIR /app

# --- deps: install all workspace dependencies ---
FROM base AS deps
COPY package.json package-lock.json* turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --legacy-peer-deps

# --- builder: build the Next.js app ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY package.json turbo.json ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN npx next build

# --- runner: production image ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Next.js standalone output preserves monorepo structure
# Standalone contains: node_modules/, apps/web/server.js, packages/shared/, etc.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy static assets (standalone already has public, but we ensure it's there)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Node.js module resolution: look in /app/node_modules (standalone root)
ENV NODE_PATH=/app/node_modules

# Standalone output: try both possible locations for server.js
WORKDIR /app
CMD ["sh", "-c", "if [ -f apps/web/server.js ]; then cd apps/web && exec node server.js; elif [ -f server.js ]; then exec node server.js; else echo 'ERROR: server.js not found. Contents:' && ls -la && find . -name server.js 2>/dev/null && exit 1; fi"]
