#!/usr/bin/env bash
#
# Axona — one-command local dev launcher.
# Brings up infra, ensures the DB is migrated (and seeded on request), then
# starts the web app on http://localhost:3001 in this same tab.
#
# Usage:
#   ./dev.sh           up + migrate + start (assumes already seeded)
#   ./dev.sh --seed    also (re)seed the demo narrative before starting  [idempotent]
#   ./dev.sh --fresh   reset the DB, migrate, seed, then start            [destroys dev data]
#
set -euo pipefail
cd "$(dirname "$0")"   # repo root

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

MODE="${1:-}"

# 1. Load root .env so prisma/the app see DATABASE_URL etc.
if [ ! -f .env ]; then
  bold "▸ No .env — copying from .env.example"
  cp .env.example .env
fi
set -a; . ./.env; set +a

# 2. Deps
if [ ! -d node_modules ]; then
  bold "▸ Installing deps (pnpm install)…"
  pnpm install
fi

# 3. Infra (Postgres + pgvector, Redis, MinIO). Don't use `--wait`: the one-shot
#    `createbuckets` container exits 0, which `--wait` would treat as a failure.
bold "▸ Bringing up infra (Postgres + pgvector, Redis, MinIO)…"
docker compose up -d

bold "▸ Waiting for Postgres…"
PGUSER_EFF="${POSTGRES_USER:-axona}"
PGDB_EFF="${POSTGRES_DB:-axona}"
for i in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U "$PGUSER_EFF" -d "$PGDB_EFF" >/dev/null 2>&1; then
    echo "  Postgres ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  Postgres didn't become ready in 60s — check 'docker compose ps'." >&2
    exit 1
  fi
  sleep 1
done

# 4. Schema + data
if [ "$MODE" = "--fresh" ]; then
  bold "▸ Resetting the database (destroys local dev data)…"
  pnpm --filter @axona/db exec prisma migrate reset --force --skip-seed
  pnpm --filter @axona/db run db:seed
elif [ "$MODE" = "--seed" ]; then
  bold "▸ Applying migrations…"
  pnpm --filter @axona/db exec prisma migrate deploy
  pnpm --filter @axona/db exec prisma generate >/dev/null
  bold "▸ Seeding the cross-module narrative (idempotent)…"
  pnpm --filter @axona/db run db:seed
else
  bold "▸ Applying migrations…"
  pnpm --filter @axona/db exec prisma migrate deploy
  pnpm --filter @axona/db exec prisma generate >/dev/null
fi

# 5. Go
echo
bold "▸ Axona is starting on:  http://localhost:3001"
echo "    Mission Control (launcher) · sidebar nav · seeded alert chips"
echo "    Search API:  curl 'http://localhost:3001/api/search?q=quality'"
echo "    (Ctrl+C stops the web server; infra keeps running — 'docker compose down' to stop it.)"
echo
exec pnpm --filter @axona/web dev
