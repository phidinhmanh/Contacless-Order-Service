FROM node:20-alpine AS base

# --- 1. Install dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Point to the frontend folder specifically
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# --- 2. Build the source code ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy all frontend files (including tsconfig.json and lib/)
COPY frontend/ . 

ENV NEXT_TELEMETRY_DISABLED 1

# Standard Next.js build
RUN npm run build

# --- 3. Production runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy essential files for standalone mode
COPY --from=builder /app/public ./public

# Standalone mode setup (Standard for Next.js 14/15+)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]