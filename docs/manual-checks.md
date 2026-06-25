# Manual checks

One entry per story. Each lists the automated verify command plus any human-eye
checks that can't be scripted.

---

## FND.1 — Scaffold pnpm + Turborepo monorepo

**Automated**
- `pnpm install` — resolves the workspace (apps/web, apps/worker, packages/db, packages/agents, packages/config).
- `pnpm verify:fnd-1` — asserts all scaffold paths exist.
- `pnpm typecheck` — `tsc --noEmit` clean across every workspace package.

**Manual**
- [ ] `pnpm-workspace.yaml` lists `apps/*` and `packages/*`; `pnpm install` links the three `@axona/*` workspace deps (no registry fetch for them).
- [ ] `turbo.json` defines `dev` / `build` / `lint` / `typecheck` / `verify` tasks.
- [ ] `apps/web` is Next.js 14 App Router (`app/layout.tsx` + `app/page.tsx`); `transpilePackages` includes the three internal packages.
- [ ] `apps/worker` is a standalone Node process stub (BullMQ deps present; queues land in WF.1).
- [ ] `packages/db/prisma/schema.prisma` has the Postgres datasource + pgvector extension; models land in FND.5–FND.10.
- [ ] Shared TS base lives in `packages/config/tsconfig/base.json` and every package extends it.
- [ ] No design tokens / Tailwind yet — that is FND.2 (next story).

---

## FND.2 — Design tokens → Tailwind + self-hosted fonts

**Automated**
- `pnpm verify:fnd-2` — tokens.css has all variables + only allowed hex; fonts wired; Tailwind maps tokens 1:1; no raw hex outside tokens.css.
- `pnpm typecheck` — `tsc --noEmit` clean across the workspace.

**Manual (run `pnpm --filter @axona/web dev`, open `/`)**
- [ ] Body text renders in **Archivo**; mono labels (uppercase chips, surface names) render in **JetBrains Mono** — both self-hosted (Network tab shows no requests to fonts.googleapis.com).
- [ ] StatusBadge tones read correctly: **Live** = green on tint, **Working** = lime signal, **Critical** = ink (NOT red), **Offline** = muted on panel.
- [ ] Primary button is lime with `--accent-ink` text; secondary is paper with a hairline border.
- [ ] Header shows the **dotted-grid** motif; surface swatches (paper/panel/panel-2/skeleton) step in warmth.
- [ ] No emoji; no shadows (hairlines only); nothing reads "all lime."

