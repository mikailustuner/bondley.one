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

# Standalone output: server.js is at ROOT of standalone, not in apps/web
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets: must be under apps/web/.next/static for Next to serve them
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is at /app/server.js (root of standalone)
CMD ["node", "server.js"]
