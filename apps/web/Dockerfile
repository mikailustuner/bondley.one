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

# Copy standalone output (includes server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy node_modules from builder (standalone might not include all deps in monorepo)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy static assets - Next.js serves /_next/static/* from .next/static
# Copy to both possible locations so 404s are avoided regardless of server cwd
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Find server.js and run it
WORKDIR /app
CMD ["sh", "-c", "if [ -f server.js ]; then exec node server.js; elif [ -f apps/web/server.js ]; then cd apps/web && exec node server.js; else echo 'ERROR: server.js not found' && find . -name server.js -type f 2>/dev/null && exit 1; fi"]
