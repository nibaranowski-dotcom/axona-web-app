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

---

## FND.6 — Prisma schema: Agents/Chats/Workflows/Runs (§3.2)

**Automated**
- `pnpm verify:fnd-6` — Agent/Chat/Message/Workflow/WorkflowRun/AgentRun + AgentState/MsgRole/WorkflowStatus/RunStatus enums; orgId + @@index on tenant-owned models; FK indexes on children; `trace` Json with /// pointer to ONT.1/CONF.1/AUDIT.3; no `confidence`/`approver` columns; `prisma validate`/`generate` clean.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `prisma format` no-op; `validate` valid; `generate` ok.
- [ ] Tenancy: Agent/Chat/Workflow carry `orgId` + `@@index([orgId])`. AgentRun/Message/WorkflowRun have **no** `orgId` — they inherit tenancy via an indexed FK to their parent (per §3.2). Org-scoped reads of runs go through the parent (enforced in FND.11).
- [ ] `trace` is freeform `Json` on AgentRun/WorkflowRun with a `///` pointer; the immutable event log + calibrated `confidence` + `approver` are deferred to ONT.1 / CONF.1 / AUDIT.3 — **not** added here.
- [ ] No migration run (FND.11).

**Notes**
- **Design choice (flagged):** `orgId` on Agent/Chat/Workflow is a scalar + index, *not* a formal `@relation` to `Org` — this matches §3.2 verbatim and leaves the approved §3.1 `Org` model untouched. The parent/child arrays the spec defines (`Agent.runs`, `Chat.messages`, `Workflow.runs`) DO use real `@relation`s, since Prisma requires them. If we later want DB-level FK integrity from these models to `Org`, that's a deliberate follow-up (adds back-relations to `Org`).
- `Chat.agentId`/`Chat.userId` are indexed scalar FKs (no formal relation), matching §3.2.

---

## FND.11 deferred decisions

Tracked decisions to execute at FND.11 (first migration + org-scoped client helpers). Recorded so they aren't lost while earlier schema stories match the build-spec verbatim.

- **Formal `orgId` relations + FK constraints (one consistent pass).** Schema stories FND.5–FND.10 model `orgId` as a **scalar + `@@index([orgId])`** (matching §3.2/§3.3+ verbatim); they deliberately do **not** add `@relation` to `Org` or `Org` back-relations. At FND.11, do ONE pass across **every tenant-owned model** adding the formal `orgId Org @relation(fields:[orgId], references:[id])` + the matching `Org` back-relation arrays + DB-level FK constraints. Keep it consistent — no piecemeal additions before then.
- **Per-tenant isolation (ISO.1) in the query helpers.** The org-scoped client built at FND.11 must enforce `orgId` on every query (and reach child rows — AgentRun/Message/WorkflowRun/File/MatrixColumn — through their indexed parent FK), so tenancy is guaranteed in code, not just by convention.

---

## FND.7 — Prisma schema: Projects/Files/MatrixColumn + pgvector (§3.3)

**Automated**
- `pnpm verify:fnd-7` — Project/File/MatrixColumn + ProjectStatus enum with correct fields; Project has `orgId` + `@@index([orgId])`; File/MatrixColumn have indexed `projectId`; `File.extracted` is `Json`; `File.embedding` is `Unsupported("vector")?`; `File.linkedTo` is `String?`; `prisma validate`/`generate` clean.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `prisma format` no-op; `validate` valid; `generate` ok (no warning about the `Unsupported` column).
- [ ] Tenancy: Project carries `orgId` + index; File/MatrixColumn inherit tenancy via indexed `projectId` (same pattern as FND.6). `Project.files` is a relation array; `File.project` relation present. `MatrixColumn.projectId` is a scalar FK + index (no formal relation — §3.3 has no `Project.matrixColumns` array; one-pass relation wiring is in the FND.11 deferred decisions).
- [ ] `File.embedding Unsupported("vector")?`: **expected**, not a defect. Prisma cannot introspect/manage `Unsupported` types, so the real `vector` column + ANN index are created via **raw SQL in the FND.11 migration**. `prisma generate` exposes `embedding` as an opaque field (not selectable as a typed value) — that's by design.
- [ ] `File.extracted` (Json) + `embedding` are the file-matrix substrate (MTX.1) and feed operational memory (MEM.1) — the `///` pointer marks where memory/extraction extend it; no memory/graph columns added now.
- [ ] No migration run (FND.11).

---

## FND.8 — Prisma schema: Machines + MachineSignal time-series (§3.4)

