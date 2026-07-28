# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Axona WEB (@axona/web) — Next.js on Railway.
#
# Monorepo build PRUNED to the web app with `turbo prune` (pnpm + Turborepo).
# Build context MUST be the repo ROOT — on Railway set the service's Root Directory
# to "/" and Config-as-Code to apps/web/railway.json (which points dockerfilePath
# here). Never build from apps/web/ alone; the workspace deps live above it.
#
# MIGRATE.1: database migrations run via the railway.json `preDeployCommand`
# (`prisma migrate deploy`) — this image NEVER runs `prisma db push`.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl + ca-certificates: Prisma's engine needs openssl at generate + runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 1) Prune the workspace to @axona/web + exactly its transitive workspace deps.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.3 prune @axona/web --docker

# 2) Install from the pruned lockfile (cached across source-only changes), then build.
FROM base AS builder
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
# The web app imports @axona/db → generate the Prisma client before the Next build.
RUN pnpm --filter @axona/db exec prisma generate
# A build-only placeholder so the Auth.js config initialises during `next build`
# (identical to CI). The REAL AUTH_SECRET is injected at runtime by Railway.
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV NODE_ENV=production
RUN pnpm --filter @axona/web build

# 3) Runner — carry the full pruned tree so pnpm + the Prisma CLI stay available for
#    the release-phase `prisma migrate deploy`; Next is served via `next start` on $PORT.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
# Railway injects $PORT; `next start` (railway.json startCommand) binds to it.
EXPOSE 3001
CMD ["pnpm", "--filter", "@axona/web", "exec", "next", "start"]
