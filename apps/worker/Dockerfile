# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Axona WORKER (@axona/worker) — the long-lived BullMQ job engine on Railway.
#
# Runs `tsx src/index.ts` (the repo's own start script) — TypeScript executed at
# runtime, resolving the @axona/* workspace packages as source, so there is NO build
# step. Shares DATABASE_URL + REDIS_URL with the web service; has NO public port.
#
# Build context MUST be the repo ROOT (Railway: Root Directory "/", Config-as-Code
# apps/worker/railway.json → this Dockerfile). Monorepo pruned with `turbo prune`.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 1) Prune the workspace to @axona/worker + its transitive workspace deps.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.3 prune @axona/worker --docker

# 2) Install (devDeps included — the worker runs via `tsx` at runtime) + Prisma client.
FROM base AS builder
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
# The worker imports @axona/db → generate the Prisma client (no Next build here).
RUN pnpm --filter @axona/db exec prisma generate

# 3) Runner — boot the BullMQ worker (no HTTP port). Migrations are owned by the WEB
#    service's release step; the worker only reads/writes the already-migrated schema.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
CMD ["pnpm", "--filter", "@axona/worker", "start"]