**Automated**
- `pnpm verify:fnd-8` — Machine (+ MachineKind/MachineStatus/HealthLevel enums) + MachineSignal with correct fields; Machine has `orgId` + `@@index([orgId])`; MachineSignal has the composite `@@index([machineId, ts])` (also serves machineId-prefix FK lookups); `prisma validate`/`generate` clean.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `prisma format` no-op; `validate` valid; `generate` ok.
- [ ] Tenancy: Machine carries `orgId` + index; MachineSignal inherits tenancy via indexed `machineId` (the composite index leads with `machineId`). `Machine.signals` relation array + `MachineSignal.machine` relation present.
- [ ] Time-series: composite `@@index([machineId, ts])` makes per-machine time-windowed reads efficient.
- [ ] Moat: MachineSignal is first-class typed telemetry (TEL.1) feeding operational memory (MEM.1) — modeled here as a regular table; the Timescale/hypertable + immutable event-log wiring is **deferred to TEL.1** (the `///` pointer marks it). Not added now.
- [ ] No migration run (FND.11).

---

## FND.9 — Prisma schema: value-chain entities (§3.5)

**Automated**
- `pnpm verify:fnd-9` — Supplier/Part/PurchaseOrder/WorkOrderMfg/NCR/SpcSample/Cert/Deal/Campaign/Delivery + POStatus/Severity/DealStage/Feasibility/DeliveryStage enums; every model scalar `orgId` + `@@index([orgId])`; FK indexes on PurchaseOrder (supplierId/partId/draftedByAgentId); read-path indexes `SpcSample[characteristic, ts]` + `Delivery[stage]`; `prisma validate`/`generate` clean.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `prisma format` no-op; `validate` valid; `generate` ok.
- [ ] Tenancy: all 10 models tenant-owned (scalar `orgId` + index). Cross-entity FKs (supplierId/partId/draftedByAgentId) are scalar + indexed — formal `@relation`/FK constraints come in the FND.11 one-pass.
- [ ] Read-path indexes: `SpcSample[characteristic, ts]` (SPC control-chart windows) and `Delivery[stage]` (fulfillment stage filters).
- [ ] Moat `///` pointers (no new columns): WorkOrderMfg.serial = as-built genealogy anchor → **ONT.2**; PurchaseOrder.status + draftedByAgentId = propose→approve→audit → **RBAC.4** + **AUDIT.3**; SpcSample = quality telemetry → **MEM.1**.
- [ ] No migration run (FND.11).

---

## FND.10 — Prisma schema: robotics + back-office entities (§3.6)

**Automated**
- `pnpm verify:fnd-10` — all 18 §3.6 models (Robot/TelemetryPoint/WorkOrderField/Technician/ECO/FirmwareRelease/CompatCell/AutonomyMetric/SafetyIncident/PolicyVersion/LedgerEntry/Invoice/UnitEconomic/Requisition/CVE/Obligation/ExportLicense/LegalMatter) with exact fields/types; **Severity reused** (defined once); scalar `orgId` + `@@index([orgId])` on every model; FK + read-path indexes; moat pointers; `prisma validate`/`generate` clean.
- `pnpm typecheck` — `tsc --noEmit` clean.

**Manual**
- [ ] `prisma format` no-op; `validate` valid; `generate` ok.
- [ ] `Severity` (§3.5) is **reused** by WorkOrderField/SafetyIncident/CVE — not redefined.
- [ ] Field types preserved: `Robot.lat/lng Float?`, `Robot.uptimePct Float`, `Technician.certs Json`, `*.amount/asp/cogs/marginPct Float`, `Requisition.filled/target Int`, `CVE.affectedUnits Int`, `slaDueAt/dueDate DateTime?`.
- [ ] Read-path indexes: `TelemetryPoint[robotId, ts]`, `AutonomyMetric[site, ts]`, `WorkOrderField[slaDueAt]`, `CompatCell[hwRev, fwVersion]`; FK index `WorkOrderField[techId]`.
- [ ] Moat `///` pointers (no new columns): TelemetryPoint = fleet telemetry → **TEL.1**/**MEM.1**; Robot.serial → as-built genealogy **ONT.2**; ECO.stage + PolicyVersion.state = gated change-control/rollback → **RBAC.4** + **AUDIT.3**; AutonomyMetric → **MEM.1**.
- [ ] No migration run — **next story FND.11** runs the first migration, adds the org-scoped client + the one-pass `orgId` relations/FK constraints (see "FND.11 deferred decisions"), and the raw-SQL pgvector column/index.

**Schema model is now complete (§3.1–§3.6).**
