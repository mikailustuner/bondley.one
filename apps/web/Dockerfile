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

# Copy standalone output - Next.js creates the full monorepo structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy static files to correct location
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js standalone output preserves the monorepo structure
# server.js is at apps/web/server.js
WORKDIR /app/apps/web
CMD ["node", "server.js"]
