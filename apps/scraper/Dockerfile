# Use the official Playwright image which bundles Chromium + all system dependencies
FROM mcr.microsoft.com/playwright:v1.51.1-noble AS base

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# ── Dependencies stage ────────────────────────────────────────────────────────
FROM base AS deps

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/scraper/package.json ./apps/scraper/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --filter @ocean-find/scraper...

# ── Build stage ───────────────────────────────────────────────────────────────
FROM deps AS builder

COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY apps/scraper ./apps/scraper

RUN pnpm --filter @ocean-find/types build && \
  pnpm --filter @ocean-find/db build && \
  pnpm --filter @ocean-find/scraper build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.51.1-noble AS runner

WORKDIR /app

RUN npm install -g pnpm@10

# Create non-root user for Playwright (recommended for security)
RUN groupadd -r pwuser && useradd -r -g pwuser -G audio,video pwuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/scraper/dist ./apps/scraper/dist
COPY --from=builder /app/apps/scraper/package.json ./apps/scraper/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

USER pwuser

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "apps/scraper/dist/index.js"]