**Notes**
- Single source of truth: `packages/config/styles/tokens.css`. Tailwind palette is **replaced** (not extended) via `@axona/config` → only semantic utilities compile (`bg-red-500` won't).
- `next build` verified once: **compiled successfully, 4 static pages** — next/font fetched Archivo + JetBrains Mono at build time (self-hosted into the bundle). If a future build runs offline and font fetch is blocked, the dev-server check above still covers the font wiring.

---

## FND.3 — docker-compose dev environment

**Automated**
- `pnpm verify:fnd-3` — compose defines postgres(pgvector)+redis+minio with healthchecks/volumes; vector init present; bucket-create step; env keys present.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual (requires Docker running)**
- [ ] `cp .env.example .env` then `docker compose up -d` — all services become healthy: `docker compose ps` shows postgres/redis/minio `(healthy)` and `createbuckets` exited 0.
- [ ] **pgvector:** `docker compose exec postgres psql -U axona -d axona -c "CREATE EXTENSION IF NOT EXISTS vector;"` → `CREATE EXTENSION` (already enabled by the init script on first boot; this should be idempotent).
- [ ] Confirm the type exists: `docker compose exec postgres psql -U axona -d axona -c "\dx"` lists `vector`.
- [ ] **Redis:** `docker compose exec redis redis-cli ping` → `PONG`.
- [ ] **MinIO console:** open `http://localhost:9001` (login `axona` / `axona-secret`); bucket `axona-files` exists. S3 API on `http://localhost:9000`.
- [ ] Persistence: `docker compose down && docker compose up -d` keeps data (named volumes `postgres-data` / `redis-data` / `minio-data`).
- [ ] Tear down: `docker compose down` (add `-v` to wipe volumes).

**Notes**
- The `vector` extension auto-enables on **first** boot only (initdb runs against an empty data dir). If you created the volume before adding the init script, run the `CREATE EXTENSION` command above once, or `docker compose down -v` to re-init.
- No real secrets committed — all credentials are dev defaults sourced from `.env`.

**Live-verified once (2026-06-25):** `docker compose up -d` → postgres/redis/minio all `(healthy)`, `createbuckets` logged "bucket ready: axona-files". `vector` extension present at **v0.8.3** (auto-created by init SQL on first boot; `CREATE EXTENSION` confirmed idempotent). Redis `PONG`; MinIO console HTTP 200; bucket `axona-files` listed. `docker compose down` left the three named volumes intact.

---

## FND.4 — CI + git hooks + shared lint/format config

**Automated**
- `pnpm verify:fnd-4` — hooks present + executable; pre-push blocks main; shared eslint/prettier consumed by all workspaces; CI workflow has the right jobs.
- `pnpm lint` — turbo lint (all packages, incl. `next lint`) + root `src/scripts`, clean.
- `pnpm format:check` — Prettier clean (prose/`specs` ignored via `.prettierignore`).
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] Hooks active: `git config core.hooksPath` → `.husky` (set by the `prepare` script on `pnpm install`).
- [ ] **pre-commit** runs on `git commit`: lint-staged lints + Prettier-formats only staged files.
- [ ] **pre-push blocks main**: on `main`, `git push` aborts with the guard message; on a feature branch it runs `typecheck` + `verify:all` then allows the push. Override for maintained foundation pushes: `AXONA_ALLOW_MAIN_PUSH=1 git push`. (Verified once: blocked on main exit 1; override path runs the gate.)
- [ ] **CI** (`.github/workflows/ci.yml`) runs on push-to-main + every PR: install → lint → typecheck → verify:all. Confirm green on the first PR in `nibaranowski-dotcom/axona-web-app`.

**Notes**
- Native git hooks (no husky dependency): `.husky/` scripts + `core.hooksPath`, installed via the root `prepare` script so they activate on clone.
- Shared config lives in `@axona/config`: ESLint base (`./eslint`) + Prettier (`./prettier`); each workspace extends it; the default Tailwind/eslint palettes are not relaxed.
- Remote branch protection on `main` (GitHub settings) is the server-side complement to the local pre-push guard — configure it in the repo settings.

---

## FND.5 — Prisma schema: Core/tenancy (§3.1)

**Automated**
- `pnpm verify:fnd-5` — Org/User/Module + Role/ModuleGroup enums with correct fields; User has `orgId` relation + `@@index([orgId])`; Module has no `orgId`; `prisma validate` passes; `prisma generate` succeeds.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `pnpm --filter @axona/db exec prisma format` is a no-op (schema already canonical).
- [ ] `prisma validate` → "schema is valid"; `prisma generate` → "Generated Prisma Client".
- [ ] Tenancy invariant: every tenant-owned model carries `orgId` + index. Here only `User` is tenant-owned; `Org` is the tenant root; `Module` is a global catalog (intentionally no `orgId`). Subsequent schema stories (FND.6–FND.10) must keep `orgId` + `@@index([orgId])` on every tenant-owned model.
- [ ] **No migration run** — first migration + org-scoped client helpers are FND.11.

**Notes**
- Generator enables `previewFeatures = ["postgresqlExtensions"]` so the `extensions = [pgvector]` datasource line validates.
- With pnpm, the generated client lands in the virtual store (`node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client`), not `node_modules/.prisma/client` — `verify` shells out to `prisma generate` rather than path-checking, so it's version-agnostic.
