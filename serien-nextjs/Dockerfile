# syntax=docker/dockerfile:1.6
# Multi-Stage-Build für Next.js 15 + Prisma + Sharp
# Optimiert für serien.de Migration Vercel → Hetzner + Coolify (Feb 2026)
#
# Voraussetzung: `output: 'standalone'` in next.config.ts (siehe MIGRATION-GUIDE Schritt 3)
# Final Image: ~180 MB (statt ~1.5 GB ohne Multi-Stage)

# ==============================================================================
# STAGE 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
    else echo "⚠️  No lockfile — falling back to yarn install (Builds nicht reproduzierbar!)"; yarn install; fi

# ==============================================================================
# STAGE 2: Build
# ==============================================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Prisma braucht DATABASE_URL zur Build-Zeit für `generate` — Dummy reicht
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client generieren
RUN npx prisma generate

# Next.js Build (produziert .next/standalone durch output-Setting)
RUN if [ -f yarn.lock ]; then yarn build; \
    elif [ -f package-lock.json ]; then npm run build; \
    elif [ -f pnpm-lock.yaml ]; then pnpm build; \
    else npm run build; fi

# ==============================================================================
# STAGE 3: Runtime
# ==============================================================================
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Nur die minimal nötigen Runtime-Artefakte kopieren
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

# Healthcheck: Homepage muss 200 liefern
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# tini als PID 1 → sauberes Shutdown-Signal-Handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
