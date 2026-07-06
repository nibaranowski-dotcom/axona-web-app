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

## FND.11 deferred decisions — CLOSED (FND.11)

Tracked decisions opened across FND.5–FND.10, executed in FND.11. See the "FND.11 — Migrations + org-scoped client + isolation" entry below for verification.

- [x] **Formal `orgId` relations + FK constraints (one consistent pass).** FND.11 added `org Org @relation(fields:[orgId], references:[id], onDelete: Cascade)` to every tenant-owned model + the matching `Org` back-relation arrays + DB-level FK constraints (44 FKs in the init migration).
- [x] **Per-tenant isolation (ISO.1) in the query helpers.** `dbForOrg(orgId)` (a Prisma `$extends` query injector) scopes every tenant-model read/write; children (AgentRun/Message/WorkflowRun/File/MatrixColumn/MachineSignal) are reached through their indexed parent FK. Proven by the cross-tenant isolation test.
- [ ] **(Still deferred)** genealogy FKs + immutable event log → ONT.1/ONT.2; Timescale/hypertable for telemetry → TEL.1. `MatrixColumn.projectId` left scalar until a story needs the relation.

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

---

## FND.11 — Migrations + org-scoped client + isolation

**Automated**
- `pnpm verify:fnd-11` — schema relations (org + cross-entity FKs), `dbForOrg`, pagination, init + pgvector ANN migrations; **plus** integration checks (migration applied, cross-tenant isolation, create-injection) when `DATABASE_URL` is set. Integration auto-skips in CI (no DB), so `verify:all` stays CI-safe.
- `pnpm typecheck` + root `tsc --noEmit -p tsconfig.json` — clean.

**Manual (run `docker compose up -d` first; export DATABASE_URL)**
- [ ] `pnpm --filter @axona/db exec prisma migrate status` → "Database schema is up to date" (2 migrations: `_init`, `_enable_pgvector_ann`).
- [ ] `psql $DATABASE_URL -c '\d "File"'` shows `embedding | vector(1536)`.
- [ ] `psql $DATABASE_URL -c "\di file_embedding_hnsw"` shows the HNSW index.
- [ ] FK constraints exist (`select count(*) from pg_constraint where contype='f'` → 44), incl. PurchaseOrder→Supplier/Part (Restrict), PurchaseOrder→Agent (SetNull), TelemetryPoint→Robot (Cascade), WorkOrderField→Technician (SetNull), and the per-tenant `*_orgId_fkey` (Cascade).
- [ ] Isolation: `dbForOrg(A).supplier.findMany()` returns 0 of B's rows (verify-fnd-11 integration proves this and self-cleans).
- [ ] **Embedding dimension recorded = 1536** (default; revisit in FILE.2 when the embedding model is chosen).

**House rules / notes**
- `dbForOrg(orgId)` is the only sanctioned request-path client; bare `prisma` is for migrations/seed/system tasks only.
- Unique-target ops (`findUnique`/`update`/`delete`/`upsert`) can't take `orgId` in a unique `where` — scope tenant mutations via `updateMany`/`deleteMany`, or `findFirst({ where: { id, orgId } })` ownership check first.
- The extension scopes the **top-level** model only; nested tenant creates must carry `orgId` or go through their own scoped call.
- `migrate dev` is interactive; in this headless env it was run via a pseudo-tty (`script -q /dev/null …`). The pgvector typed column + HNSW index live in a **separate** `enable_pgvector_ann` migration (never hand-edit an applied migration).
- Migration reset destroys local dev data only (no prod, seed is FND.12). RLS at the Postgres-role level is a noted future hardening; app-level `dbForOrg` scoping is the chosen mechanism.

### Embedding dimension
- `File.embedding` = `vector(1536)` (FND.11 default). Revisit in FILE.2.

---

## FND.12 — Cross-module narrative seed

**Automated**
- `pnpm db:seed` then `pnpm verify:fnd-12` — counts + the SERVO/NCR-118/ECO-318/BMW/DLV-3312/SN-2196/Osei/p-13/HX-2 chain + tenant-orgId integrity (15 checks).
- Re-run `pnpm db:seed` and `pnpm verify:fnd-12` — identical counts (idempotent; clear-then-seed scoped to the demo org).
- `pnpm typecheck` + root `tsc --noEmit -p tsconfig.json` clean.

**Manual (docker compose up first; export DATABASE_URL)**
- [ ] `pnpm --filter @axona/db db:seed` runs clean (fresh `prisma migrate reset` then seed also works).
- [ ] In psql: `NCR-118.linkedTo` contains 'lot 88421'; `ECO-318.affected` mentions BMW; `DLV-3312` stage=CUSTOMS with EAR99 in riskState; `Invoice` Kawasaki=OVERDUE, BMW net-60.
- [ ] Counts: Module=22, Project=14, Machine=21 (8 FIXED), Agent=90 (~6 × 15 agent-bearing modules).
- [ ] No tenant row has an orgId outside the demo/second org (`select distinct "orgId" from "Supplier"`).
- [ ] Second org has only its own minimal rows (1 supplier).

**Notes / decisions**
- **Module count = 22, not 24.** The build-spec §1 module list (source of truth) and the PRD's own sidebar enumeration are both 22; the PRD's "24" counts the Workflow-detail + Project-files *screens*. `verify-fnd-12` asserts 22. If 24 nav modules are actually wanted, name the extra 2 and I'll add them.
- Seeded via `dbForOrg(DEMO_ORG_ID)` (orgId injected; ISO.1 dogfooded). Org/Module/Users-bootstrap use bare `prisma`. Clear-then-seed is strictly scoped to the demo orgId (never a bare `deleteMany`); the `Org` row is kept (no reliance on cascade).
- Relative dates throughout (SLA/AR aging stay live): WO-5521 SLA +6h, Kawasaki invoice −9d, DLV-3312 committed +21d, Osei cert +12d.
- BMW / Kawasaki are in-app sample data (allowed §3.7); anonymize only on export (screen-export gate) — not here.
- `File.embedding` left NULL (vectors are FILE.2). Seed files are run by tsx (not in the tsc `include`); they executed twice cleanly. The illustrative agent-run traces / workflows are minimal (full WF.* / AUDIT.3 later).

---

## FND.13 — App shell

**Automated**
- `pnpm verify:fnd-13` — shell route group + 5 components + nav helper + ui store + session stub + token hygiene (19 checks).
- `pnpm typecheck` + lint clean; `next build` compiles.
- Accessibility: accesslint `scan` against http://localhost:3001 → **0 violations / 94 rules** (after contrast fixes).

**Manual (`pnpm --filter @axona/web dev`, open http://localhost:3001)**
- [ ] Sidebar shows wordmark, a ⌘K search entry, and 4 groups (Core/Value chain/Robotics/Back office) with the 22 modules. (SSR-verified: 22 module links rendered.)
- [ ] Collapsing a nav group and reloading keeps it collapsed (Zustand persist).
- [ ] Active route's nav item shows the lime left-bar + ink-strong; nothing else reads "all lime."
- [ ] Drag the agent pane (280–520px clamp); collapse to the 52px rail; reload keeps width/collapsed.
- [ ] TraceConsole renders as a dark monospace block (scan→correlate→draft→policy-check→result) and collapses.
- [ ] ⌘K (and "/") focuses the search entry; Esc blurs; visible focus rings; tab order sane.
- [ ] Module routes (/core, /procurement, …) 404 until their screen stories — expected; only `/` (shell + landing) exists now.

**Notes / decisions**
- Route group `(shell)` → `/` resolves to the shell + a "pick a module" landing (`// TODO MC.1`). The FND.2 `app/page.tsx` placeholder was removed to avoid the `/` route conflict.
- `getNavModules()` reads the 22 `Module` rows (global, bare prisma); nav stays in sync with the seed (not hardcoded). Empty/loading/error states: `loading.tsx` skeleton, `error.tsx` boundary, Sidebar empty state ("run the seed").
- `getCurrentUser()` is a stub → `TODO AUTH.1` (returns seeded ADMIN); nav is read-all (action RBAC later).
- AgentPane/TraceConsole are placeholders; chat + SSE are GA.1 / ART.4 / ART.5 (`// TODO` left at the attach points).
- `AgentGlyph` (static 12-dot ring) added at `components/agents/` for the shell; FND.15 may extend it.
- **Accessibility fix:** `text-ink-faint` (#8a8a93 ≈ 3.1–3.4:1) failed AA for body/label text on light surfaces; bumped those to `text-ink-muted` (#55555f ≈ 7:1). `ink-faint` retained only where decorative.
- **Reduced-motion:** the shell uses no animated transitions (collapse is instant), so it's reduced-motion-safe by construction.

**Design critique (manual — no `design-critique` skill in this env; reviewed against design.md):** PASS — Archivo UI + JetBrains Mono labels/trace; single lime signal (active nav bar, wordmark mark, primary button, focus rings) — not "all lime"; paper/panel/panel-2 surface steps + hairline borders, zero `box-shadow`; functional green only via AgentGlyph "live"; no invented reds; no emoji.

---

## MC.1 — Mission Control (launcher)

**Automated**
- `pnpm verify:mc-1` — page/components, moduleMeta, dbForOrg alerts, ink chips, search→/search; + data checks (alerts present where the narrative implies; every meta key is a seeded module). 9 checks.
- `pnpm typecheck` + lint clean.
- Accessibility: accesslint `scan` http://localhost:3001 → **0 violations / 94 rules**.

**Manual (docker up + `pnpm --filter @axona/web dev`, http://localhost:3001)**
- [ ] `/` shows the launcher inside the shell: 4 bands (Core/Value chain/Robotics/Back office), 21 tiles (Mission Control excluded — no self-link), each name + one-line description + glyph.
- [ ] Alert chips (ink, not red) on the modules with seeded exceptions; absent on the rest.
- [ ] Click a tile → `/<key>` (unbuilt module routes 404 until their stories — expected).
- [ ] Type + submit the search field → `/search?q=…`; ⌘K focuses the sidebar search entry.
- [ ] No emoji; hairlines (no shadows); single lime signal; Archivo names + JetBrains Mono glyphs/labels.

**Computed alert counts (seeded demo org, via dbForOrg):**
`procurement 1 · quality 1 · fulfillment 1 · fleet 1 · field-service 1 · autonomy 1 · finance 1 · legal 1 · engineering 1 · security 2` — each traces to a seeded exception (PO awaiting approval, NCR-118, DLV-3312 EAR99, SN-2196 WATCH, WO-5521 SLA, INC-201, Kawasaki overdue, BMW SLA at-risk, ECO-318 in review, 2 open CVEs).

**Notes / decisions**
- **21 tiles, not 22.** Mission Control (`/`) is the launcher itself, so it's not rendered as a tile (Cursor rule: no self-link). The PRD's "22 tiles" loosely counts all modules; the 21 exclude the current page. Search renders as a tile (→`/search`) in addition to the search field.
- Alert predicates were tuned to the FND.12 seed strings (NCR `status:"OPEN"` not CLOSED; Robot `WATCH`; Delivery `riskState notIn ["","on-track"]` so only DLV-3312 counts; Invoice `OVERDUE`; ECO `REVIEW`; etc.). Counts come from `dbForOrg(currentUser.orgId)` — never hardcoded.
- `⌘K` focuses the sidebar search entry (global, FND.13); the launcher's own field is an in-page form submitting to `/search?q=`. Both reach the palette (SRCH.3).
- Empty/loading/error: Launcher empty state ("run the seed"); the `(shell)/loading.tsx` skeleton + `(shell)/error.tsx` boundary cover the page fetch.

---

## SRCH.1 — Unified search index (Postgres FTS + pgvector-ready)

**Automated**
- `pnpm verify:srch-1` — SearchDoc model + SearchType enum; FTS migration (tsvector + GIN + vector(1536)); parameterized search (websearch_to_tsquery + Prisma.sql, no $queryRawUnsafe); seed calls reindex; + data checks (modules global ×22, agents ≥60, FTS hits, isolation, globals shared, semantic deferred).
- `pnpm typecheck` + lint clean.

**Manual (docker up, after `pnpm db:seed`)**
- [ ] psql `\d "SearchDoc"` shows `tsv` (tsvector, generated) + `embedding` (vector(1536)); indexes `searchdoc_tsv_gin` + `searchdoc_embedding_hnsw`.
- [ ] `SELECT type, count(*) FROM "SearchDoc" GROUP BY type;` → MODULE 22 (orgId NULL), AGENT 90, PROJECT 14, FILE 18 (WORKFLOW/CHAT 0 until seeded).
- [ ] `search(demoOrgId, "genealogy")` → ranked agent/file/project hits; "sourcing" → sourcing agent; "quality" → Quality module + agents; "osaka"/"torque" → the narrative projects.
- [ ] `search(secondOrgId, "sourcing")` → 0 hits carrying the demo orgId; `search(secondOrgId, "quality")` still returns the global Quality module.
- [ ] `semanticSearch()` returns `[]` (FILE.2 deferred), no error.

**Notes / decisions**
- `tsv` (generated tsvector) + GIN + `vector(1536)` + HNSW are created in a **separate raw-SQL migration** `add_searchdoc_fts` (FND.11 pattern — never hand-edit an applied migration). A later migration must not drop them.
- `search()` always scopes `("orgId" = $org OR "orgId" IS NULL)`; Modules are the only global docs (one row each, not per-tenant). User input is parameterized via `websearch_to_tsquery('english', ${term})`; the optional scope clause is composed with `Prisma.sql`/`Prisma.empty`.
- `reindex()` is idempotent (upsert by `type+refId`) and prunes orphans on a full reindex; the seed calls it at the end. Files resolve their org via their project.
- Indexed set is the build-spec §4.2 list (Modules/Agents/Workflows/Projects/Files/Chats). Value-chain/robotics entities (NCR, Robot, Deal…) are a documented phase-2 extension. This is FTS-over-objects — distinct from operational memory (MEM.1).
- `SearchHit` includes `orgId` (beyond the PRD) so callers/tests can assert scoping directly.

---

## SRCH.2 — /api/search endpoint

**Automated**
- `pnpm verify:srch-2` — route handler (GET) reads q/scope/limit, resolves org via getCurrentUser, calls search + countByType; countByType exported/parameterized/org-scoped; + data checks (ranked hits, counts.ALL = per-type sum ≥ hits, empty-query no-op, isolation).
- `pnpm typecheck` + lint clean.

**Manual (docker up + `pnpm --filter @axona/web dev`)**
- [ ] `curl 'http://localhost:3001/api/search?q=sourcing'` → JSON `{ query, scope:"ALL", hits:[…ranked], byType, counts }`; counts.ALL ≥ hits.length.
- [ ] `curl 'http://localhost:3001/api/search?q=quality&scope=MODULE'` → hits only of type MODULE; counts still per-type across ALL types (scope ignored for counts).
- [ ] `curl 'http://localhost:3001/api/search?q='` → `{ hits:[], byType:{}, counts:{ALL:0} }`, no DB hit.
- [ ] Invalid scope (e.g. `&scope=BOGUS`) falls back to ALL; `limit` clamps to [1,50] (default 20).

**Notes**
- `counts` are per-type totals **ignoring scope + limit** (for SRCH.3 scope tabs: All (n) / Agents (n) / …); `hits`/`byType` honor scope + limit.
- Org from `getCurrentUser()` (FND.13 stub → demo ADMIN). No auth gate yet (RBAC.2). Org-scoped: never another tenant's docs.
- No schema change; reuses SRCH.1 `search()`; adds only `countByType`.

---

## DS.1 — Imported design system (tokens + primitives + re-skin)

**Automated**
- `pnpm verify:ds-1` — design.md == imported token set; tokens.css has DS values; fonts self-hosted; Tailwind maps new tokens; primitives exist; shell + launcher consume DS.1 primitives; no raw hex / no emoji in app components (18 checks).
- `pnpm verify:fnd-2` updated to the DS.1 token set; `pnpm verify:all` green; `pnpm typecheck` + lint clean.
- Accessibility: accesslint `scan` on `/` (dark launchpad) and `/quality` (re-skinned shell) → **0 violations** each.

**Manual (docker up + `pnpm --filter @axona/web dev`, http://localhost:3001) — compare against design/prototypes/**
- [ ] `/` is the **dark launchpad** (lime-glow + dot-grid on #101013), centered glassy ⌘K search, grouped sections (Core/Value chain/Robotics/Back office) with mono labels + hairline rules + counts, translucent tiles with lettermark glyph + name + lime count badge + desc, top-right agent-actions/clock/avatar. Matches `Mission Control.dc.html`. No sidebar.
- [ ] A module route (e.g. `/quality`) renders the **re-skinned light shell** (sidebar + agent pane) around a placeholder + "← Mission Control" link.
- [ ] Primitives (`apps/web/components/ui`): Button (primary/dark/ghost), Badge (accent/success/neutral), Pill (active/inactive), MonoChip, Card, AgentGlyph (12-dot ring) — all token-driven, no raw hex.
- [ ] Single lime signal; functional green; no invented reds; hairlines on product surfaces (no shadows); Archivo + JetBrains Mono; no emoji.

**Notes / decisions (flagged)**
- **Token set superseded:** DS.1 values replace the FND.2 starter (`ink` #1b1b1f→#111111, `ink-muted` #55555f→#6b6b63, `ink-faint` #8a8a93→#9a9a90, `panel-2` #eceae3→#f7f2eb, warmer lines, `accent-ink` #1b2a00→#0a0a0a, `success-tint`/`skeleton`); added mono-faint/ghost, on-dark, line-soft/dark, accent-hover, full type/spacing/radii/motion scales, dotgrid + dark-launchpad tokens. design.md + packages/config + Tailwind all reconciled.
- **Shadows:** imported tokens exist but are **marketing-only**; the Tailwind theme exposes no shadow utilities — product stays on hairlines (brand invariant honored, not overridden).
- **Mission Control re-architected to match the prototype:** moved from in-shell (FND.13/MC.1) to a **full-screen dark launchpad at `/`** (no sidebar); module screens live under the `(shell)` group. Added a `(shell)/[module]` placeholder so the shell is reachable + tiles resolve until each screen's story lands.
- **Fonts** stay self-hosted via next/font (not the prototype's Google CDN import).
- Line-icons in the prototype tiles are represented by mono lettermark glyphs for now (faithful to the DS mono aesthetic); swapping to the exact line-icon set is a follow-up polish.

---

## SRCH.3 — Command palette (⌘K)

**Automated**
- `pnpm verify:srch-3` — components (CommandPalette/ScopeTabs/Results), global root mount, ⌘K handler, useSearch (debounce/abort + /api/search), scope counts, a11y roles (dialog/combobox/listbox) + focus restore, /search deep-link, entries repointed, token hygiene.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] ⌘K opens the palette on `/` (launchpad) AND on a shell route (e.g. `/quality`); Esc closes + restores focus.
- [ ] Type "quality" → grouped hits (Module/Agents/Project/File); scope tabs show All 10 / Agents 7 / Modules 1 / … matching `/api/search?q=quality`.
- [ ] Click the Agents tab → filters to agents; ↑↓ moves the lime highlight; ↵ opens the hit (navigates) + closes; clicking a row does the same.
- [ ] Launcher search field + sidebar ⌘K both open THIS palette (no dead `/search` navigation).
- [ ] `/search?q=osaka` opens with the palette pre-filled/queried.
- [ ] Idle (no query) shows a hint; loading shows "Searching…"; no-results + error states render.
- [ ] Matches `design/prototypes/` (overlay scrim + paper panel, field, scope tabs, result rows, mono type lettermarks); no emoji; hairlines (no shadow); lime only as the active signal.
- [ ] accessibility-review: focus trap, combobox/listbox roles, AA contrast — 0 violations.

**Notes**
- Global mount in the root layout (works on the launchpad outside the shell + inside it). Open state in a dedicated `useCommandPalette` (Zustand). Data via `/api/search` (SRCH.2) only — debounced 150ms + AbortController; `counts` from the same response.
- DS.1 composite: the overlay uses a new `--scrim` token (rgba ink) + the DS paper/hairline surface; built on DS `Pill` (scope tabs) + DS input styling. No off-system styling.
- `/search` is a static route (precedence over `(shell)/[module]`) that renders the launchpad + opens the palette seeded from `?q=`.

---

## ART.1 — AgentRuntime

**Automated**
- `pnpm verify:art-1` — runtime files; offline loop (FakeModelClient, no API key): tool exec → SUCCEEDED with tool/tool-result/result trace lines, gated tool → proposal (AWAITING_APPROVAL, **no PurchaseOrder created**), turn cap → FAILED, `runAgent` persists an AgentRun with trace + model, and a cross-org load throws (tenant isolation).
- `pnpm typecheck` (workspace + root) clean.

**Manual (real model — needs ANTHROPIC_API_KEY + ANTHROPIC_MODEL set, docker up)**
- [ ] Node script: `runAgent(<a procurement agent id>, "is any part below reorder point?", {orgId, userId})` returns a sensible answer and an AgentRun row with a trace (scan/correlate/tool/result).
- [ ] Ask something that triggers the gated tool ("place a PO for 50 of SKU X") → run status awaits approval, NO PurchaseOrder row created.
- [ ] Confirm the trace records the model name used and timestamps.
- [ ] Two orgs: an agent in org A cannot read org B's rows via any tool (every tool uses `ctx.db = dbForOrg(orgId)`).

**Notes**
- Loop depends on a `ModelClient` (DI): real `AnthropicModelClient` (`@anthropic-ai/sdk`; model from `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`; key from `ANTHROPIC_API_KEY`) + `FakeModelClient` for offline tests. No hardcoded model string in the loop/entry point.
- Every tool: Zod-validated input, `ctx.db = dbForOrg(orgId)`, try/catch, typed trace lines (`scan·correlate·draft·policy-check·tool·tool-result·proposal·result·error`).
- Gated (money/safety/contract) tools PROPOSE and stop — never auto-execute. `canUseTool` is the RBAC.3 seam (permissive now). `AgentRun.status` is RUNNING|SUCCEEDED|FAILED; AWAITING_APPROVAL maps onto RUNNING for now (real proposal state + model/confidence/approver columns = RBAC.4/AUDIT.3).
- Example tools (ART.2 ships the full registry): `searchOperations`, `getPartStatus`, `listOpenNcrs` (read-only) + `draftPurchaseOrder` (gated stub).

---

## ART.2 — Typed tool registry

**Automated**
- `pnpm verify:art-2` — registry/module files; every tool zod-typed + categorized (read/draft/gated) with `gated:true ⇔ category gated`; draft tools never gated + the four gated tools are; `buildAgentDef` wires module tools + core reads for a procurement agent; a read tool returns seeded rows; a draft tool creates a DRAFTED PO; the gated `sendPurchaseOrder` is proposed-not-executed (no SENT PO); tenant isolation (org A row invisible to org B).
- `pnpm typecheck` (workspace + root) clean.

**Manual (real key — ANTHROPIC_API_KEY set, docker up)**
- [ ] `runAgent(<procurement agent>, "any parts below reorder point? draft POs for them")` → drafts DRAFTED POs, cites parts, does NOT send.
- [ ] `runAgent(<procurement agent>, "send PO <id> to the supplier")` → run awaits approval; no PO moves to SENT.
- [ ] `runAgent(<quality agent>, "is the SERVO-204 torque in spec?")` → runs the SPC check; can open an NCR (draft) but never releases/pays.
- [ ] Two orgs: a tool in org A never returns/touches org B rows.

**Notes**
- Three categories: **read** (query via ctx.db), **draft** (create not-yet-final records — PO DRAFTED, new NCR, draft ECO, proposed tech assignment — non-gated, runs autonomously), **gated** (irreversible money/safety/contract — `gated:true` → ART.1 proposes and stops; handler is the human-approved path for RBAC.4, never called by the loop).
- The line: drafting/opening is allowed; **placing/releasing/paying is gated** — `draftPurchaseOrder`→DRAFTED (draft) vs `sendPurchaseOrder` (gated); `openNcr` (draft); `releaseEco`/`recognizeRevenue`/`issueCreditNote` (gated).
- `buildAgentDef(agent)` = module tools + core reads; the core agent gets cross-module reads only. Every handler uses `ctx.db = dbForOrg(orgId)`; `listReorderCandidates` uses `$queryRaw` (onHand ≤ reorderPoint, orgId pinned in SQL); list tools capped at 50.
- Tool sets shipped: Procurement (wedge), Quality, Engineering, Field Service, Finance, Inventory + Core. Remaining modules' tools land with their screens (ART.3+).

---

## ART.4 — Agent chat SSE

**Automated**
- `pnpm verify:art-4` — route + client helper exist; TraceCollector sink (`onLine`); route streams `text/event-stream` with typed events + scoped lookups + 404; `onTrace` streams lines live (sink fires during the run); back-compat (no sink = ART.1); gated call streams a `proposal` kind with no SENT-PO side effect.
- `pnpm typecheck` (workspace + root) clean.

**Manual (real key — ANTHROPIC_API_KEY set, docker up, ./dev.sh)**
- [ ] `curl -N -X POST localhost:3001/api/agents/<id>/chat -H 'content-type: application/json' -d '{"message":"any parts below reorder point?"}'` → streams `event: trace` lines as they happen, then `event: message`, then `event: done`.
- [ ] Ask it to "send PO <id>" → an `event: proposal` appears; no PO becomes SENT.
- [ ] A `Chat` row + USER/AGENT `Message` rows are persisted; pass the returned `chatId` back to continue the thread.
- [ ] An agent id from another org → 404; a `chatId` from another org → 404.

**Notes**
- The trace **sink** (`TraceCollector(onLine)` + `runAgent({ onTrace })`) is the live seam ART.5 (trace console) and OBS.1 (Langfuse) plug into — emission is kept generic, no transport/console/Langfuse specifics in the runtime. No sink = byte-for-byte ART.1 behaviour.
- Stream event types: `trace` (each line) · `proposal` (gated action — UI shows "awaiting approval") · `message` (final text + status + runId) · `done` · `error`. Gated actions surface as `proposal` and never execute (ART.1/ART.2 gate).
- Org-scoped via `getCurrentUser → dbForOrg`; agent + chat lookups scoped, 404 on miss. `streamAgentChat()` (client helper) parses SSE frames into a typed async iterator; AGT.1 renders them (UI not built here).
- Client disconnect (`req.signal`) stops enqueuing; the run completes server-side and the AgentRun (with trace) is persisted. Token-by-token final-text streaming is a later refinement (needs a streaming ModelClient).

---

## AGT.1 — Agents screen

**Automated**
- `pnpm verify:agt-1` — route + components (AgentsView/AgentCard/AgentChat/ChatThread); chat uses `streamAgentChat`; status-dot maps AgentState (no red); proposals surfaced as "awaiting approval"; roster scoped via `dbForOrg` + grouped by module; trace rendered live (not buffered to done); no emoji/raw hex; scoped roster ≥ 60.
- `pnpm typecheck` (workspace + root) clean.

**Manual (real key — ANTHROPIC_API_KEY set, docker up, ./dev.sh, http://localhost:3001/agents)**
- [ ] All ~90 agents listed, grouped by module; each card shows the AgentGlyph + status dot + name/role/code + one-line description.
- [ ] "Needs attention" filters to CRITICAL-state agents; clearing restores all.
- [ ] Open a procurement agent, ask "any parts below reorder point? draft POs" → trace streams live in the console (scan → correlate → tool → result), the answer appears in the thread, POs drafted (DRAFTED).
- [ ] Ask "send PO <id>" → an "awaiting approval" affordance appears; no PO becomes SENT.
- [ ] Reopen the thread (chatId continuation) — messages persist.
- [ ] Matches design/prototypes/ (cards, chat, dark trace console); no emoji; hairlines; lime = signal only; AgentGlyph static (only the dot conveys state).
- [ ] accessibility-review: roles, focus, AA contrast — 0 violations.

**Notes**
- Roster (server, scoped) → `AgentsView` (client) two-pane: module-grouped cards left, live `AgentChat` right. Status dot: LIVE→success green · WORKING→lime · CRITICAL→ink (never red) · OFFLINE→muted; the glyph itself is static identity.
- Chat consumes `streamAgentChat` (ART.4): `trace`/`proposal` render live into the reused dark `TraceConsole` (proposals also as a distinct "awaiting approval" row), `message` into the `ChatThread`. Gated actions are surfaced only — approving is RBAC.4. Switching agents (keyed remount) / unmount aborts the in-flight stream.

---

## GA.1 — General Axona agent + global pane

**Automated**
- `pnpm verify:ga-1` — axona def + `readToolsAcrossModules`; pane wired (`useAgentChat` + `axonaAgentId`); shell resolves `getAxonaAgent`; ChatThread renders citation links; chat route attaches citations from tool sources; **no-emoji in both system prompts**; axona agent exists (core, idempotent), read-only, multi-module, tenant-scoped.
- `pnpm typecheck` (workspace + root) clean.

**Manual (real key — ANTHROPIC_API_KEY set, docker up, ./dev.sh)**
- [ ] On any shell screen, the right agent pane is the "Axona agent" (resize/collapse still work).
- [ ] Ask "what's blocking the BMW order?" → reasoning streams; the answer cites objects (e.g. DLV-3312 / ECO-318) as chips that link to the object's route; no emoji in the text.
- [ ] Ask "place the replacement PO" / "draft a PO" → it declines and routes you to the Procurement agent; no tool acts (its set has no draft/gated tools).
- [ ] Citations are real (link to existing routes), deduped, capped at 8; tools with no sources → no chips (never fabricated).
- [ ] Matches design/prototypes/ agent pane; no emoji; hairlines; lime = signal. accessibility-review 0 violations.

**Notes**
- General agent: `moduleKey "core"`, `code "axona-00"`, resolved via `getAxonaAgent(orgId)` (idempotent ensure; also seeded in FND.12). `buildAgentDef("core")` → `axonaSystemPrompt()` (cite-always + read-and-route + no-emoji) + `readToolsAcrossModules()` (every module's **read** tools; no draft/gated).
- Citations flow: read tools return `sources:{label,url}[]` (real object routes only) → the chat route gathers them from the run's `tool-result` lines → `Message.citations` + the `message` SSE event → DS chips (links) under the agent bubble.
- No-emoji brand fix folded in: `axonaSystemPrompt()` **and** `systemPromptFor()` (ART.2 module-agent prompt) now instruct "Do not use emoji in your responses." The global `AgentPane` reuses the shared `useAgentChat` hook (also used by AGT.1's per-agent chat); FND.13 resize/collapse unchanged.

---

## CMD.1 — Command Center rollups API

**Automated**
- `pnpm verify:cmd-1` — lib + route exist; `kpisByModule` covers core modules; KPIs derive from seeded rows (procurement open POs > 0); exceptions present + shaped (url, sourceLabel, ripples[], severity ink/lime/green); the **full seeded narrative surfaces** — NCR-118 (critical → engineering/procurement/fulfillment), DLV-3312 customs hold (→ legal/finance), SN-2196 thermal (→ field-service), Osei cert-expiring (people → field-service), HX-2 margin (finance), BMW SLA at-risk (legal → autonomy), agent-drafted PO awaiting approval (procurement), p-13 canary regression (→ fleet); no red severities; critical ranked first; org isolation.
- `pnpm typecheck` (workspace + root) clean.

**Manual (docker up, ./dev.sh)**
- [ ] `curl -s localhost:3001/api/core/summary | jq` → `{ company, kpisByModule, exceptions }`.
- [ ] Exceptions include the narrative items above, each with `ripples[]` + a `url` to the source module.
- [ ] Numbers match the seed (e.g. Procurement awaiting-approval = 1); change a seeded row → the number changes.
- [ ] A second org's summary contains only its own rows (isolation).

**Notes**
- `getCoreSummary(orgId)` (`apps/web/lib/core-summary.ts`) runs every query via `dbForOrg`, parallelised with `Promise.all`; no hardcoded numbers. SPC breach uses `$queryRaw` (value > ucl OR value < lcl, orgId pinned). Severity is `critical→ink · warn→lime · ok→green` only (no invented red). Exceptions are real rows + a curated `ripples[]` mapping, ranked critical-first and capped at 12. Predicates are tuned to the actual seeded status strings (NCR CRITICAL/OPEN, Delivery stage CUSTOMS + riskState, Robot WATCH, Technician certs.*.state EXPIRING, UnitEconomic trend `-…`, Obligation state AT_RISK, PO AWAITING_APPROVAL + draftedByAgentId, PolicyVersion state canary).

---

## CMD.2 — Command Center screen

**Automated**
- `pnpm verify:cmd-2` — /core route + components (CommandCenter/KpiStrip/KpiTile/ModuleKpiGrid/ExceptionFeed/ExceptionRow); renders `getCoreSummary`; exception rows link to source + ripple modules; severity dots ink/lime/green (no red); copilot entry reuses the GA.1 pane (no second chat); no emoji/raw hex.
- `pnpm typecheck` (workspace + root) clean.

**Manual (docker up, ./dev.sh, http://localhost:3001/core)**
- [ ] Renders inside the shell: company KPI strip + per-module KPI grid + the cross-module exception feed — all live from CMD.1 (no hardcoded numbers).
- [ ] The 8 narrative exceptions appear with a severity dot (ink/lime/green), title link, source chip, and ripple chips (NCR-118 → engineering/procurement/fulfillment, DLV-3312 → legal/finance, …).
- [ ] Click an exception title/source → its module; click a ripple chip → `/{module}` (404 until that screen exists — expected).
- [ ] Per-module KPI cards show CMD.1 values and link to each module.
- [ ] Click an "Ask the Axona agent…" suggestion → the right pane (GA.1) opens with the question seeded; Send → a cross-module answer over this data.
- [ ] Loading skeleton (route `loading.tsx`), empty ("All clear" / "run the seed"), and error states render.
- [ ] Matches design/prototypes/ (KPI tiles, feed rows, chips, hairlines); no emoji; lime = signal (severity ink/lime/green). accessibility-review 0 violations.

**Notes**
- `/core` is a static shell route (overrides `(shell)/[module]`, like `/agents`); server-fetches `getCoreSummary` (org-scoped) with try/catch → error state. The copilot is the existing GA.1 `AgentPane` reused — the on-screen entries set a transient `useCopilotSeed` and open the pane (which prefills its composer); no second chat surface is built. Severity → `critical:bg-ink-strong · warn:bg-accent · ok:bg-success`.

---

## PROC.1 — Procurement data/API

**Automated**
- `pnpm verify:proc-1` — lib + routes exist; `getProcurementQueue` returns POs with joined supplier name + part SKU and an agent-drafted flag; the agent-drafted **PO-9007** is present + flagged under `status=AWAITING_APPROVAL`; status filter narrows; reorder candidates query works (onHand ≤ reorderPoint); org isolation (org B's queue excludes org A's POs).
- `pnpm typecheck` (workspace + root) clean.

**Manual (docker up, ./dev.sh)**
- [ ] `curl -s 'localhost:3001/api/procurement/pos?status=AWAITING_APPROVAL' | jq '.pos'` → includes **PO-9007** with `supplier`, `partSku`, `agentDrafted: true`.
- [ ] `curl -s localhost:3001/api/procurement/pos | jq '.reorderCandidates'` → parts at/below reorder point (SERVO-205, SERVO-204).
- [ ] `curl -s localhost:3001/api/procurement/suppliers | jq '.items[0]'` and `.../parts` → paginated `{ items, nextCursor }`.

**Notes**
- Read-only over the existing models (no schema change, no mutations — the queue screen + approve action are PROC.2). All org-scoped via `getCurrentUser → dbForOrg`; lists paginated with the FND.11 `paginateArgs`/`pageResult` (cursor by id). `getProcurementQueue` resolves the scalar FKs via Prisma relations (`select supplier.name`, `part.sku`), flags `agentDrafted` from `draftedByAgentId`, and includes the reorder recommendation via `$queryRaw` (`onHand <= reorderPoint`, orgId pinned — the ART.2 `listReorderCandidates` logic).

---

## PROC.2 — Procurement screen

**Automated**
- `pnpm verify:proc-2` — route + components (ProcurementView/PoQueue/PoRow/ReorderBanner); approve action `requireRole(["OPS","ADMIN"])` FIRST + org-scoped + `revalidatePath`; AUDIT.3 seam; APPROVED→SENT is the human step; status pills no red (green/lime/neutral); no emoji/raw hex; queue has agent-drafted PO-9007 flagged; reorder candidates (SERVO-205/-204).
- `pnpm typecheck` (workspace + root) clean.

**Manual (./dev.sh, http://localhost:3001/procurement)**
- [ ] Matches Procurement.dc.html on the v2 shell — the **PO queue is the signature artifact** (code · item · vendor · value · status · action); no emoji; lime = signal.
- [ ] Reorder banner (accent) lists SERVO-205 0/20 · SERVO-204 6/20; "Draft PO" seeds the Axona pane.
- [ ] Filter chips (All/Drafted/Awaiting/Approved/Sent/Received + Agent-drafted) narrow the queue with live counts.
- [ ] As OPS/ADMIN, PO-9007 (AWAITING_APPROVAL, agent-drafted) shows **Approve** → AWAITING→APPROVED→SENT, one step per click; a trace line logs the transition attributed to the user. As VIEWER the button is hidden (and the action `requireRole`-throws — defense in depth).
- [ ] No autonomous send — only a human reaches SENT.
- [ ] accessibility-review 0 violations.

**Notes**
- Data from PROC.1 `getProcurementQueue` (org-scoped); agent-drafted flagged via `draftedByAgentId`. Approve = server action `advancePurchaseOrder` (`requireRole` line 1 → `dbForOrg` scoped `updateMany` → `revalidatePath`), transitions DRAFTED→AWAITING_APPROVAL→APPROVED→SENT; `/// TODO AUDIT.3` seam for the immutable event log; RBAC.4 formalizes the state machine. Status pills: green (dot+tint) approved/sent/received · lime awaiting · neutral drafted — no red (green text on tint would fail AA, so the dot carries the signal + ink text). The copilot is the global Axona pane (reused); "New order"/"Draft PO" seed it. The dark agent-trace block renders the latest real procurement `AgentRun` trace (org-scoped), hidden if none. `lib/rbac.ts` added (RBAC.2/3 seam).

---

## QUAL.1 — Quality data/API

**Automated**
- `pnpm verify:qual-1` — routes (spc/ncrs/certs); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); UCL/LCL compare via `$queryRaw`; getQualityData returns spcSeries grouped w/ breach flag (drive_torque_Nm breaches UCL), NCR-118 as CRITICAL (linkedTo lot 88421), certs w/ audit-ready/expiring flags, defectPareto descending; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/quality/ncrs?status=OPEN'` returns NCR-118 (CRITICAL, linkedTo "lot 88421; SERVO-204").
- [ ] `curl 'http://localhost:3001/api/quality/spc?characteristic=drive_torque_Nm'` returns the SERVO-204 torque series (last points 4.3/4.5 breach UCL 4.2).
- [ ] `curl http://localhost:3001/api/quality/certs` returns CE/UL/ISO with validTo.

**Notes**
- Read/API only over existing SpcSample/NCR/Cert (no schema change, no mutations — the SPC control-chart + NCR tracker screen is QUAL.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; UCL/LCL out-of-control compare uses `$queryRaw` with orgId pinned. Cert expiry window = 90 days (auditReady = VALID && !expiring).

---

## QUAL.2 — Quality screen

**Automated**
- `pnpm verify:qual-2` — route + components (QualityView/SpcChart/DefectPareto/CertList/NcrTable); renders getQualityData; SPC chart shows UCL/LCL/mean + a breach marker (ink, not red); read-only (no mutations); no red/emoji/raw hex; SPC series breaches, NCR-118 CRITICAL, certs + Pareto present.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/quality)**
- [ ] Matches Quality.dc.html on the v2 shell — the **SPC control chart leads** (signature artifact); UCL/mean/LCL reference lines; the SERVO-204 torque points at 4.3/4.5 breach UCL and render as INK (out of spec), within-control points ink-faint. No red.
- [ ] Defect Pareto (descending) + Certifications (CE/UL/ISO; UL flagged expiring, dot signal).
- [ ] NCR tracker: NCR-118 first (Critical, linked to "lot 88421; SERVO-204").
- [ ] The Quality agents (SPC / inspection / root-cause / NCR-CAPA / calibration / compliance) appear in the module-aware pane; "Open NCR" seeds the agent.
- [ ] accessibility-review 0 violations.

**Notes**
- Read-only over QUAL.1 getQualityData (org-scoped); no schema change, no mutations. SPC breach = INK (critical = ink, never red); severity + cert status carried by ink/lime/green dots with ink text (AA-safe — green text on paper fails contrast). The dark agent-trace block renders the latest real quality AgentRun (org-scoped), hidden if none.

---

## ENG.1 — Engineering data/API

**Automated**
- `pnpm verify:eng-1` — routes (ecos/firmware/compat); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getEngineeringData returns the stage-grouped ecoBoard (DRAFT/REVIEW/APPROVED/RELEASED) with ECO-318 in REVIEW referencing NCR-118, firmwareReleases (v4.2.2-rc awaiting HX-1 cert), compatMatrix with axes (hwRevs/fwVersions) + cells; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/engineering/ecos?stage=REVIEW'` returns ECO-318 (Supersede SERVO-204 → SERVO-205; affected: SERVO-204; NCR-118; BMW order; HX-2).
- [ ] `curl http://localhost:3001/api/engineering/firmware` returns v4.2.2-rc (RC) + v4.2.1 (RELEASED).
- [ ] `curl http://localhost:3001/api/engineering/compat` returns HX-1/HX-2 × v4.2.2-rc/v4.2.1 cells (cert / compatible / in-test).

**Notes**
- Read/API only over existing ECO/FirmwareRelease/CompatCell (no schema change, no mutations — the ECO board + compat matrix screen is ENG.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (ECOs 200, firmware 100, compat 400/list 100). Continues the seeded narrative NCR-118 → ECO-318. compatMatrix derives distinct hwRevs (sorted) + fwVersions (newest first) as the grid axes.

---

## ENG.2 — Engineering screen

**Automated**
- `pnpm verify:eng-2` — route + components (EngineeringView/EcoBoard/EcoCard/CompatMatrix/FirmwareReleases); renders getEngineeringData; ECO board 4 stages; compat matrix axes + cell states (no red); advanceEco requireRole(["ENGINEER","ADMIN"]) FIRST + org-scoped + revalidatePath + AUDIT.3 seam; RELEASE is the human step (APPROVED→RELEASED); no red/emoji/raw hex; ECO-318 in REVIEW column; matrix has axes+cells.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/engineering)**
- [ ] Matches Engineering.dc.html on the v2 shell — the **ECO stage board** (Draft→Review→Approved→Released) + the **HW↔firmware compat matrix** lead (signature artifacts). ECO-318 card in Review ("Supersede SERVO-204 → SERVO-205 (torque-comp)"; affected: SERVO-204; NCR-118; BMW order; HX-2).
- [ ] Compat matrix: HX-1/HX-2 × v4.2.2-rc/v4.2.1; cert = green, compatible = neutral, in-test = lime. No red.
- [ ] Firmware releases: v4.2.2-rc (RC — awaiting HX-1 cert before Fleet OTA), v4.2.1 (Released).
- [ ] As ENGINEER/ADMIN, an ECO card shows Submit/Approve/Release → advances a stage (RELEASE is the human step; attributed via trace line). As VIEWER the button is hidden (server action requireRole-throws — defense in depth).
- [ ] Engineering agents (change / compatibility / firmware-release / impact / requirements / CAD-config) appear in the module-aware pane; "New ECO" seeds the agent.
- [ ] accessibility-review 0 violations.

**Notes**
- Read paths org-scoped via QUAL/ENG-style getEngineeringData; the ECO board is stage-grouped (ENG.1). advanceEco = server action `requireRole(["ENGINEER","ADMIN"])` line 1 → `dbForOrg` scoped `updateMany` → `revalidatePath`, transitions DRAFT→REVIEW→APPROVED→RELEASED; `/// TODO AUDIT.3` seam; RBAC.4 formalizes the state machine. Compat/firmware/ECO status carried by ink/lime/green dots with ink text (AA-safe). Dark agent-trace from the latest real engineering AgentRun (org-scoped), hidden if none.

### ENG.2 — reconciled to Engineering.dc.html (table + design stats + enriched seed)
- Change orders is now a **TABLE** (ECO · Change · Type · Affected · Stage + role-gated advance), not a kanban board. Stats strip = Open ECOs · In review · Current HW rev · Released firmware (real data; "avg change cycle" needs ECO timestamps we don't model — In review fills that slot).
- Enriched seed (FND.12, idempotent): ECO-318 (HW, Review) + ECO-316 (FW, Review) + ECO-314 (HW, Approved); firmware v4.2.2-rc (RC) · v4.2.1 (Released) · v4.1.0 (Maint); compat matrix HX-2 r4/r3 · HX-1 r5/r4 × v4.0.2/v4.1.0/v4.2.1/v4.2.2; a real eng-orchestrator AgentRun so the AGENT TRACE block renders.

### Deferred decisions
- ECO `createdAt`/`updatedAt` → compute "avg change cycle" (Engineering stat). Schema change (ENG model has no timestamps); deferred.

---

## FUL.1 — Fulfillment data/API

**Automated**
- `pnpm verify:ful-1` — route (deliveries); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getFulfillmentData returns deliveries with stage/committed-vs-eta/risk, DLV-3312 in CUSTOMS (BMW · Osaka · EAR99 hold · atRisk), the 7-stage pipeline rollup (ALLOC→ACTIVE), the holds list; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/fulfillment/deliveries?stage=CUSTOMS'` returns DLV-3312 (BMW, Osaka JP, 24× HX-2, EAR99 customs hold).
- [ ] `curl http://localhost:3001/api/fulfillment/deliveries` returns DLV-3312 + DLV-3309 (Kawasaki, Freight, on-track).

**Notes**
- Read/API only over the existing Delivery model (no schema change, no mutations — the delivery-pipeline screen is FUL.2). All via getCurrentUser → dbForOrg; paginated with paginateArgs/pageResult; cap 200 (list 50). Continues the narrative ECO-318 → BMW order → DLV-3312 Osaka customs hold. `atRisk` = riskState not empty/"on-track"; `late` = etaDate after committedDate; pipeline = count per DeliveryStage (all 7).

---

## FUL.2 — Fulfillment screen

**Automated**
- `pnpm verify:ful-2` — route + components (FulfillmentView/DeliveryPipeline/DeliveryCard/ShipmentPanel/CommissioningPanel); renders getFulfillmentData; delivery pipeline signature artifact (7 stations, blocked/at-risk); read-only (no mutations); no red/emoji/raw hex; DLV-3312 at CUSTOMS (EAR99, at-risk); pipeline spans ≥5 stages; a commissioning delivery exists.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/fulfillment)**
- [ ] Matches Fulfillment.dc.html on the v2 shell — the **delivery pipeline** leads; each card shows the ALLOC→ACTIVE station track. **DLV-3312 (BMW · Osaka)** sits at **Customs, blocked (ink + cut-out square), ink progress fill, "At risk"** — the EAR99 hold. Others span ALLOC/CRATE/FREIGHT/ONSITE/COMMISSION/ACTIVE. No red.
- [ ] Shipment panel (DLV-3312, real fields; hold/late rows in ink) + Commissioning panel (an on-site/commission delivery, real stage progress).
- [ ] The Fulfillment agents appear in the module-aware pane; "Schedule delivery" seeds the agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only over FUL.1 getFulfillmentData (org-scoped). Enriched seed (FND.12, idempotent): 7 deliveries spanning ALLOC→ACTIVE (keeps DLV-3312 CUSTOMS/EAR99 + DLV-3309 FREIGHT) + a real ful-orchestrator AgentRun for the trace.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. Stats "Installs this week" / "Avg lead time" need a dispatch/order date the Delivery model doesn't carry → showed real **On-site** (count) + **At risk** (count) instead. Adding delivery timestamps = schema change (deferred).
  2. Shipment/Commissioning panels: the design's per-leg carrier detail + per-unit commissioning checklist aren't Delivery fields → panels render the **real** delivery fields (shipment k/v; stage-progress bar) instead of a fabricated carrier route / checklist. A richer shipment/commissioning model is a future schema addition.
- "Schedule delivery" seeds the copilot (agent proposes); creating/scheduling a real delivery is a **gated write** (deferred — same propose→approve pattern as PROC.2/ENG.2).

### Deferred decisions (FUL.2)
- (a) Delivery dispatch/order dates → "installs this week" + "avg lead time" metrics. Schema change (Delivery has no order/dispatch timestamps); deferred.
- (b) Richer Shipment/Commissioning model (carrier legs, per-unit commissioning checklist) → the detail panels. Schema + story additions; deferred.
- (c) Schedule-delivery gated write (propose → approve, like PROC.2/ENG.2). Story addition; deferred (currently seeds the copilot).

---

## FLEET.1 — Fleet data/API

**Automated**
- `pnpm verify:fleet-1` — routes (robots/telemetry); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getFleetData returns robots (SN-2196 WATCH · HX-2 · BMW · Site-3 · alert), per-robot telemetry series (SN-2196 thermal, ordered), fleet rollup (avg uptime · byStatus · firmware), the predictive-alert list (incl. SN-2196); org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/fleet/robots?status=WATCH'` returns SN-2196 (HX-2, BMW, Site-3, uptime, firmware, lat/lng).
- [ ] `curl 'http://localhost:3001/api/fleet/telemetry?robotId=<SN-2196 id>'` returns the battery_temp_c climb.

**Notes**
- Read/API only over Robot/TelemetryPoint (no schema change, no mutations — the map/telemetry screen is FLEET.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (robots 200, telemetry 1000/list 100). Continues the narrative SN-2196 thermal → hands to Field Service. `alert` = status WATCH/FAULT; telemetry grouped by robot+metric (oldest→newest); rollup = avg uptime + counts by status + OTA firmware spread; predictive alerts carry the latest telemetry signal as `reason`.

---

## FLEET.2 — Fleet screen

**Automated**
- `pnpm verify:fleet-2` — route + components (FleetView/FleetHealth/DeploymentMap/FirmwarePanel/LiveUnits); renders getFleetData; deployment map projects lat/lng markers (signature artifact); live units render a telemetry sparkline; read-only (no mutations); no red/emoji/raw hex; SN-2196 on the map (WATCH) + predictive-alert list; fleet renders full (≥3 sites, ≥3 statuses).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/fleet)**
- [ ] Matches Fleet.dc.html on the v2 shell — fleet-health distribution, then the **deployment map** (site markers by lat/lng; **Site-3 · Osaka** reads lime for SN-2196's WATCH) + the OTA firmware panel, then live units (uptime bar + telemetry sparkline + status), then the trace. No red.
- [ ] SN-2196 surfaces flagged (WATCH) at Osaka + in the predictive path (hands to Field Service via the alert).
- [ ] Fleet agents appear in the module-aware pane; "Schedule rollout" seeds the OTA agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only over FLEET.1 getFleetData (org-scoped). Enriched seed (FND.12, idempotent): 9 robots across Site-1 Detroit / Site-2 Rotterdam / Site-3 Osaka spanning ACTIVE/WATCH/FAULT/OFFLINE + firmware v4.2.1/v4.2.0/v4.1.0/v4.0.2; per-unit telemetry for the sparklines (SN-2196 thermal climb); a real flt-orchestrator AgentRun for the trace.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. The live-units **"Battery"** column + health **"avg battery"** metric need a battery-charge field the Robot model doesn't carry → the unit bars + a metric show **uptime** instead. Adding battery telemetry as a first-class field = schema change (deferred).
  2. **City** ("Site-3 · Osaka") isn't a Robot field → a small display map (Site-1 Detroit / Site-2 Rotterdam / Site-3 Osaka) labels the three known sites; markers position from real lat/lng.
- "Schedule rollout" seeds the copilot (OTA agent proposes); a real rollout is a **gated write** (deferred — propose→approve like PROC.2/ENG.2).

### Deferred decisions (FLEET.2)
- (a) Robot battery-charge field → the live-units "Battery" column + health "avg battery" metric (currently uptime). Schema change (Robot has no charge field); deferred.
- (b) Schedule-rollout gated write (propose → approve, like PROC.2/ENG.2). Story addition; deferred (currently seeds the OTA agent).

---

## FIELD.1 — Field Service data/API

**Automated**
- `pnpm verify:field-1` — routes (work-orders/technicians); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getFieldServiceData returns work orders with a live SLA countdown (WO-5521 SN-2196 battery swap, Site-3), technicians with the cert matrix (M. Osei HV/battery expiring → certExpiring), the per-tech dispatch board (Osei's column carries WO-5521), the SLA rollup (open/dueSoon/breached); org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/field/work-orders?status=DISPATCH'` returns WO-5521 (SN-2196 battery swap, Site-3, slaDueAt, severity MAJOR) with slaMsLeft/slaBreached/dueSoon.
- [ ] `curl http://localhost:3001/api/field/technicians` returns M. Osei (Site-3, HV/battery cert EXPIRING) + R. Caldwell (VALID).

**Notes**
- Read/API only over WorkOrderField/Technician (no schema change, no mutations — the dispatch board is FIELD.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (200 / list 50). Closes the robotics thread SN-2196 thermal (Fleet) → WO-5521 battery-swap dispatch gated by Osei's HV/battery cert. SLA: `slaMsLeft` = time to slaDueAt (negative = breached), `dueSoon` within 12h; cert `expiring` = state EXPIRING or within 30d; the board is per-tech (assigned work orders).

---

## FIELD.2 — Field Service screen

**Automated**
- `pnpm verify:field-2` — route + components (FieldServiceView/DispatchBoard/WorkOrderQueue); renders getFieldServiceData; per-tech dispatch board + cert gate (signature artifact); work-order queue with a live SLA countdown; read-only (no mutations); no red/emoji/raw hex; WO-5521 on Osei's column (SLA + cert-expiring); board + queue full (≥5 techs, ≥5 WOs); queue spans statuses incl. an unassigned WO.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/field-service)**
- [ ] Matches Field Service.dc.html on the v2 shell — the **dispatch board** (per-tech lanes; **M. Osei carries a lime "cert" flag** = the expiring HV/battery gate) + the **SLA-tracked work-order queue** (WO-5521 SN-2196 battery swap on Osei, live countdown). No red.
- [ ] WO-5521 + Osei surface (SLA ticking, cert gate); an unassigned WO shows "Unassigned"; a breached SLA reads in ink.
- [ ] Field Service agents appear in the module-aware pane; "Work order" seeds the dispatch agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only over FIELD.1 getFieldServiceData (org-scoped). Enriched seed (FND.12, idempotent): 6 technicians (Osei + Sato cert-expiring) + a 7-WO queue across DISPATCH/EN_ROUTE/ON_SITE/OPEN/SCHEDULED/CLOSED, severities, and SLA windows (dueSoon/breached/scheduled), some unassigned; a real fs-orchestrator AgentRun for the trace.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. Stats "Mean time to repair" / "First-time fix" need opened/closed timestamps + repair outcomes the WorkOrderField model doesn't carry → real **SLA at risk** + **Techs** counts fill those slots. Adding WO timestamps/outcomes = schema change (deferred).
  2. The dispatch board's precise clock-positioned time-blocks need a scheduled start/end per WO (not modeled) → blocks are the tech's **queue ordered by SLA urgency**, colored by real status; the hour-grid is the design aesthetic.
- "+ Work order" seeds the dispatch agent (proposes); creating/assigning a real WO is a **gated write** (deferred — propose→approve like PROC.2/ENG.2).

### Deferred decisions (FIELD.2)
- (a) WorkOrderField opened/closed timestamps + repair outcomes → "mean time to repair" + "first-time fix" metrics (currently SLA-at-risk + tech counts). Schema change; deferred.
- (b) Scheduled start/end per WO → clock-positioned dispatch-board blocks (currently a queue ordered by SLA urgency). Schema change; deferred.
- (c) Create/assign work order gated write (propose → approve, like PROC.2/ENG.2). Story addition; deferred (currently seeds the dispatch agent).

---

## AUTO.1 — Autonomy data/API

**Automated**
- `pnpm verify:auto-1` — routes (metrics/incidents/policies); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getAutonomyData returns per-site autonomySeries (Site-3 shows the p-13 canary regression — autonomy dips + takeovers spike after p-13), open safetyIncidents (INC-201 near-miss, SN-2196, Site-3), policyVersions (p-13 canary + current/standby), the rollup; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/autonomy/metrics?site=Site-3'` returns the Site-3 series (autonomyRate 98.x→96.x, takeoversPer1k rising after p-13).
- [ ] `curl 'http://localhost:3001/api/autonomy/incidents?status=REVIEW'` returns INC-201 (near-miss, SN-2196, Site-3, MAJOR).
- [ ] `curl http://localhost:3001/api/autonomy/policies` returns p-13 (canary) + p-12 (current) + p-11 (standby).

**Notes**
- Read/API only over AutonomyMetric/SafetyIncident/PolicyVersion (no schema change, no mutations — the trend + policy screen is AUTO.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (metrics 500, incidents 200, policies 100 / lists 50–100). Continues the Site-3 thread: the p-13 canary regression → INC-201. `regression` = autonomy declined or takeovers rose across the window; rollup = avg autonomy rate + takeovers/1k (latest per site) + open-incident count + the canary policy version. Policy rollback/promotion is a gated action (RBAC.4) — surfaced here read-only.

---

## AUTO.2 — Autonomy screen

**Automated**
- `pnpm verify:auto-2` — route + components (AutonomyView/AutonomyTrend/PolicyPanel/SafetyIncidents); renders getAutonomyData; autonomy-rate trend highlights the p-13 cohort (signature); advancePolicy requireRole(["ENGINEER","ADMIN"]) FIRST + org-scoped + revalidatePath + AUDIT.3 seam; promote/rollback role-gated in the UI; no red/emoji/raw hex; Site-3 regression series + p-13 canary + INC-201; renders full (≥2 series, ≥3 incidents).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/autonomy)**
- [ ] Matches Autonomy.dc.html on the v2 shell — the **autonomy-rate trend** (bars; the **p-13 cohort dips in lime** on Site-3) + the **policy panel** (p-13 Canary with a role-gated **Promote / Rollback**) + the safety-incident log (INC-201 near-miss). No red.
- [ ] As ENGINEER/ADMIN, Promote (canary→current) or Rollback (canary→standby) transitions p-13; attributed via a trace line. As VIEWER the buttons are hidden (server action requireRole-throws).
- [ ] Autonomy agents appear in the module-aware pane; "Safety review" seeds the agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over AUTO.1 getAutonomyData (org-scoped); advancePolicy = server action `requireRole(["ENGINEER","ADMIN"])` line 1 → `dbForOrg` scoped `updateMany` → `revalidatePath`; `/// TODO AUDIT.3` seam; RBAC.4 formalizes the promotion/rollback state machine. **Sim-validate-before-promote is a future gate (deferred).** Enriched seed (FND.12, idempotent): 3 site series (Site-1/Site-2 stable, Site-3 p-13 regression) + 4 safety incidents (keep INC-201) + a real auto-orchestrator AgentRun.
- **Design deviations flagged (data-shape mismatch — not substituted silently):** stats "Tasks today" / "Safety events · 24h" need a task count + a time window the model doesn't carry → real **Sites monitored** + **Open incidents** counts fill those slots. Adding task counters / incident timestamps = schema change (deferred).

### Deferred decisions (AUTO.2)
- (a) Task counter + incident time-window → "tasks today" + "safety events · 24h" metrics (currently sites-monitored + open-incident counts). Schema change; deferred.
- (b) Sim-validate-before-promote gate on policy promotion (RBAC.4 formalizes the promotion/rollback state machine). Story addition; deferred (promote/rollback currently transitions state directly, role-gated, with the AUDIT.3 seam).

---

## FIN.1 — Finance data/API

**Automated**
- `pnpm verify:fin-1` — routes (ledger/invoices/unit-economics); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getFinanceData returns the revenue split (lumpy hardware vs ratable RaaS), unit economics (HX-2 margin −2.1pt from ECO-318, parsed marginDeltaPt), invoices with a derived AR-aging bucket (BMW net-60 current + Kawasaki overdue), the rollup (recognized revenue, AR total + overdue, netIncome; cash/runway flagged null); org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/finance/ledger?period=2026-Q2'` returns the Q2 ledger (Hardware/RaaS revenue, COGS, Opex).
- [ ] `curl 'http://localhost:3001/api/finance/invoices?status=OVERDUE'` returns Kawasaki INV-7702 (overdue, agingBucket 1-30).
- [ ] `curl http://localhost:3001/api/finance/unit-economics` returns HX-2 (marginPct 22.9, marginDeltaPt −2.1) + HX-1.

**Notes / flags**
- Read/API only over LedgerEntry/Invoice/UnitEconomic (no schema change, no mutations — the P&L / unit-economics / AR screen is FIN.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; aggregates computed in JS over org-scoped findMany (small data; keeps the dbForOrg org-scope guarantee — no raw SQL that could bypass it); caps (ledger/invoices 500, UE 200 / lists 50–100). Continues the BMW thread: HX-2 −2.1pt from ECO-318 · BMW net-60 (current) + Kawasaki (overdue). `recognition` = lumpy (hardware, recognized at commissioning) vs ratable (RaaS); AR `agingBucket` = current / 1-30 / 31-60 / 61-90 / 90+ / paid from days-past-`dueDate`.
- **Flag: cash / runway are not derivable from the ledger** (no cash-balance or burn entries) → `rollup.cash` / `rollup.runwayMonths` return `null`; `netIncome` (revenue − COGS − Opex) is the derivable rollup. A cash/burn model = schema addition (deferred to FIN.2 notes).

### Deferred decisions (FIN.1)
- Cash-balance / burn model → "cash" + "runway" metrics (currently rollup.cash / rollup.runwayMonths return null; netIncome is the derivable rollup). Schema addition; deferred.

---

## FIN.2 — Finance screen

**Automated**
- `pnpm verify:fin-2` — route + components (FinanceView/RevenueChart/WorkingCapital/UnitEconomics/Receivables); renders getFinanceData; two-revenue-engine chart (hardware + RaaS, signature); per-unit economics + AR-aging tables; read-only (no mutations); no red/emoji/raw hex; HX-2 −2.1pt + BMW net-60 + Kawasaki overdue; chart full (≥6 periods, both engines); tables full (≥3 products, ≥3 invoices).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/finance)**
- [ ] Matches Finance.dc.html on the v2 shell — the **two-engine recognized-revenue chart** (hardware ink / RaaS lime, stacked per month), **per-unit economics** (HX-2 margin bar + ▼ −2.1pt · ECO-318), **AR-aging receivables** (BMW net-60 "Current", Kawasaki "62d overdue" ink). No red.
- [ ] HX-2 −2.1pt shows in the topbar pill + the unit-economics trend; BMW + Kawasaki surface in AR.
- [ ] Finance agents appear in the module-aware pane; "Run month-end close" seeds the fin agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over FIN.1 getFinanceData (org-scoped) — extended with `revenueByPeriod` (hardware+RaaS per period) for the chart. Enriched seed (FND.12, idempotent): 8-month P&L ledger + 4 products (HX-2 −2.1pt kept) + 4 AR invoices (BMW/Kawasaki kept, +Maersk due-soon, +Tesla current) + a real fin-orchestrator AgentRun.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. The design's **Cash & runway** panel + Cash/Runway stats need a treasury/burn feed the ledger doesn't carry (`rollup.cash`/`runwayMonths` = null) → the right card is replaced with the derivable **Working capital** view (AR open, overdue, net income); stats show **ARR (RaaS×12)** + **Net income** instead of Cash/Runway. A cash/burn model = schema addition (deferred, per FIN.1).
  2. **"Run month-end close"** seeds the fin agent (proposes); the real close (revenue recognition + period lock) is a **gated write** needing a period-close model (no `status` field on a period to transition without a schema change) — deferred. Kept read-only per the "no new columns" guardrail.

### Deferred decisions (FIN.2)
- (a) Treasury / cash-burn model → the design's "Cash & runway" panel + Cash/Runway stats (currently the derivable Working-capital view + ARR/Net-income stats). Schema addition; deferred.
- (b) Period-close model → month-end-close gated write (recognize revenue + period lock). Currently "Run month-end close" seeds the fin agent (proposes). Schema addition; deferred.

---

## LEGAL.1 — Legal data/API

**Automated**
- `pnpm verify:legal-1` — routes (obligations/export-licenses/matters); lib org-scoped (dbForOrg) + paginated (FND.11); read-only (no mutations); getLegalData returns obligations (BMW 99.5% fleet SLA AT_RISK from the autonomy regression), export licenses (DLV-3312 EAR99 HOLD), legal matters (ECO-318 IP → engineering, INC-201 liability → autonomy) with source-module links, the rollup; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/legal/obligations?state=AT_RISK'` returns BMW 99.5% fleet SLA (actual 99.3%, autonomy regression).
- [ ] `curl http://localhost:3001/api/legal/export-licenses` returns EAR99-DLV-3312 (Osaka JP, HOLD).
- [ ] `curl 'http://localhost:3001/api/legal/matters?status=OPEN'` returns INC-201 liability (→ autonomy).

**Notes**
- Read/API only over Obligation/ExportLicense/LegalMatter (no schema change, no mutations — the screen is LEGAL.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (200 / lists 50). Closes the BMW thread: 99.5% SLA at-risk (autonomy regression) · DLV-3312 EAR99 export hold · ECO-318 patent (IP) + INC-201 (liability) matters. `atRisk` = state contains RISK · `onHold` = state HOLD · `open` = status not closed/resolved/cleared. Matter `module` inferred from the linkedTo prefix (ECO→engineering · INC→autonomy · NCR→quality · DLV→fulfillment · PO→procurement · WO→field-service · CVE→security) — the cross-module link back to the source artifact.

---

## LEGAL.2 — Legal screen

**Automated**
- `pnpm verify:legal-2` — route + components (LegalView/ObligationsPanel/ExportControl/MattersTable); renders getLegalData; obligations panel (state vs live ops); matters table (source-module links); read-only (no mutations); no red/emoji/raw hex; BMW SLA at-risk + DLV-3312 EAR99 hold; ECO-318→engineering + INC-201→autonomy; renders full (≥3 obligations, ≥3 licenses, ≥4 matters).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/legal)**
- [ ] Matches Legal.dc.html on the v2 shell — **contract obligations** (BMW 99.5% SLA "At risk" ink · Maersk/Tesla "Met" · Kawasaki "Review") + **export control** (DLV-3312 EAR99 "Hold" ink dot · others "Clear"/"Pending") + **matters & compliance** table (INC-201→Autonomy, ECO-318→Engineering, EU Reg→Quality, etc.). No red.
- [ ] BMW SLA at-risk + DLV-3312 EAR99 hold surface; matters link back to their source module.
- [ ] Legal agents appear in the module-aware pane; "New matter" seeds the legal agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over LEGAL.1 getLegalData (org-scoped). Enriched seed (FND.12, idempotent): 4 obligations (BMW at-risk kept) + 4 export licenses (DLV-3312 EAR99 hold kept) + 5 matters (ECO-318/INC-201 kept, +REG/CONTRACT/EXPORT) + a real legal-orchestrator AgentRun.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. Stat **"Active contracts"** needs a Contract model the schema doesn't carry → **Obligations tracked** fills that slot. Adding a contracts model = schema addition (deferred).
  2. **"New matter"** seeds the legal agent (proposes); creating a LegalMatter is a **gated write** (propose→approve, would gate ADMIN/OPS — there is no LEGAL role in the enum) — deferred, kept read-only per the "no new columns / AI-proposes" guardrails.

### Deferred decisions (LEGAL.2)
- (a) Contract model → "Active contracts" metric (currently "Obligations tracked"). Schema addition; deferred.
- (b) Legal gated writes (clear export hold: ExportLicense.state HOLD→CLEARED · new matter: create LegalMatter) → gate FINANCE/ADMIN per RBAC §8 + `/// TODO AUDIT.3` seam (no LEGAL role in the enum). Currently "New matter" seeds the legal agent (proposes). Story addition; deferred.

---

## MFG.1 — Manufacturing data/API

**Automated**
- `pnpm verify:mfg-1` — routes (work-orders/genealogy); lib org-scoped (dbForOrg) + paginated (FND.11); moat ONT.2 pointer + as-built/never-reconstructed; read-only (no mutations); getManufacturingData returns lineFlow grouped by station in build order (each with count + inProgress + workOrders), throughput (built/in-progress/on-hold; OEE flagged null), bottlenecks (stations by in-progress backlog); getGenealogy(serial) returns a per-serial ordered station trace; org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/manufacturing/work-orders?station=Test'` returns the Test-station WOs.
- [ ] `curl 'http://localhost:3001/api/manufacturing/genealogy?serial=HX2-0419'` returns that serial's ordered build trace.

**Notes / flags**
- **MOAT (load-bearing):** `WorkOrderMfg.serial` is the as-built genealogy anchor — capture stays **as-built, never reconstructed** (capture fidelity caps the moat). MFG.1 exposes the serial→work-order **station** trace only; the FULL **parts·serials·firmware** genealogy graph (SERVO-204/-205, lot 88421, firmware) is **ONT.2** — `/// pointer` left in the lib; ONT.2 extends this, it does not replace it.
- Read/API only over WorkOrderMfg (no schema change, no mutations — the line-flow + genealogy screen is MFG.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (WO 1000, genealogy 200 / list 100).
- **Flags (data-shape mismatch — not fabricated):**
  1. **OEE is not derivable** from the model (no cycle-time / availability / quality-yield feed) → `throughput.oeePct` returns `null`. A real OEE feed = telemetry/schema addition (deferred to MFG.2 notes).
  2. **Line-station build order** has no order column in the model → a canonical `STATION_ORDER` sequence (Frame Build → Drive Integration → Final Assembly → Test → Pack-out) ranks the stations; unknown stations sort last. A first-class station/routing model is a schema addition (deferred).
  3. **Per-serial genealogy is currently a single-station trace** — the seed has one WorkOrderMfg per serial (each unit at its current station). `getGenealogy` already returns *all* records for a serial ordered by build sequence, so a multi-station "full build history" populates as soon as MFG.2's seed enriches a unit moving Drive Integration → Final Assembly → Test (no lib change needed).

### Deferred decisions (MFG.1)
- (a) Cycle-time / availability / yield feed → OEE metric (currently throughput.oeePct returns null). Telemetry/schema addition; deferred.
- (b) Routing / station-order model → the line build sequence (currently a canonical STATION_ORDER in code). Schema addition; deferred.

---

## MFG.2 — Manufacturing screen

**Automated**
- `pnpm verify:mfg-2` — route + components (MfgView/LineFlowBoard/BuildGenealogy/ThroughputPanel); renders getManufacturingData + getGenealogy; line-flow station pipeline (signature); build-genealogy as-built trace + ONT.2 pointer; read-only (no mutations); no red/emoji/raw hex; line full (units across ≥4 stations, ≥10 in build); HX2-0221 clean SERVO-205 full multi-station as-built trace (all DONE); HX2-0208 lot-88421 defect trace ends HOLD at Test.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/manufacturing)**
- [ ] Matches Manufacturing.dc.html on the v2 shell — the **line-flow board** (6-station pipeline Frame → Drive → Actuators → Firmware → Test → Pack, units at each node) + **build genealogy** (HX2-0208 as-built station trace, HOLD at Test) + throughput/bottlenecks + the scheduler-agent flag. No red.
- [ ] `?serial=HX2-0221` shows the clean SERVO-205 unit's full pass; default shows the held defect unit.
- [ ] Manufacturing agents appear in the module-aware pane; "Work order" / "Apply" seed the mfg agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- **MOAT:** `serial` is the as-built genealogy anchor — the genealogy panel shows the as-built **station** trace (captured as-built, never reconstructed). Enriched seed (FND.12, idempotent): 15 units across the 6 stations + 2 multi-station traces — **HX2-0221** clean build on the **SERVO-205** drive (post-ECO-318, full pass) and **HX2-0208** carrying the **SERVO-204 / lot-88421** defect (→ HOLD at Test = the NCR-118 source) + a real mfg-orchestrator AgentRun.
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. Stats **on-time build / first-pass yield / units-day / takt** need an OEE / cycle-time feed the MES model lacks → real **In build / In progress / Built / On hold** counts fill the strip (OEE deferred, per MFG.1).
  2. The design's **3 production lines (Line 1/2/3)** have no per-line grouping in the model → the plant renders as **one station pipeline** with units at their current station. A first-class Line/routing model = schema addition (deferred).
  3. The **build-genealogy tree is part-level** (Chassis/Actuator/SERVO-204/Controller/Firmware) = **ONT.2**; MFG.2 shows the station-level as-built trace + a `/// → ONT.2` pointer. The parts·serials·firmware graph is not fabricated here.
  4. The **"In-line tests"** panel needs a test-results / quality feed (SPC lives in QUAL) → replaced with the derivable **Throughput & bottlenecks** panel (deferred).
  5. **"+ Work order" / "Apply"** (the scheduler re-sequence) seed the mfg agent (propose); the real re-sequence/create is a **gated write** needing a scheduling/routing model — deferred, kept read-only.

### Deferred decisions (MFG.2)
- (a) OEE / cycle-time feed → on-time-build / first-pass-yield / units-day / takt metrics (currently In-build/In-progress/Built/On-hold counts). Telemetry/schema addition; deferred.
- (b) Per-line model → multiple production lines (currently one plant station pipeline). Schema addition; deferred.
- (c) Test / quality feed → in-line tests (SPC lives in Quality) (currently the Throughput & bottlenecks panel). Schema addition; deferred.
- (d) Scheduling model → work-order create / re-sequence gated write (currently "Work order"/"Apply" seed the mfg agent). Schema addition; deferred.
- (e) Parts-tree genealogy (parts · serials · firmware) → ONT.2 (currently the station-level as-built trace + a /// pointer). Deferred to ONT.2.

---

## PPL.1 — People data/API

**Automated**
- `pnpm verify:ppl-1` — routes (technicians/requisitions); lib org-scoped (dbForOrg) + paginated (FND.11); cert-parsing shared with FIELD.1 via lib/certs; read-only (no mutations); getPeopleData returns the cert matrix (techs × certKeys, M. Osei's HV/battery EXPIRING = dispatch gate), the field-team roster, requisitions (filled/target/open), the rollup (certs expiring / headcount / field-team size); org isolation (unknown org → empty).
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl http://localhost:3001/api/people/technicians` returns the roster with parsed certs (M. Osei hvBattery EXPIRING).
- [ ] `curl http://localhost:3001/api/people/requisitions` returns headcount (Field Service Technician 8/12, Autonomy Engineer 3/5, Quality Inspector 4/4).

**Notes**
- Read/API only over Technician/Requisition (no schema change, no mutations — the cert-matrix screen is PPL.2). All via getCurrentUser → dbForOrg; lists paginated with paginateArgs/pageResult; caps (techs 500, reqs 200 / lists 50). **Closes the Osei thread:** the cert matrix that GATES field dispatch — M. Osei's HV/battery cert is EXPIRING (ties back to FIELD.2's dispatch gate). Cert-parsing extracted to **lib/certs.ts** and shared by FIELD.1 (field-service) + PPL.1 (people) — a cert is `expiring` when state EXPIRING or within the 30d window. `certKeys` = union of cert keys → the tech × cert grid columns; requisition `open` = target − filled.
- **Seed-richness note for PPL.2:** all 6 techs currently carry a single cert type (`hvBattery`), so the matrix is techs × 1 column. PPL.2 will enrich the seed (more cert types → a fuller grid) keeping Osei's expiring HV/battery.

---

## PPL.2 — People screen

**Automated**
- `pnpm verify:ppl-2` — route + components (PeopleView/CertMatrix/FieldTeamGrowth/HeadcountPanel); renders getPeopleData; cert matrix is a tech × cert grid (signature); read-only (no mutations); no red/emoji/raw hex; matrix full (≥4 cert types × ≥5 techs); Osei HV/battery expiring dispatch gate; state mix (valid/expiring/training/missing); requisitions/headcount (≥4 roles, target ≥ filled).
- `pnpm typecheck` clean · `verify-field-1` stays 8/8 (shared cert seed).

**Manual (./dev.sh, http://localhost:3001/people)**
- [ ] Matches People.dc.html on the v2 shell — the **certification matrix** (techs × HX-2 svc / HX-1 svc / HV·batt / Safety LOTO / Commission; green = certified, **ink = expiring < 30d**, lime = in-training, skeleton = not-held) with **M. Osei's HV/battery cell ink "12d"** (the dispatch gate) + field-team-growth + headcount. No invented reds.
- [ ] Osei's expiring cert is flagged; legend renders; "Open requisition" seeds the ppl agent.
- [ ] People agents appear in the module-aware pane.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over PPL.1 getPeopleData (org-scoped). Enriched seed (FND.12, idempotent): 6 techs × 5 cert types (hx2Service · hx1Service · hvBattery · safetyLoto · commissioning) with a VALID/EXPIRING/TRAINING/missing mix (Osei + Sato hvBattery EXPIRING kept) + 5 headcount requisitions + a real ppl-orchestrator AgentRun. FIELD.1/FIELD.2 stay green (shared lib/certs; certExpiring unchanged for the dispatch board).
- **Design deviations flagged (data-shape mismatch — not substituted silently):**
  1. Stat **"Headcount" (org-wide 142)** has no first-class people/org model → approximated by the **requisition fill** (sum of filled); **"Cert compliance"** is derived from the matrix (current held certs / all held).
  2. The design's **Headcount by function** implies an org-structure tree the model lacks → the panel derives headcount from the **requisition roles** (function ≈ role). A first-class org model = schema addition (deferred).
  3. **"Open requisition"** seeds the ppl agent (proposes); opening a req / booking a recert is a **gated write** needing a requisition-workflow model — deferred, kept read-only.

---

## SEC.1 — Security data/API

**Automated**
- `pnpm verify:sec-1` — routes (cves/posture); lib org-scoped (dbForOrg) + paginated (FND.11); composes over FLEET.1 + ENG.1 (reuses shared libs); moat RBAC.4 + AUDIT.3 seams (agent-drafted only); read-only (no mutations); getSecurityData rollup binds (severity/status/units/posture/rollouts); CVE-2026-3187 affects deployed units (PATCH_DRAFTED); signed-firmware patch v4.2.2-rc resolves through the ENG cert gate (in-test, forCve CVE-2026-3187); device posture spreads over the fleet; org isolation.
- `pnpm typecheck` clean · `verify-fleet-1` / `verify-eng-1` / `verify-ppl-1` stay green.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/security/cves?status=PATCH_DRAFTED'` returns CVE-2026-3187 (CRITICAL, 42 units) + CVE-2026-3298.
- [ ] `curl http://localhost:3001/api/security/posture` returns the device-posture spread (Hardened/Needs patch/Degraded), the v4.2.2-rc patch rollout (certGate in-test, gated), and the rollup.

**Notes**
- Read/API only over the existing CVE model (no schema change, no mutations — the screen is SEC.2). CVE list via getCurrentUser → dbForOrg + paginated; the derived posture/rollout summary via getSecurityData. Composes over **FLEET.1** (`getFleetData` — device posture over robot firmware/status) + **ENG.1** (`getEngineeringData` — firmware releases + the cert gate from CompatCell). **Through-line preserved:** CVE-2026-3187 (CRITICAL, 42 deployed HX-2 units) → fix = signed firmware **v4.2.2-rc** → must clear **Engineering's cert gate** (CompatCell `in-test`) before rollout. Posture buckets: Degraded (fault/offline) · Needs patch (behind latest released fw) · Hardened.
- **MOAT / gating:** patch rollout + access changes are **agent-DRAFTED/proposed only** — `/// RBAC.4` (Engineering's cert gate = approval owner) + `/// AUDIT.3` (inputs·output·model·confidence·approver) seams left; no event-log/confidence/approver columns added.

### Deferred decisions (SEC.1)
- (a) **No DevicePosture model** → posture derived over the Robot fleet (firmware vs latest released + fault/offline). A first-class posture/attestation model = schema addition; deferred.
- (b) **No Patch/rollout model** → patch rollout derived from the ENG RC firmware release + the cert gate (CompatCell). A first-class rollout state machine (targets, waves, ack) = schema addition; deferred (RBAC.4 owns the approval).
- (c) **No CVE↔firmware link** on the CVE model → the fix is joined by convention (RC firmware fixes the largest PATCH_DRAFTED deployed-unit CVE). A `fixedBy`/`patchVersion` column would make it explicit; deferred (derive-or-flag, no new column now).
- (d) **No Access-management model** → access-management (identity, keys, sessions) is not in SEC.1; SEC.2 flags it / defers to a dedicated model.

---

## SEC.2 — Security screen

**Automated**
- `pnpm verify:sec-2` — route + components (SecurityView/PosturePanel/AccessPanel/VulnerabilitiesTable); renders getSecurityData + getAccessGrants; CVE-triage table binds the cert-gate remediation; posture + access panels bind SEC.1 data; read-only (no mutations); no red/emoji/raw hex; CVE triage + posture full; CVE-2026-3187 → v4.2.2-rc resolves through the ENG cert gate on-screen (in-test, gated); access panel renders (derived stand-in, no live write).
- `pnpm typecheck` clean · `verify-sec-1` / `verify-fleet-1` / `verify-eng-1` stay green · `accessibility-review` 0.

**Manual (./dev.sh, http://localhost:3001/security)**
- [ ] Matches Security.dc.html on the v2 shell — **fleet endpoint posture** (Hardened/Needs-patch/Degraded spread over the fleet) + **fleet command access** (HUMAN/AGENT/SVC grants; stale token "Revoked" ink) + the **vulnerabilities** CVE-triage table (CVE-2026-3187 CRITICAL 42 units · remediation **v4.2.2-rc · in-test** = the cert gate). Critical renders in ink, not red.
- [ ] CVE-2026-3187 → v4.2.2-rc cert-gate through-line reads in the Remediation column; "Push patch" seeds the sec agent; agents pane populated (Security agents).
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over SEC.1 getSecurityData + getAccessGrants (org-scoped). No new seed (SEC.1 enriched CVEs + the sec-orchestrator run; posture/access are derived). Patch deploy / access revoke-rotate-grant are **agent-DRAFTED only** — `/// RBAC.4` (Engineering's cert gate owns patch approval) + `/// AUDIT.3` seams; no live human write; no event-log/confidence/approver columns.
- **Design deviations flagged (data-shape mismatch — not fabricated):**
  1. Stats **MFA coverage / mean patch time** need an access / patch-timing model → real **Open rollouts** + **Units affected** fill those slots; **Endpoints** counts deployed robots (gateways / IT endpoints not modeled).
  2. Posture panel: the design's **signed-firmware / TLS-cert / OT-segmented** controls need an **endpoint-attestation model** → rendered the derivable **firmware-posture spread** (Hardened/Needs-patch/Degraded) over the fleet.
  3. **No Access-management model** → the access panel is a **derived stand-in** (command-capable users + a scoped field-service agent + the signed OTA push + one flagged stale-token) — deferred to a real Access model.
  4. **CVE has no component field** → the Component column shows a **derived scope** (deployed fleet vs component library); per-CVE component names deferred.
  5. **No CVE↔firmware fixedBy link** → remediation joined by convention (RC firmware fixes the largest PATCH_DRAFTED deployed-unit CVE), as in SEC.1.
  6. **"Push patch"** seeds the sec agent (proposes); the real patch deploy is a **gated write owned by Engineering's cert gate** — deferred, kept read-only.

---

## SALES.1 — Sales data/API

**Automated**
- `pnpm verify:sales-1` — routes (deals/forecast); lib org-scoped (dbForOrg) + paginated (FND.11); deliverability composes over FUL.1 + MFG.1 (reuses libs); moat RBAC.4 + AUDIT.3 seams (agent-drafted only); read-only (no mutations); getSalesData funnel binds across all 5 stages; weighted forecast + pipeline value bind; BMW deliverability resolves AT_RISK through FUL + MFG; deliverability spread + at-risk count; listDeals paginates + filters by stage; org isolation.
- `pnpm typecheck` clean · `verify-ful-1` / `verify-mfg-1` / `verify-proc-1` stay green.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/sales/deals?stage=COMMIT'` returns the BMW deal (HX-2 ×24, $4.8M).
- [ ] `curl http://localhost:3001/api/sales/forecast` returns the funnel (all 5 stages), weighted forecast, deliverability spread; BMW deliverability AT_RISK with a reason referencing DLV-3312 + the HX-2 line hold.

**Notes**
- Read/API only over the existing Deal model (no schema change, no mutations — the pipeline screen is SALES.2). Deal list via getCurrentUser → dbForOrg + paginated; the funnel/forecast summary via getSalesData. The **DELIVERABILITY badge is DERIVED, not the stored string**: getSalesData composes **FUL.1** (`getFulfillmentData` — the deal account's delivery hold/late) + **MFG.1** (`getManufacturingData` — a line hold on the deal's product). **Through-line preserved:** BMW → DLV-3312 EAR99 hold (FUL) + HX2-0208 line hold (MFG, ECO-318/lot-88421) → **AT_RISK +3w**. Deals with no ops commitment yet fall back to the stored agent-checked feasibility. Weighted forecast = Σ(value × stage-probability) [QUALIFY .1 · DEMO .25 · PROPOSAL .5 · NEGOTIATION .7 · COMMIT .9].
- **MOAT / gating:** CPQ config, contracts, forecast commits are **agent-DRAFTED/proposed only** — `/// RBAC.4` + `/// AUDIT.3` seams; no event-log/confidence/approver columns.

### Deferred decisions (SALES.1)
- (a) **No CPQ / quote model** → `Deal.config` is a string ("HX-2 ×24"); a real CPQ (line items, options, pricing rules) = schema addition; deferred.
- (b) **No forecast model** → the weighted Q3 forecast is derived (value × stage-probability); a first-class forecast/quota model = schema addition; deferred.
- (c) **Deliverability has no model** → derived over FUL.1 + MFG.1 per deal; a stored deliverability check (with confidence/approver) = the AUDIT.3 event-log layer; deferred.

---

## SALES.2 — Sales & CRM screen

**Automated**
- `pnpm verify:sales-2` — route + components (SalesView/PipelineFunnel/ForecastPanel/DealsTable); renders getSalesData; deals table binds the derived deliverability badge + reason; funnel + forecast panels bind; CPQ/new-deal is agent-proposed (no live write); no red/emoji/raw hex; funnel full (5 stages, weighted < pipeline); BMW deliverability AT_RISK resolves through FUL/MFG on-screen; deliverability spread has a mix.
- CI gate (`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm verify:all`) green · `accessibility-review` 0 · SALES.1/FUL.1/MFG.1 stay green.

**Manual (./dev.sh, http://localhost:3001/sales)**
- [ ] Matches Sales & CRM.dc.html on the v2 shell — the **pipeline funnel** (5 stages, Commit lime) + **Q3 forecast** (weighted commit vs best-case, BMW the swing) + the **top-deals table** with the agent-checked **deliverability badge** (BMW **At risk** ink, reason "DLV-3312 EAR99 customs hold · HX-2 line hold"). AT_RISK in ink, never red.
- [ ] BMW deliverability AT_RISK reads on-screen (derived through FUL/MFG, not a hardcoded badge); "New deal" seeds the crm agent; Sales agents pane populated.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over SALES.1 getSalesData (org-scoped) — deliverability derived over FUL.1 + MFG.1. No new seed (SALES.1 enriched the 8-deal pipeline + the sales-orchestrator run). CPQ config / quote / contract / forecast commit are **agent-DRAFTED only** — `/// RBAC.4` + `/// AUDIT.3` seams (in the SALES.1 lib); no live write; no event-log/confidence/approver columns.
- **Design deviations flagged (data-shape mismatch — not fabricated):**
  1. Stats **win rate / avg cycle** + the topbar **% to target** need a won-lost / cycle-time / quota model → real **Deals** + **At risk** counts (+ the at-risk pill) fill those slots.
  2. Forecast panel's fixed **quota/target marker** needs a forecast/quota model → the bar shows **weighted coverage of the best case** (pipeline) instead.
  3. **No CPQ / quote model** (`Deal.config` is a string) → the design has no CPQ panel; CPQ is the **CPQ agent** (pane + trace), agent-drafted, no live write — a real CPQ (line items, pricing rules) is deferred.
  4. **"New deal" / CPQ configure / generate contract** seed the crm agent (propose); real writes are gated (RBAC.4) — deferred, kept read-only.

---

## MKT.1 — Marketing data/API

**Automated**
- `pnpm verify:mkt-1` — routes (campaigns/funnel); lib org-scoped (dbForOrg) + paginated (FND.11); attribution reconciles to SALES.1 (reuses getSalesData); moat RBAC.4 + AUDIT.3 seams; read-only (no mutations); demand funnel binds (leads→MQL→SQL→pipeline); events channel dominant in attribution; attribution reconciles to Sales pipeline (coverage %); underperforming paid campaign flagged; listCampaigns paginates + filters by channel; org isolation.
- CI gate green · SALES.1 / FUL.1 stay green.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] `curl 'http://localhost:3001/api/marketing/campaigns?channel=events'` returns the 2 events campaigns (Automate 2026, Humanoid Summit).
- [ ] `curl http://localhost:3001/api/marketing/funnel` returns the demand funnel, the channel attribution (events dominant), the coverage % vs Sales pipeline, and the underperforming count (Paid search Q3 flagged).

**Notes**
- Read/API only over the existing Campaign model (no schema change, no mutations — the screen is MKT.2). Campaign list via getCurrentUser → dbForOrg + paginated; the funnel/attribution summary via getMarketingData. The **attribution reconciles to Sales**: getMarketingData reuses **SALES.1** (`getSalesData`) — the funnel's SQL = Sales deal count, the funnel pipeline + coverage % = the Sales pipeline (`rollup.pipelineValue`), not hardcoded. **Through-line preserved:** events dominant (Automate 2026 + Humanoid Summit = $8.5M sourced), **Paid search Q3 flagged underperforming** (roi 0.7). `underperforming` = status UNDERPERFORMING or roi < 1.0.
- **MOAT / gating:** budget reallocation + SQL hand-off to Sales are **agent-DRAFTED/proposed only** — `/// RBAC.4` + `/// AUDIT.3` seams; no event-log/confidence/approver columns.

### Deferred decisions (MKT.1)
- (a) **No attribution model** → pipeline-by-channel derived over Campaign + reconciled to SALES.1 (`getSalesData`); a first-class attribution model (touch-weighted, multi-touch) = schema addition; deferred.
- (b) **No demand-funnel / lead model** → leads estimated from MQLs via a labelled top-of-funnel rate (`LEAD_TO_MQL_RATE`); SQL/pipeline reconciled to Sales. A real lead/funnel model = schema addition; deferred.

---

## MKT.2 — Marketing screen

**Automated**
- `pnpm verify:mkt-2` — route + components (MarketingView/DemandFunnel/ChannelAttribution/CampaignsTable); renders getMarketingData; funnel + channel-attribution panels bind; campaigns table binds the underperforming flag; read-only (no mutations); no red/emoji/raw hex; funnel + attribution full; events reads dominant on-screen; underperforming paid campaign flagged (ink).
- CI gate green · `accessibility-review` 0 · MKT.1/SALES.1 stay green.

**Manual (./dev.sh, http://localhost:3001/marketing)**
- [ ] Matches Marketing.dc.html on the v2 shell — the **demand funnel** (Leads→MQL→SQL→Pipeline) + **pipeline by channel** (Events lime = dominant) + **campaigns table** (Paid search Q3 ink "Underperforming"). No invented reds.
- [ ] Events reads dominant (54%); Paid search Q3 flagged underperforming; the topbar "% pipeline sourced" = coverage reconciled to Sales; "New campaign" seeds the mkt agent; Marketing agents pane populated.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only reads over MKT.1 getMarketingData (org-scoped) — attribution reconciled to SALES.1. No new seed (MKT.1 enriched the 7-campaign set + the mkt-orchestrator run). Budget reallocation / SQL hand-off / launch-pause are **agent-DRAFTED only** — `/// RBAC.4` + `/// AUDIT.3` seams (in the MKT.1 lib); no live write; no event-log/confidence/approver columns.
- **Design deviations flagged (data-shape mismatch — not fabricated):**
  1. Stats **MQL→SQL rate / cost-per-MQL** + funnel **Visitors** need a web-analytics / spend model → real **MQLs / Sourced pipeline / SQLs→Sales / Underperforming** fill the strip; the funnel starts at Leads (estimated from MQLs).
  2. The **enterprise funnel narrows sharply** (many MQLs → few large deals, SQL = Sales deal count) → funnel bars carry a min-width for visibility; the drop is real, not a rendering bug.
  3. **No attribution model** → pipeline-by-channel derived over Campaign + reconciled to SALES.1; **no lead model** → leads via the labelled `LEAD_TO_MQL_RATE`.
  4. **"New campaign" / reallocate / hand-off** seed the mkt agent (propose); real writes are gated (RBAC.4) — deferred, kept read-only.

---

## MACH.1 — Machines screen + read model

**Automated**
- `pnpm verify:mach-1` — route + component + API routes exist; lib org-scoped (dbForOrg) + paginated (FND.11); moat RBAC.4 + AUDIT.3 seams; read-only (no mutations); screen renders both groups + the needs-service filter; groups Fixed + Mobile both populated; needs-service flag + rollup bind; machines carry telemetry signals; listMachines paginates + filters by kind; org isolation.
- CI gate green · `accessibility-review` 0 · siblings stay green.

**Manual (./dev.sh, http://localhost:3001/machines)**
- [ ] Matches Machines.dc.html on the v2 shell — the register table grouped **Fixed plant / Mobile units** with per-row **status / utilization / health / telemetry** cells; the inline stat strip (Machines / Running now / In maintenance / Avg utilization); the **Needs service** filter toggle (TEST-01 fault + SMT-01 re-cal due surface). Fault/critical in ink, never red.
- [ ] The needs-service filter narrows to the flagged machines; Maintenance agents populate the pane (trace references TEST-01 / SMT-01); "Register machine" seeds the agent.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only over Machine + MachineSignal (no schema change). getMachinesData groups Fixed/Mobile, derives **needsService** (healthLevel WATCH/BAD or status FAULT), surfaces the latest signal per machine, and rolls up (counts by status, running/maintenance/idle, needs-service, avg utilization, telemetry-online). Seed (FND.12) = 21 machines (8 Fixed + 13 Mobile) with signals + a real maintenance-orchestrator AgentRun. Service/PM actions are **agent-DRAFTED only** — `/// RBAC.4` + `/// AUDIT.3` seams; no live write; no event-log/confidence/approver columns.
- **Design adaptations flagged:**
  1. The design places the **"All machines / Needs service"** scope in the agent-pane chips; the shared pane is generic infra, so the needs-service scope is surfaced as a **table filter toggle** on the screen (per the story). The pane still auto-loads the Maintenance agents + the seeded maintenance-orchestrator trace.
  2. No OEE/availability feed in the model → the stat strip uses the derivable **Avg utilization** (not OEE); a real OEE feed = telemetry/schema addition (deferred, as in MFG).

---

## PROJ.1 — Projects list screen + read model

**Automated**
- `pnpm verify:proj-1` — route + component + API routes; lib org-scoped (dbForOrg) + paginated (FND.11); moat RBAC.4 + AUDIT.3 seams + file matrix deferred to MTX.2; read-only (no mutations); GA.1 Axona agent in the pane (no projects roster); groups module-separated; member breakdown + file count + status + last-activity bind; rollup binds; cross-module through-line project present (ECO-318/NCR-118); listProjects paginates + filters by module; org isolation.
- CI gate green · `accessibility-review` 0 · siblings stay green.

**Manual (./dev.sh, http://localhost:3001/projects)**
- [ ] Matches Projects.dc.html on the v2 shell — projects **grouped module-separated** (Engineering / Quality / Sales / …), each row with name+description, **file count**, **member avatars** (agent glyphs + human initials), **status badge + last-activity**. The inline stat strip (Projects / Modules / Files / Need attention). Blocked in ink, never red.
- [ ] The side pane is the **Axona agent (GA.1)** — cross-project scope (Core module → no per-module roster). "New project" / a project row seeds the agent (propose). ECO-318 / NCR-118 / DLV-3312 projects present.
- [ ] accessibility-review 0 violations.

**Notes / flags**
- Read-only over Project + File (no schema change). getProjectsData groups module-separated, parses the members Json (agent count + human names), surfaces the **file COUNT** + last activity + a derived **needs-attention** flag (BLOCKED / IN_REVIEW), and rolls up. Seed (FND.12) = 14 projects across modules, member mixes varied (1–2 agents + 1–3 humans), files present, statuses varied, tied to the ECO-318/NCR-118/SERVO-205/BMW·DLV-3312 through-line. Create-project / add-file / assign are **agent-DRAFTED only** — `/// RBAC.4` + `/// AUDIT.3` seams; no live write.
- **Design deviations flagged:**
  1. **The per-project file MATRIX (opening a project → AI-extracted columns) is MTX.2** — a separate later story blocked on the files pipeline. PROJ.1 shows the file COUNT only; a project row seeds the Axona agent to summarize (no navigation to a matrix, no extraction built).
  2. The design's pane "Ask about: All projects / Blocked only" scope chips are pane-specific content; the shared pane is generic infra, so it auto-loads the **Axona agent (GA.1)** with cross-project scope (the scope chips aren't replicated).

---

## WF.1 — Workflow DAG model + BullMQ run engine

**Automated**
- `pnpm verify:wf-1` (11 checks, PRD §10) — engine files exist; run endpoint requireRole-gated + org-scoped enqueue; executor guardrail → AWAITING_APPROVAL + halt; Zod validates a good graph & rejects malformed (bad ref / no trigger / decision w/o condition); decision gate branches (lt/​in); executor end-to-end → SUCCEEDED w/ non-empty TraceLine[]; procurement run parks AWAITING_APPROVAL w/ **no PO auto-placed**; decision onFalse → escalate output → SUCCEEDED; forced error → FAILED w/ partial trace; org scoping (org A's run invisible to org B); ≥3 seeded workflows incl. a parked run.
- Pure-logic checks always run; engine checks gated on `DATABASE_URL`. **Redis is NOT required** — the executor runs in-process with `FakeModelClient` (mirrors the DB-gated skip).
- CI gate green · siblings stay green.

**Manual (enqueue a run locally)**
- Schema additions applied to the dev DB via `prisma db push` (WorkflowRun.orgId + RunStatus.AWAITING_APPROVAL); the migration file `…_wf1_workflowrun_orgid_awaiting_approval` is the artifact for fresh/prod (`prisma migrate deploy`).
- With Redis: set `REDIS_URL`, run the worker (`pnpm --filter @axona/worker start`), then `POST /api/workflows/:id/run` with `{ "triggerPayload": { "value": 48000 } }` → returns `{ runId }`; the worker executes it. Without Redis the API runs the engine in-process and still returns the runId.
- Expected: the **Procurement reorder** workflow with `value < 50000` walks source → RFQ → decision(onTrue) → draft PO → **guardrail gate → AWAITING_APPROVAL** (no PO placed). With `value ≥ 50000` it branches onFalse → escalate → SUCCEEDED. **NCR-118 → ECO-318** and **Predictive maintenance → dispatch** run to SUCCEEDED.
- `GET /api/workflows/:id/runs` (run list) and `GET /api/workflow-runs/:runId` (status + full trace) are org-scoped reads (feed WFL.1/WFL.2). No SSE — live streaming is WF.2.

**Notes / flags**
- Two bounded schema additions (PRD §4): `WorkflowRun.orgId` (scalar + `@@index`; added to `TENANT_MODELS` so dbForOrg scopes it) and `RunStatus += AWAITING_APPROVAL`. `/// RBAC.4` (resume-from-gate) + `/// AUDIT.3` (immutable inputs·output·model·confidence·approver) seams on WorkflowRun — no event-log/confidence/approver columns added.
- **Propose→approve→audit:** guardrail gates (and any gated tool a step proposes) emit `AWAITING_APPROVAL` and HALT — money/safety/contract is never auto-executed; RBAC.4 resumes. Every DB touch via `dbForOrg(orgId)`; a run for org A is invisible to org B.
- **Reuses the ART.1/ART.2 runtime** — agent nodes call `runAgent` + the existing `TraceCollector`/`TraceLine` (no second trace shape). The engine (graph + executor) lives in `@axona/agents` so the enqueue API (in-process), the `apps/worker` BullMQ consumer, and verify all share it.
- **Deferred (non-goals):** live SSE (WF.2), gate-DSL hardening (WF.2), approval-resume (WF.3/RBAC.4), ART.3 event routing, immutable event log (ONT.1/AUDIT.3). Flagged in-code.

---

## SRCH.4 — Fix broken universal search (bugfix)

**Root cause** — WF.1 applied its schema change to the push-managed dev DB via `prisma db push`; push drops raw-SQL objects not modeled in `schema.prisma`, silently removing `SearchDoc.tsv` (the FTS generated column) + `searchdoc_tsv_gin`. `search()`/`countByType()`'s `$queryRaw` over `"tsv"` then threw `42703` → `/api/search` returned an unhandled 500 (non-JSON) → the client's `.then(r=>r.json())` threw → `.catch` showed **"Search unavailable"** for every query.

**Fix (read-only; no schema.prisma change)**
1. **Self-heal** — `ensureSearchIndexSchema()` (idempotent `ADD COLUMN IF NOT EXISTS "tsv"` + `CREATE INDEX IF NOT EXISTS "searchdoc_tsv_gin"`) runs at the start of a full `reindex()`, so every `pnpm db:seed` repairs the FTS objects a `db push` may have dropped. Fresh/prod DBs still get them from the `add_searchdoc_fts` migration.
2. **Route** — `/api/search` wraps `search()`/`countByType()` in try/catch → on failure logs + returns a clean **JSON 503** `{error:"search_failed", hits:[], …}` (never an unhandled 500).
3. **Client** — `use-search.ts` checks `r.ok`: a 5xx/transport error → **"Search unavailable"**; a 200 with zero hits → the palette's **"No matches for …"** empty state (no longer masked as an error).

**Automated**
- `pnpm verify:srch-4` — route returns clean 503 + logs; client checks r.ok; reindex self-heals; procur → Procurement MODULE hit near top; sales/fleet module names resolve; garbage → empty (no throw); counts populate; **self-heal: drop tsv → search throws → ensure repairs it → procur works**.
- CI gate green · SRCH.1/2/3 stay green · `accessibility-review` 0 on /search.

**Manual (./dev.sh, http://localhost:3001/search or ⌘K)**
- [ ] Type `procur` → **Procurement** appears as a MODULE result at/near the top; other module names (sales → Sales & CRM, fleet → Fleet) resolve too; scope tabs show live counts.
- [ ] Type gibberish (`zzqxwv`) → **"No matches for …"** (NOT "Search unavailable").
- [ ] "Search unavailable" now appears only on a genuine 5xx/transport failure.

**Notes** — No new deps, no schema.prisma change. Reinforces the WF.1 flag: the dev DB needs its Prisma migration history baselined so `db push` stops clobbering hand-authored FTS/pgvector DDL; `ensureSearchIndexSchema` is the interim guard for the search index specifically.

---

## UX.1 — Screen polish pass (layout bugfixes)

**Root causes**
- **Stat strip clipped its numbers** — the strip is `flex overflow-hidden rounded-card`; `overflow-hidden` (for the rounded corners) makes the row's flex `min-height` compute to 0, so the parent flex-col scroll region shrank it below its content (cell 31px vs 33px number) and clipped the digits. Same mechanism clipped the `overflow-hidden` TraceConsole. **Fix: `shrink-0`** on both.
- **/agents empty pane** — AgentsView initialised `selected=null` → "Select an agent…" placeholder.

**Fix (pure UI; no data/API/schema change)**
1. Extracted a shared **`components/shell/StatStrip.tsx`** (`shrink-0` + the exact v2 22px-bold-value / 9px-mono-label markup) and swapped it into all **12** module Views (Quality, Sales, Marketing, Field Service, Engineering, Autonomy, Finance, Security, Legal, Fulfillment, People, Manufacturing) — so the layout can't drift again. Values/labels/cell-count unchanged (1:1 with each `.dc.html`).
2. **TraceConsole** section is `shrink-0` → renders all trace lines at natural height, reachable via the scroll region (no bottom clip, no max-height truncation).
3. **AgentsView** default-selects the Command Center Axona agent (`pickDefaultAgent`, else first roster agent) via the `useState` initializer → chat + reasoning stream load immediately. Manual selection + the "Needs attention" filter unchanged.

**Automated**
- `pnpm verify:ux-1` (6 checks) — StatStrip exists w/ shrink-0; all 12 Views use it; no View hand-rolls the clipped inline strip; TraceConsole shrink-0 (no max-h); /agents default-selects. tsc/lint clean; CI gate green (all verifies stay green).

**Manual (./dev.sh)**
- [ ] `/quality`, `/sales`, `/engineering`, `/finance`, etc. — stat numbers + labels fully visible (no top/bottom crop); 240px sidebar / 60px header intact.
- [ ] `/engineering` (or `/quality`) — scroll to the dark Agent trace: every line renders, nothing clipped at the viewport bottom.
- [ ] `/agents` — opens with the Axona agent chat already loaded (not "Select an agent…"); clicking another agent still switches; "Needs attention" still filters.
- [ ] accessibility-review 0 on touched screens.

---

## UX.2 — De-duplicate the agent pane on /agents

**Problem** — /agents showed TWO chat surfaces: the Agents screen's own roster→chat (AgentsView) AND the shell's persistent global Axona copilot pane (`shell/AgentPane.tsx`, GA.1/axona-00). Every other route should keep the global pane; /agents should not double it.

**Fix (pure UI)** — `AgentPane` (client) `usePathname()`; after all hooks run, `if (pathname === "/agents") return null` — suppresses both the pane and its collapsed rail on /agents only. The shell grid `grid-cols-[auto_1fr_auto]` third (auto) column collapses to zero width with no content → no empty column, leftover border (the `border-l` lives on the suppressed `<aside>`), or gap. Unchanged on every other route.

**Automated** — `pnpm verify:ux-2` (3 checks): suppresses on /agents via usePathname→null; guard sits after the hooks + before render; global pane/rail intact for other routes. accessibility-review 0 on /agents; tsc/lint clean; CI gate green (verify-ux-1 stays green).

**Manual** — [ ] `/agents` shows exactly one chat pane (the screen's own), no far-right Axona duplicate, no empty column/border. [ ] `/quality` (and any other route) still shows the global Axona pane intact.

---

## WFL.1 — Workflows list screen + read model

**Automated**
- `pnpm verify:wfl-1` — route + component + API routes; lib org-scoped (dbForOrg) + paginated (FND.11) + **reuses WF.1's WorkflowGraph** (safeParseGraph); moat RBAC.4 + AUDIT.3 seams (run is WFL.2); screen uses shared **StatStrip (inline variant)**; read-only; groups module-separated + populated; step-count/agent-chain/modules-touched bind from the graph; rollup agents-orchestrated = distinct chain codes; **last-run binds from the real run — procurement reads AWAITING_APPROVAL**, a draft has no run; listWorkflows paginates + filters; org isolation.
- CI gate green · siblings (verify-wf-1/ux-1/ux-2) stay green · accessibility-review 0 on /workflows.

**Manual (./dev.sh, http://localhost:3001/workflows)**
- [ ] Matches Workflows.dc.html on the v2 shell — workflows **grouped module-separated**, each row: name+desc · **agent-chain glyph preview + "N steps"** · **modules touched** (mono) · status badge + **last-run** column. The inline stat strip (Workflows / Active / Runs·30d / Agents orchestrated).
- [ ] The **Procurement reorder** row's last-run shows **Awaiting approval** (the parked WF.1 run, in ink — not red); the Manufacturing draft shows "—". A row opens the Axona agent (propose). Global Axona pane present (Core route — not suppressed).
- [ ] accessibility-review 0.

**Notes / flags**
- Read-only over Workflow + WorkflowRun (no schema change). `getWorkflowsData` reuses WF.1's `WorkflowGraph` (`safeParseGraph`) to derive step count, the agent-chain preview (ordered agent-node codes), and the modules touched; surfaces the latest run's status (incl. **AWAITING_APPROVAL**) + relative time. Grouped module-separated; rollup = total / active / runs·30d / distinct agents orchestrated.
- **Seed enriched to 9 workflows** (the 3 WF.1 through-line ones + 6 across Manufacturing/Sales/Fulfillment/Security/Autonomy/Finance), each a real WorkflowGraph + a last run (2 drafts; Manufacturing has no run) → the module-separated list renders as populated as the mock. Run timestamps are recent + varied for realistic last-run times.
- **StatStrip gained an `inline` variant** (16px bar) so Workflows/Machines/Projects and the 12 card screens share one primitive (the mock uses the inline strip here, not the 22px card).
- Running a workflow (Run button + live console) is **WFL.2**; any trigger stays agent/RBAC-gated (WF.1 enqueue API · RBAC.4). Rows browse+open only.

---

## WFL.2 — Workflow detail screen (step-flow + run console)

**Automated**
- `pnpm verify:wfl-2` — route + component + detail API route; `getWorkflowDetail` org-scoped + reuses WorkflowGraph; moat seams RBAC.4 + AUDIT.3 + WF.2 (live SSE deferred); run console replays via TraceConsole + Run posts to the WF.1 enqueue API; detail route read-only; detail returns the parsed step-flow (trigger→agent→decision→guardrail→output); decision gate exposes branch labels; runs carry persisted TraceLine[] (replayable); procurement detail replays the AWAITING_APPROVAL parked run (guardrail proposal line); Run is RBAC-gated + never auto-executes a gated action; org isolation.
- CI gate green · siblings (WFL.1/WF.1/UX.*) stay green · accessibility-review 0 on /workflows/:id.

**Manual (./dev.sh, http://localhost:3001/workflows → click a workflow)**
- [ ] Matches Workflow.dc.html on the v2 shell — header (name + status + description), stats (Steps / Modules / Avg run / Runs·30d), the **step-flow canvas** (trigger → agent glyphs → decision gate w/ branches → **approval gate in ink** → output, markers + connectors), and the **run console** (Trigger + Run button + Execution log + Recent runs).
- [ ] Open the **Procurement reorder** detail → the run console **replays the parked run**: scan → … → policy-check → draft PO → **the guardrail "AWAITING_APPROVAL (RBAC.4)" line**; the approval-gate step renders in ink (never red).
- [ ] Click **Run workflow** → it enqueues via the RBAC-gated WF.1 API, then replays the resulting persisted run. A money/safety workflow parks at AWAITING_APPROVAL (a "Parked — proposed, awaiting approval; no action auto-executed" note shows) — never auto-executes.
- [ ] Global Axona pane still present (Core route). accessibility-review 0.

**Notes / flags**
- Read-only over Workflow + WorkflowRun (no schema change). `getWorkflowDetail` reuses WF.1's `WorkflowGraph` (`safeParseGraph`) to build the step-flow (trigger/agent/decision/guardrail/output) + returns the ordered runs with their persisted `TraceLine[]` traces. GET `/api/workflows/:id` (detail) added; runs replay through `TraceConsole`.
- **Run button** → WF.1's `POST /api/workflows/:id/run` (requireRole line 1), then refetch `GET /api/workflow-runs/:runId` and replay — **no live SSE** (that's WF.2, `/// WF.2` seam). Sends a demo `triggerPayload {value: 48000}` so the procurement guardrail stays on its parked branch (propose→approve→audit; never auto-executes). `/// RBAC.4` + `/// AUDIT.3` seams; no event-log/confidence/approver columns.
- **Design deviations flagged:**
  1. The design's run console is a resizable **right panel**; to keep the global Axona pane (task requirement, Core route) the console is a **column within main** beside the step canvas (`lg:grid-cols-[1.5fr_1fr]`) — same elements (Trigger, Run, Execution log, Recent runs), not a third shell pane.
  2. The detail **stats** are the design's compact label/value header row (Steps/Modules/Avg run/Runs·30d), not the full-width StatStrip bar — the design uses this micro-layout here. "Avg run" = mean of `endedAt − startedAt` over completed runs (seed sets ~35s).
  3. WFL.1 rows now **link to `/workflows/:id`** (were seeding the copilot) so the detail is reachable — the design's list rows link to the detail.

---

## MIGRATE.1 — Baseline migration history; protect FTS/pgvector DDL; forbid db push; self-clean verify

**Root cause** — `prisma db push` (and an ordering quirk) left the hand-authored raw-SQL DDL in an inconsistent state: it silently dropped the SearchDoc FTS (`tsv` + `searchdoc_tsv_gin`) and File pgvector (`embedding vector(1536)` + `file_embedding_hnsw`) objects — the cause of the `/search` 500 and a P3005 that blocked `./dev.sh`. Even a clean `migrate reset` didn't recreate `file_embedding_hnsw` (its `enable_pgvector_ann` `CREATE INDEX` didn't persist on fresh apply, while the later SearchDoc HNSW did).

**Fix**
1. **Trailing ensure-migration** `…_migrate1_ensure_raw_sql_ddl` re-asserts EVERY hand-authored object idempotently (`ADD COLUMN IF NOT EXISTS "tsv" …`, `CREATE INDEX IF NOT EXISTS` for `searchdoc_tsv_gin` / `searchdoc_embedding_hnsw` / `file_embedding_hnsw`) as the last deploy step — so a fresh `migrate deploy` reproduces all raw-SQL DDL exactly, drift-proof.
2. **Baseline reconciled** — `prisma migrate reset` re-applies all migrations from the files; `_prisma_migrations` records all as applied; `migrate status` = "up to date"; no drift. `migrate dev`/`migrate deploy` is the only schema path (dev.sh + CI already use them; no `db push` anywhere).
3. **Never `db push`** — documented here + in CLAUDE.md build section. It drops raw-SQL DDL Prisma can't model.
4. **Verify self-clean** — `verify-wf-1` snapshots the seeded `WorkflowRun` ids, then deletes any run it enqueues during the checks (`deleteMany where id notIn seededRunIds`), restoring the seeded state so `verify:all` never leaves the procurement workflow's latest run non-parked.

**Automated**
- `pnpm verify:migrate-1` — FTS + pgvector DDL live in committed migrations; the trailing ensure-migration re-asserts every object; no `db push` in scripts/dev.sh/CI; verify-wf-1 self-cleans; migration history clean (every on-disk migration applied, none rolled back); (a) SearchDoc.tsv present + FTS "procur" → Module hit; (b) File.embedding vector(1536) + HNSW index present; parked fixture intact (procurement latest run AWAITING_APPROVAL).
- CI gate green; `verify:all` green (self-clean keeps siblings green).

**Manual**
- Fresh DB: `prisma migrate reset --force --skip-seed && pnpm --filter @axona/db run db:seed` → `migrate status` clean; `curl /api/search?q=procur` → 200 with a Procurement MODULE hit.
- Never run `prisma db push` on this repo. Schema change = `migrate dev` (author) → commit the migration → `migrate deploy` (apply).

---

## INV.1 — Inventory data/API

**Automated**
- `pnpm verify:inv-1` — lib + API routes exist; org-scoped (dbForOrg) + paginated (FND.11) + read-only (no mutations); moat RBAC.4 + AUDIT.3 seams; days-of-cover is a LABELLED stand-in (Part.dailyUse); stock-by-location across kinds (edge caches + finished goods); critical parts carry days-of-cover + reserved + status (finished units excluded); reorder-needed ties to an incoming Procurement PO; spares-near-fleet + reserved totals bind + Osaka below-min; listInventory paginates + filters by location; org isolation.
- `prisma migrate status` clean after the new migration; CI gate green; siblings stay green.

**Manual** — `GET /api/inventory/summary` returns critical parts / stock-by-location / edge caches / rollup; `GET /api/inventory?location=Osaka` filters. (INV.2 is the screen, 1:1 to Inventory.dc.html.)

**Notes / data-shape flags**
- **Schema (bounded, via `migrate dev` — NEVER db push):** new `InventoryStock { orgId, partId, location, kind(CENTRAL|LINE_SIDE|EDGE_CACHE|FINISHED_GOODS|PLANT), onHand, reserved, minLevel, valueUsd }` (+ `@@index([orgId])`/`@@index([partId])`); `Part.dailyUse Int @default(1)`. Migration `…_inv1_inventory_stock`; `migrate status` clean.
- **`getInventoryData`** composes over Part + PurchaseOrder + InventoryStock: critical parts (onHand, Σreserved, **days-of-cover**, status REORDER/WATCH/QUARANTINE/HEALTHY, `reorderNeeded` + incoming PROC.1 PO), stock-by-location (by kind, value + %), edge caches (below-min → REPLENISH), rollup. Reorder is Procurement's agent-drafted job — surfaced here, never written.
- **DEFERRED-LEDGER (labelled stand-ins, not fabricated):**
  1. **Days of cover** = `onHand ÷ Part.dailyUse` (seeded consumption constant). Real rate = build-schedule / BOM-explosion feed → deferred.
  2. **Quarantine** status via the `LOT-*` sku convention (ties to Quality NCR-118); a real `Part.class`/quarantine flag → deferred.
  3. **Finished goods** via the `*-UNIT` sku convention (excluded from the build critical-parts table); a real part-classification field → deferred.
  4. **Returns & RMA** (design's "14 open") — **deferred**, no returns model; not fabricated. A minimal RMA model lands with INV.2/a later story.
- **Through-line preserved:** SERVO-204 below reorder → incoming PO (PROC.1); Osaka edge cache below-min ties to the DLV-3312 fleet; LOT-88421 quarantine ties to NCR-118. Seed: 5 extra parts + 16 stock rows across 4 echelons/3 edge caches + an inv-orchestrator AgentRun.

---

## INV.2 — Inventory screen

**Automated**
- `pnpm verify:inv-2` — route + component + format; binds getInventoryData + shared StatStrip; renders the four artifacts (stock-by-location · critical parts · edge caches · inv-orchestrator trace); read-only (no mutations, no fabricated RMA numbers); no invented reds; critical-parts/stock/spares/rollup bind; **SERVO-204 shows REORDER → incoming PO**; **Osaka reads REPLENISH**; inv-orchestrator trace present.
- CI gate green · INV.1 + siblings stay green · accessibility-review 0 on /inventory.

**Manual (./dev.sh, http://localhost:3001/inventory)**
- [ ] Matches Inventory.dc.html on the v2 shell — stat strip (Inventory value / Critical SKUs / Below cover / Reserved); **Stock by location** echelon bars (Central · Line-side · Field edge caches · Finished goods, with the legend); **Critical parts · cover vs build schedule** table (Part · On hand · Reserved · Days of cover bar · Status); **Field edge caches** (Osaka = Replenish) + **Returns & RMA** (deferred card); the dark **inv-orchestrator trace**.
- [ ] SERVO-204 = **Reorder** (ink) with "→ PO-… · Procurement"; LOT-88421 = **Quarantine** (dimmed row); Osaka = **Replenish** (ink). Healthy/Stocked in green; nothing red. Inventory agents populate the pane.
- [ ] accessibility-review 0.

**Notes / data-shape flags**
- Read-only module screen bound to INV.1 `getInventoryData` + the latest inventory `AgentRun` trace (replayed via TraceConsole). Reorder is Procurement's gated write; transfer/RMA are agent-drafted (`/// RBAC.4` + `/// AUDIT.3`).
- **Deviations from the mock (data-honest):**
  1. **Returns & RMA** — the mock shows a 4-stage pipeline (“14 open”); there's no returns model (INV.1 deferred), so the card renders a **labelled deferred state**, not fabricated numbers.
  2. **Count accuracy** stat (mock's 4th) isn't modeled (no cycle-count data) → replaced with the real **Reserved** total; count-accuracy stays deferred.
  3. **Days of cover** is the labelled **stand-in** (`onHand ÷ Part.dailyUse`) from INV.1; the bar/labels read in days, not the mock's mixed "builds/days".
  4. Real rollup numbers differ from the mock's illustrative ones ($3.7M vs $18.4M, 7 SKUs vs 312) — real seeded data.

---

## FILE.1 — S3/MinIO blob store + File lifecycle

**Automated**
- `pnpm verify:file-1` — storage client (put/get/presign/delete, path-style, @aws-sdk/client-s3); upload requireRole line 1 + org-scoped (project→orgId) + **org-prefixed key** + File.create; FILE.2 seam (extracted untouched); download org-scoped via project.orgId join; delete RBAC-gated (ADMIN) + soft-delete flagged; getProjectFiles joins project.orgId. **Live (S3+DB-gated, self-cleaning):** put→get roundtrip; File record + getProjectFiles; cross-org read blocked; seeded blobs backfilled.
- **CI has no MinIO** — the live checks SKIP when `S3_ENDPOINT` unset; static checks always run. `verify:all` green without MinIO. `migrate status` clean (no schema change).

**Manual (docker compose up -d, MinIO on :9000)**
- `pnpm db:seed && pnpm db:seed:blobs` — backfills placeholder objects for every seeded File (idempotent).
- Upload: `curl -X POST localhost:3001/api/projects/<id>/files -F file=@x.txt -F type=Data` → 201 + File record; the MinIO object lands at `orgId/projectId/uuid.ext`.
- Download: `curl localhost:3001/api/files/<fileId>/content` → the bytes. `GET /api/projects/<id>/files` lists them.
- Verified end-to-end: upload → 201 + record + MinIO object (org-prefixed key); download → exact bytes.

**Notes / flags**
- New `apps/web/lib/storage.ts` over `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (added to apps/web deps); `forcePathStyle:true` + `S3_ENDPOINT` for MinIO; server-only. `getProjectFiles(orgId, projectId)` in `lib/projects.ts`.
- **Routes:** `POST /api/projects/:id/files` (upload, requireRole, org-prefixed key, no auto-extract), `GET /api/files/:id/content` (stream bytes, org-scoped), `GET /api/projects/:id/files` (list), `DELETE /api/files/:id` (**ADMIN-gated hard delete** of object + record).
- **No schema change.** File has no `orgId` (tenancy via `project.orgId` — every File read joins on it) and no `deletedAt`.
- **DEFERRED:** (1) **soft-delete** — the delete route hard-deletes; a `File.deletedAt` + filtered reads is preferred but needs a schema change (deferred, flagged in the route). (2) **extract + embed on upload** — FILE.2 (the queue job); `extracted={}`/`embedding` untouched, `/// FILE.2` seam left.

---

## FILE.2 — Text-extraction + embedding pipeline

**Automated**
- `pnpm verify:file-2` — FakeEmbedder 1536-dim L2-normalized + deterministic; extraction decodes txt/md + skips unknown/binary without throwing; **processor sets File.text + File.embedding + SearchDoc(FILE) embedding, idempotent** (no dup doc); **semanticSearch returns the seeded file + blocks cross-org**; **/api/search hybrid returns the Procurement MODULE hit AND a FILE hit**.
- **CI-safe:** live checks SKIP without `DATABASE_URL`/`S3_ENDPOINT`; the pipeline runs with the **FakeEmbedder** (no provider key) and no live MinIO/Redis. `verify:all` green. `migrate status` clean.

**Manual (docker compose up -d)**
- `pnpm db:seed && pnpm db:seed:blobs && pnpm db:embed:backfill` → all 18 seeded files get real text + a 1536-dim embedding + a FILE SearchDoc with its vector.
- Upload a `.txt`/`.md`/`.pdf` via `POST /api/projects/:id/files` → 201; the file is auto-enqueued (`file-extract`) and appears in `/api/search` (FTS + semantic) shortly after.
- Verified: ECO-318 file → `File.text` (338 chars) + embedding; `semanticSearch("ECO-318 drive change")` returns it; `hybrid("procurement")` → MODULE:Procurement + FILE hits.

**Notes / architecture**
- **One bounded schema addition** (via `migrate dev`, never db push): `File.text String?` (extracted plain text; `File.extracted` stays reserved for MTX.1). `File.embedding` written by raw SQL (`$executeRaw … ::vector`). `/// MTX.1` + `/// MEM.1` pointers; `migrate status` clean.
- **Embedder DI** (`@axona/db/embed/embedder.ts`): `Embedder{ embed, dim:1536 }` + deterministic **FakeEmbedder** (hash→L2-normalized, offline/CI default) + **RealEmbedder** (fetch, OpenAI-compatible 1536-dim, behind `EMBED_API_KEY`); `getEmbedder()` picks by env like `AnthropicModelClient` vs `FakeModelClient`.
- **Extraction** (`extract.ts`): txt/md/json/csv/… utf8; pdf→pdf-parse; docx→mammoth; a **UTF-8 text fallback** covers text bytes mislabeled pdf/docx (the FILE.1 seed placeholders) + unknown text; binary skipped; never throws.
- **Processor** (`process.ts`, `FILE_EXTRACT_QUEUE`): org-scoped via project.orgId → getObjectBytes → extract → embed → File.text + File.embedding + upsert SearchDoc(FILE) + its embedding. Idempotent.
- **Trigger:** upload route enqueues `file-extract` (non-blocking; Redis→BullMQ in apps/worker, else in-process); backfill `pnpm db:embed:backfill`.
- **Storage centralized:** the FILE.1 S3 client moved to `@axona/db` (`apps/web/lib/storage.ts` re-exports) so the worker + in-process path + verify share it. Parser + aws-sdk deps live in `@axona/db` (lazy-imported) — a deliberate reconciliation of the PRD's "parser deps in worker" with the no-Redis in-process requirement.
- **semanticSearch activated** + `/api/search` hybrid (FTS ∪ vector, FTS priority). Per-tenant isolation on text + vectors (org-filtered). `/// MEM.1` seam left; no memory graph.
- **Deferred:** per-chunk/multi-vector embeddings (MTX.1/MEM.1); column extraction into `File.extracted` (MTX.1); operational-memory graph (MEM.1).

---

## MTX.1 — Ask-across-files column extraction

**Automated**
- `pnpm verify:mtx-1` (7 checks, PRD §10) — routes exist; POST /columns RBAC-gated + org-scoped + answers never "approved"; **extractColumn → valid ColumnAnswer**, forced failure → low-conf fallback (no throw); **fan-out answers every file under columnId, other columns untouched** (idempotent merge); **empty File.text → low-confidence n/a**; **GET /matrix rows×columns×answers with citations, cross-org empty**; re-run replaces only that column + a **seeded low-confidence flag exists**.
- **CI-safe:** uses the **FakeExtractionModel** (no key); live checks SKIP without `DATABASE_URL`; `verify:all` green. `migrate status` clean (**no schema change**).

**Manual (docker compose up -d)**
- `pnpm db:seed` seeds 3 columns (Cost / spec impact · Agent flag · Owner) on the ECO-318 project with per-file answers + citations + a low-confidence flag (Agent flag on ECO-318 = 0.34; on SERVO-205 spec = 0.15).
- `pnpm db:seed:blobs && pnpm db:embed:backfill` populate File.text so a new column extracts real spans.
- `POST /api/projects/:id/columns { "question": "..." }` → 201 + column; answers fan out async. `GET /api/projects/:id/matrix` → files × columns × answers. `POST …/columns/:columnId/rerun`, `DELETE /api/columns/:id`.

**Notes / architecture**
- **No schema change** — reuses `MatrixColumn` + `File.extracted` (keyed by columnId). `ColumnAnswer = { value, citation, confidence 0-1 }` (Zod) in `@axona/agents/matrix/extract.ts`.
- **`extractColumn(fileText, question, {model})`** — one structured-output call via the ART.1 ModelClient DI: system prompt answers from ONLY the file text, quotes the span, returns `n/a` + low confidence when unaddressed, never invents. try/catch → low-conf fallback per file. **`FakeExtractionModel`** (implements ModelClient) derives a deterministic grounded answer offline; `AnthropicModelClient` when `ANTHROPIC_API_KEY` is set.
- **Fan-out** (`matrix-extract` queue / `runColumnExtraction`): `Promise.allSettled` per file, **idempotent-merge** each answer into `File.extracted[columnId]` (never clobbers other columns); empty text → n/a. Org-scoped via project.orgId. apps/worker consumer + in-process path (no Redis) like FILE.2.
- **Routes:** POST /columns (create + enqueue, returns immediately), /columns/:columnId/rerun, GET /matrix (`lib/matrix.ts` `getProjectMatrix`), DELETE /api/columns/:id (RBAC-gated, removes the column + its `File.extracted` key).
- **Moat:** each cell is an agent-drafted **proposal** with citation + calibrated `confidence` — never marked approved. `/// RBAC.4` (approve) + `/// AUDIT.3` (immutable log) + `/// CONF.1` (calibration) + `/// MEM.1` (learning loop) seams. Never fabricates a source (n/a when unaddressed). Per-tenant isolation throughout.
- **Deferred:** the matrix screen (MTX.2); cross-file/multi-hop reasoning; a FILE.2→MTX.1 auto-hook on future uploads (backfill/re-run provided); approval/audit UIs.

---

## MTX.2 — Project Files matrix screen (the last screen)

**Automated**
- `pnpm verify:mtx-2` — route + component + format; binds the matrix (files×columns×answers) + ask-across-files bar (POST /columns); cells render confidence + citation, low-confidence flagged in **INK** (no red); **PROJ.1 rows link to /projects/:id**; cells never "approved"; matrix binds files × columns × cited answers; a **low-confidence review-flag cell present**; rows carry file metadata (ext/size/modified); cross-org project → empty.
- CI gate green · MTX.1/FILE.2/PROJ.1 + siblings stay green · accessibility-review 0 on /projects/:id.

**Manual (./dev.sh → /projects → click a project)**
- [ ] Matches "Project Files.dc.html" on the v2 shell — breadcrumb (Projects / module) + project name; the **ask-across-files bar** ("Ask a question across all N documents — it becomes a column…" + Add column); the **sticky-header matrix** (Document · Type · Linked to · the AI-extracted columns · Modified). Each extracted cell shows the **value + a confidence dot + the citation** (mono, quoted); a **low-confidence cell shows a "Review" pill in ink** (the two seeded flags: Agent flag on ECO-318 = 0.34, on SERVO-205 spec = 0.15).
- [ ] Type a question → **Add column** → a new column appears in an **extracting…** state, then answers fill in (poll refetch). Global Axona pane present (Core route). accessibility-review 0.

**Notes / data-shape flags**
- Read-only render bound to MTX.1 `getProjectMatrix` (extended with ext/size/modifiedAt for the table). Route `/projects/[id]`; **PROJ.1's /projects rows now Link here** (fixing PROJ.1's deferred flag).
- The ask bar's **Add column** POSTs `/api/projects/:id/columns` (RBAC-gated, `requireRole`) — a normal contributor action; answers are **agent-drafted proposals** (value + citation + confidence), **never "approved"** (`/// RBAC.4` approve UI is a later story). Poll-refetch, no live SSE.
- **Design adaptations (flagged):**
  1. The design's right pane is a bespoke citation-aware project agent; per the story the **global Axona pane (GA.1)** stays (Core route) — same citation-aware role, not a third shell pane.
  2. The design hardcodes "Cost / spec impact" + "Agent flag" columns; our matrix is **dynamic** MatrixColumns (the seed provides exactly those + Owner) rendered uniformly as value + confidence + citation cells.
  3. Real seeded values differ from the mock's illustrative ones (3 files/3 columns vs 8/…); through-line data (ECO-318 set) — not fabricated.

---

## AUDIT.1 — Immutable event log + writer

**Automated**
- `pnpm verify:audit-1` (7 checks, PRD §9) — writeAudit wired at all 4 base sites (po.advance · workflow.run · column.extract · file.upload); migration is append-only (CREATE RULE audit_no_update + audit_no_delete); **writeAudit inserts org-scoped + a forced failure never throws into the caller** (logged, swallowed); **UPDATE and DELETE on a row are no-ops** (the DB rule holds); a **workflow run writes workflow.run with correlationId=runId**; **cross-org read blocked**; the seed spans the through-line targets. Self-cleaning (removes its rows/runs via the admin disable-rule path).
- CI gate green · siblings (incl. verify-wf-1) stay green · `migrate status` clean.

**Manual (docker compose up -d)**
- `pnpm db:seed` seeds ~18 historical entries across NCR-118 → ECO-318 → PO-9001 (agent drafts, the workflow run, PO advances, file uploads, column extractions), spread over the last few days.
- Advance a PO (`/procurement`) / add a matrix column / upload a file → a new AuditLog row appears (`SELECT action, summary FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 5;`).
- Immutability: `UPDATE "AuditLog" SET summary='x' WHERE id=…;` and `DELETE FROM "AuditLog" WHERE id=…;` both report 0 rows — the row is unchanged (the rules make them no-ops).

**Notes / architecture**
- **Model** (`AuditLog`, via `prisma migrate dev`): actorType/actorId/actorLabel · action (dotted verb) · targetType/targetId · summary · inputs/output Json · correlationId · createdAt; `@@index([orgId, createdAt])` + `@@index([targetType, targetId])`. Tenant model (orgId injected by `dbForOrg`; auto-isolated reads). `/// AUDIT.3` (model·confidence·approver) + `/// ONT.1` seams left — no extra columns now.
- **Append-only is enforced twice:** the writer only INSERTs, and the DB carries `audit_no_update` / `audit_no_delete` rules (`DO INSTEAD NOTHING`) — raw SQL in the `audit1` migration + re-asserted idempotently (`CREATE OR REPLACE RULE`) in the ensure-raw-sql migration (MIGRATE.1). `migrate status` clean; FTS/pgvector intact.
- **`writeAudit(db, {orgId, actor, action, target, summary, inputs?, output?, correlationId?})`** (`@axona/db/audit.ts`, re-exported at `apps/web/lib/audit.ts`) — the ONLY writer; org-scoped; try/catch so a logging failure never rolls back the business mutation (logged to console). Core in the db package so apps/worker (the WF.1 executor) shares it.
- **Wired (one line each, no restructuring):** PO advance (`procurement/actions.ts`, replaced the AUDIT.3 seam), the WF.1 executor (`runWorkflow` wraps the DAG walk, correlationId=runId), the MTX.1 fan-out job, the FILE.1 upload route.
- **Seed cleanup:** the append-only rule blocks the seed's own tenant DELETE, so `clearDemoOrg` briefly disables `audit_no_delete` (an admin/DDL path the app never has), clears this tenant's rows, re-enables — keeping the reseed idempotent while immutability holds for the app.
- **Deferred:** model·confidence·approver enrichment (AUDIT.3); the approval state machine (RBAC.4); the audit-trail viewer screen (AUDIT.2); the ontology event log (ONT.1).

---

## RBAC.4 — Approval state machine for gated actions

**Automated**
- `pnpm verify:rbac-4` (6 checks, PRD §8) — PO advance/reject go through `decide()` (no ad-hoc mutation); PoRow + workflow detail wire the primitive; **VIEWER forbidden + no state change, OPS approve → APPROVED→SENT with an audited approver**; **reject → REJECTED + audited, a second decide is "already decided"**; **cross-org decide blocked**; **workflow.gate approve resumes a parked run (leaves AWAITING_APPROVAL, trace gains "approved by") + audits**. Self-cleaning (restores the PO status, deletes its runs + audit rows).
- CI gate green · siblings (verify-audit-1, verify-wf-1, verify-proc-2 updated for the refactor) stay green · `migrate status` clean.

**Manual (./dev.sh)**
- `/procurement`: a PO at *Awaiting approval* shows **Approve** + **Reject** (OPS/ADMIN only). Approve → *Approved* → *Sent*; Reject → *Rejected* (ink pill). Each decision appends an AuditLog row (`SELECT action, summary, "actorLabel" FROM "AuditLog" WHERE action LIKE 'po.approve.%' ORDER BY "createdAt" DESC;`).
- `/workflows/:id`: run the procurement workflow → it parks *AWAITING_APPROVAL*. **Approve & resume** → the run console refetches and shows the appended `approved by <user> — resuming past the guardrail gate` + `workflow complete` trace, status SUCCEEDED. Reject → FAILED + `rejected by <user>`. Buttons role-gated (`workflow.gate` roles); enforced server-side.

**Notes / architecture**
- **The primitive** (`apps/web/lib/approvals.ts`): an `ApprovalDef` registry keyed by kind (`po.approve` · `workflow.gate` · `eco.release` · `policy.rollback` · `creditnote.issue`), each declaring `roles` · `load` (org-scoped) · `isPending` · `onApprove`/`onReject` effect. **`decide(kind, targetId, "APPROVE"|"REJECT", user)`**: `requireRole(def.roles)` FIRST → org-scoped load → assert `isPending` → run the effect → `writeAudit({ action: \`${kind}.${decision}\`, actor: HUMAN(user), target, output, summary })`. Idempotent: a non-pending target → `{ok:false, reason:"already_decided"}`, never a double-execute.
- **Ships two kinds fully:** `po.approve` (DRAFTED→AWAITING_APPROVAL→APPROVED→SENT one step per approve; reject → REJECTED; OPS/ADMIN) and `workflow.gate` (resume the parked WF.1 run via the executor's `resumeParkedRun` — reuses the trace/persist primitives, doesn't fork the engine; APPROVE→SUCCEEDED, REJECT→FAILED, with a decision trace line). `eco.release`/`policy.rollback`/`creditnote.issue` registered (effects wired; UI is a fan-out follow-up).
- **PO advance refactored** onto `decide()` — `procurement/actions.ts` has no ad-hoc mutation left; `advancePurchaseOrder`/`rejectPurchaseOrder` delegate to the primitive.
- **Schema:** one bounded enum value `POStatus.REJECTED` (via `prisma migrate dev` — the only non-forward PO state; none of the existing values meant "rejected"). `migrate status` clean; FTS/pgvector intact.
- **UI:** PoRow adds a Reject button + a Rejected pill (ink, never a warning color); WorkflowDetailView adds Approve/Reject on a parked run (POST `/api/approvals` → refetch). Role-gated via `hasRole` (UI) + `requireRole` (server, in `decide`).
- **Moat:** never auto-execute a gated action (no auto path); every decision audited (AUDIT.1); org isolation on load + mutate; VIEWER can never approve. `/// TRUST.1` + `/// CONF.1` seams left (confidence-gated auto-approval is later).
- **Deferred:** confidence-gated/progressive-trust auto-approval (TRUST.1/CONF.1); model·confidence·approver audit columns (AUDIT.3); ECO/policy/credit-note UI wiring; approval notifications (NOTIF.*).

---

## UX.3 — Land on the Command Center at /

**Automated**
- `pnpm verify:ux-3` (5 static checks) — `"/"` redirects to `/core` (no launcher render at root); `/core` renders the Command Center; `/launcher` renders the launcher (full-screen, outside the (shell) group); the sidebar wordmark + search both reach `/launcher`; **no dangling `"/"`-as-launcher link** remains (root redirect excepted).
- accessibility-review = 0 on `/core` + `/launcher`.

**Manual (./dev.sh)**
- Open `/` → lands on the **Command Center** (`/core`, with the shell). The dark **Mission Control** launcher is at `/launcher` — reached by clicking the **axona wordmark** (top-left) or the sidebar **Search** bar.

**Notes** — pure routing/UX; no data/schema change. `app/page.tsx` now `redirect("/core")`; the launcher moved verbatim to `app/launcher/page.tsx` (same `Launcher` component + `getNavModules`/`getModuleAlerts` data). Internal "Mission Control" back-link (`[module]/page.tsx`) + the sidebar search + wordmark repointed to `/launcher`.

---

## AUDIT.3 — Record model · confidence · approver on the audit log

**Automated**
- `pnpm verify:audit-3` — schema has `model/confidence/approverId/approverLabel` (+ CONF.1 seam); `writeAudit` persists them; the migration adds the 4 columns (via `migrate dev`); **an agent entry (workflow.run) carries non-null model + confidence + no approver**; **an approval entry carries a non-null approver + null model/confidence**; **append-only preserved** (UPDATE/DELETE no-op on an enriched row). Self-cleaning.
- CI gate green; siblings (verify-audit-1, verify-rbac-4) stay green; `migrate status` clean.

**Notes / architecture**
- **Schema:** 4 nullable columns on `AuditLog` via `prisma migrate dev` — `model String?`, `confidence Float?`, `approverId String?`, `approverLabel String?`. Historical rows keep null. `/// CONF.1` seam: `confidence` is what the agent **emitted** (uncalibrated); calibration + the autonomy gate are CONF.1. Append-only rules (AUDIT.1) + FTS/pgvector intact; `migrate status` clean.
- **`writeAudit`** extended with optional `{ model, confidence, approver }` — no new call sites, no restructuring:
  - `workflow.run` (executor): `model` = the ModelClient id (Anthropic model or `fake-model`), `confidence` = mean of trace-line confidences else an outcome nominal (SUCCEEDED 0.9 / AWAITING_APPROVAL 0.5 / FAILED 0.2).
  - `column.extract` (matrix job): `model` = the extraction model id, `confidence` = mean emitted cell confidence.
  - `po.approve.*` / `workflow.gate.*` (RBAC.4 `decide`): `approver = { id, label }` of the deciding user; model/confidence null.
- **Deferred:** confidence **calibration** + confidence-gated autonomy (CONF.1/TRUST.1); the ontology event log (ONT.1).

---

## AUDIT.2 — Audit-trail viewer (Governance)

**Automated**
- `pnpm verify:audit-2` — route + screen + read model + API exist; **read-only** (GET-only route, no `auditLog` mutation in the lib, no edit/delete UI); sidebar links `/audit`; low-confidence flagged in **INK** (no red); **paginates** (disjoint next page); **filters** by actor/action/targetType; **agent entries expose model+confidence, approvals expose approver**; a **low-confidence entry is flagged**; **targets deep-link where derivable** (PurchaseOrder→/procurement, WorkflowRun→/workflows/:id, MatrixColumn/File→/projects/:id; ECO/NCR/Org→plain text); rollup counts; **cross-org empty**.
- CI gate green; siblings (audit-1/audit-3/rbac-4) stay green; accessibility-review 0 on /audit.

**Manual (./dev.sh → sidebar → Audit trail, or /audit)**
- The **StatStrip** (Entries · Agent actions · Human decisions · Approvals · Flagged·low-conf) + a hairline table (Time · Actor · Action · Target · Confidence · Approver · Summary), newest first, **Load more** paginated.
- Agent entries show model + confidence; a **low-confidence cell (< 0.4) shows an ink "Review" pill** (the seeded compat-check @ 0.31). Approval entries show the approver (+ a functional-green dot for approved outcomes). Filter chips (Actor/Action/Target) narrow the trail; deep-linked targets open their source screen. Header badge: **Append-only · read-only** — the log can't be edited (AUDIT.1 rules); the UI offers no edit/delete.

**Notes / architecture**
- **Read model** (`lib/audit-trail.ts`): `getAuditTrail(orgId, {actor,action,targetType,cursor,take})` (org-scoped, newest-first, cursor-paginated), `getAuditRollup`, `getAuditFilterOptions`; `resolveHrefs` batch-resolves deep-links (WorkflowRun→its workflowId; MatrixColumn/File→their projectId). `GET /api/audit` (org-scoped, read-only). No write path anywhere.
- **Screen** (`/audit`): DS.1 primitives — shared `StatStrip` + a brand-matched hairline table (no v2 `.dc.html` for this surface). Cross-cutting route → moduleKey "audit" has no agents → the **global Axona pane** shows automatically. Sidebar "Audit trail" link (Governance — a static entry, not a value-chain module).
- **Seed enrichment (flagged):** AUDIT.1's seeded rows predated AUDIT.3's columns, so `seed/audit.ts` now derives model+confidence for agent entries and approver for human-decision entries, with one explicit low-confidence entry (compat.check @ 0.31) — so the trail renders fully populated (2 flagged, 5 approvals). Not fabricated activity — the same rows, enriched with the fields real runs now emit.
- **Deferred:** a ⌘K palette entry (no command palette exists yet — search routes to /launcher; flagged, not built); a dedicated screen for ECO/NCR targets (rendered as plain text until those screens land).

---

## UX.4 — Module screens scroll as one page; nothing vertically cropped

**Automated**
- `pnpm verify:ux-4` (6 checks) — the shared **ScreenShell** scaffold exists (min-h-full container, sticky 60px header, `pb-16` bottom padding, no `overflow-y-auto`/`h-full` viewport-cap on the body); **no module screen keeps the old `flex h-full flex-col bg-panel` viewport-lock**; **no nested full-height `overflow-y-auto` body wrapper** remains; ScreenShell adopted across ≥ 18 screens incl. /audit; Command Center scrolls (min-h-full, sticky header, no overflow-hidden grid cap); StatStrip + TraceConsole still the flowing first/last children.
- CI gate green; siblings (verify-ux-1/2/3, verify-audit-2, …) stay green; accessibility-review 0 on the touched screens.

**Manual (./dev.sh — resize the window short, e.g. ~720px tall)**
- Any module screen (/fleet, /autonomy, /security, /field-service, /audit, /core, …) scrolls as **one page**: the 60px topbar **stays pinned**, and the lower panels (Live units, Vulnerabilities, Safety incidents, …) **and the full agent trace** are reachable by scrolling — none cropped. Bottom padding keeps the last panel off the viewport edge.

**Notes / architecture**
- **Root cause:** every View was `<div className="flex h-full flex-col">` (viewport-locked) with a nested `overflow-y-auto` body inside the shell's `<main>` (which also scrolls). The double-scroll, both capped to the viewport, trapped lower content — `main.scrollHeight === clientHeight` (page couldn't scroll). Verified before/after: `mainScrolls: false → true` on /security, /autonomy, /fleet, /audit, /core.
- **Fix:** extracted **`components/shell/ScreenShell.tsx`** — `min-h-full` container that GROWS with content, a **`sticky top-0` 60px header** (topbar stays put), and a naturally-flowing body (`px-6 pt-[22px] pb-16 gap-[18px]`, no `flex-1`/`min-h-0`/`overflow-y-auto` cap). The shell's `<main>` is the single scroll container. `ScreenMessage` replaces the old centered `flex-1` empty/error states.
- **Adopted across all screens:** Security, Fleet, Autonomy, Finance, Field Service, Legal, Quality, Sales, Marketing, Procurement, People, Manufacturing, Fulfillment, Engineering, Inventory, Projects, Workflows (list), Workflow detail, Matrix, and /audit. Command Center fixed in-place (2-col dashboard: `min-h-full` + sticky header, removed the `overflow-hidden` grid cap + per-column `overflow-y-auto`).
- **Legitimate inner scrolls kept:** the /audit table and the /projects/:id file matrix keep their **horizontal** scroll (`overflow-x-auto`) for wide/dynamic columns while flowing vertically with the page; their column headers pin under the topbar. Panel/board/chart/map artifacts inside child components (dispatch board, SPC chart, compat matrix, delivery pipeline, telemetry) keep their own scroll untouched.

---

## RBAC.5 — Approvals fan-out: ECO release · policy rollback · credit note

**Automated**
- `pnpm verify:rbac-5` (8 checks) — the three surfaces wire to `decide()` (`eco.release` · `policy.rollback` · `creditnote.issue`); **Autonomy rollback goes exclusively through decide (no ad-hoc mutation)**; **VIEWER forbidden** on eco.release (no state change); **ENGINEER→ECO RELEASED**, **TECH→policy standby**, **FINANCE→invoice credited**, each with an **audited approver**; **cross-org decide blocked**; the new decisions **surface on /audit** (getAuditTrail, with approver). Self-cleaning.
- CI gate green; siblings (rbac-4, audit-1/2/3, eng-2/auto-2/fin-2 updated for the refactor) stay green; accessibility-review 0 on /engineering, /autonomy, /finance.

**Manual (./dev.sh)**
- **/engineering:** an ECO at *Review*/*Approved* (e.g. ECO-318) shows **Approve release** + **Reject** (ENGINEER/ADMIN) → decide("eco.release") → the ECO moves to *Released*. A DRAFT ECO shows *Submit* (→ Review).
- **/autonomy:** the *p-13* canary (Site-3 regression) shows **Approve rollback** + **Reject** (TECH/ADMIN) → decide("policy.rollback") → *Standby*.
- **/finance → Receivables:** an open invoice shows **Issue credit note** (FINANCE/ADMIN) → decide("creditnote.issue") → the invoice renders a green *Credited* pill.
- Each decision appends an AuditLog row and appears on **/audit** with the approver (`SELECT action, "approverLabel" FROM "AuditLog" WHERE action LIKE '%.approve' ORDER BY "createdAt" DESC;`).

**Notes / architecture**
- **No new approval logic** — pure UI wiring over the existing `decide()` primitive + the registered `eco.release`/`policy.rollback`/`creditnote.issue` effects (untouched). Server actions delegate to `decide()` (like PROC.2/RBAC.4): `approveEcoRelease`/`rejectEcoRelease`, `approvePolicyRollback`/`rejectPolicyRollback`, `issueCreditNote`. Role gates in the UI via `hasRole(approvalRoles(kind))`; enforced server-side by `decide` (requireRole line 1).
- **Refactors (no ad-hoc path left):** Autonomy's `advancePolicy(promote|rollback)` → removed; the rollback now goes through `decide("policy.rollback")`. Engineering's `advanceEco` trimmed to the DRAFT→REVIEW *submit* step; the gated RELEASE is decide-only.
- **Finance credit-note wired (not deferred):** the registry's `creditnote.issue` targets the `Invoice` (status → "credited"); the Receivables/AR panel already renders invoices, so the credit-note issuance is a natural fit — an open receivable is the pending item.
- **No seed change needed:** the through-line already provides the pending items — ECO-318 (REVIEW), p-13 (canary · Site-3 regression), open invoices (INV-77xx). Each screen renders a real Approve/Reject.
- **Deferred (flagged):** `policy.promote` (roll a healthy canary forward to *current*) — a future gated kind, out of RBAC.5's "no new approval logic" scope. `/// TRUST.1` + `/// CONF.1` seams left in the registry (confidence-gated auto-approval later).

---

## UX.5 — Two UI bugs (audit sticky-header bleed · procurement column misalignment)

**Automated**
- `pnpm verify:ux-5` (7 checks) — audit table region is NOT an overflow scroll container (won't trap the sticky header); the column header is `sticky top-[60px]` with a raised z-index + opaque bg; no fixed min-width (responsive `minmax` columns); the ScreenShell topbar is `sticky top-0 z-20 bg-paper` (covers 0→60 above the pinned header); PoRow reserves a **fixed-width** actions column (not `auto`); the PO header uses the identical template; no invented reds/emoji.
- CI gate green; verify:all green (UX.4 scroll not regressed; RBAC.4/5 approve wiring intact); accessibility-review 0 on /audit + /procurement.

**Manual**
- **/audit** — scroll the page: the column header (Time · Actor · … · Summary) **stays pinned** just under the 60px topbar at every scroll offset; **no data row renders above or through it**.
- **/procurement** — the *Awaiting approval* PO (PO-9007, with Reject/Approve) has **PO · Item · Vendor · Value · Status aligned** vertically with the rows above; the buttons occupy the reserved actions column.

**Notes / root cause**
- **BUG 1:** the audit table region had `overflow-x-auto`. Per CSS, `overflow-x:auto` computes `overflow-y` to `auto`, making the region a scroll container — so the column header's `position:sticky; top:60px` was relative to the (non-scrolling, page-flowing) region, not `<main>`, and it **scrolled away** instead of pinning (a data row then sat directly under the topbar). Fix: the region simply flows (no overflow), the columns are responsive `minmax` (so no horizontal scroll is needed — no scroll container), the header is `sticky top-[60px] z-[15]` with an opaque `bg-panel`, and the ScreenShell topbar (`z-20`, opaque) covers 0→60. Header pins cleanly at every offset. UX.4 vertical page-scroll unaffected.
- **BUG 2:** `PoRow` used `grid-cols-[…_auto]`. The `auto` actions column sized to content, so rows WITH Approve/Reject buttons consumed width there and their `fr` data columns computed narrower/shifted; rows WITHOUT buttons didn't. Fix: one shared template (`PO_HEADER_COLS = COLS`) with a **fixed `160px`** actions column reserved on every row (empty when there are no buttons) — the `fr` columns now compute identically everywhere. fr ratios match `Procurement.dc.html` (`0.8 2.2 1 0.9 1.15`).
- Pure UI; no data/logic change; v2 tokens only.

---

## AUTH.1 — Real authentication (Auth.js email/password + session + protected routes)

**Dev login credentials** (seeded; dev-only — never a real secret): every role user shares the password **`axona-dev-2026!`**. Emails: `admin@axona-demo.test` (default), `ops@…`, `engineer@…`, `sales@…`, `finance@…`, `tech@…`, `viewer@…` (all `@axona-demo.test`). The plaintext lives ONLY here; the seed stores its bcrypt hash.

**Automated**
- `pnpm verify:auth-1` (10 checks) — `User.passwordHash` (nullable) + committed migration; Credentials provider verifies via bcryptjs; session carries orgId+role; **passwordHash never enters the return/token/session**; `getCurrentUser` reads the Auth.js session; middleware protects app routes (`/login` + `/api/auth/*` public, unauth → `/login?next=`); AUTH_SECRET documented; **all 7 users have a hash**; authorize **accepts correct** + **rejects wrong password / unknown email**; a **VIEWER** authenticates (RBAC now runs on the real role).
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles** (middleware + auth routes are build-sensitive — added to CI). CI provides a dummy `AUTH_SECRET`. migrate status clean.

**Manual (./dev.sh — real auth is on)**
- Any deep link while logged out → **`/login?next=<path>`** (verified: `/procurement` → `/login?next=%2Fprocurement`). `/login` + `/api/auth/*` stay public.
- Log in as `admin@axona-demo.test` / `axona-dev-2026!` → lands on the **Command Center** (`/`→`/core`); the sidebar footer shows **Dana Reyes · Admin** + a sign-out button.
- Wrong password → stays on `/login` with the **ink inline error** ("That email or password doesn't match.").
- Log in as `viewer@axona-demo.test` → approve/reject buttons are gated (VIEWER can't mutate — `decide()`/`requireRole` reject server-side). **Sign out** (sidebar) → `/login`.

**Notes / architecture**
- **Auth.js v5** (`next-auth@5-beta`) + `bcryptjs` (pure-JS — no native build in CI). Split config: `auth.config.ts` (EDGE-SAFE — no prisma/bcrypt; `authorized` redirect logic + jwt/session callbacks) used by `middleware.ts`; `auth.ts` (Node) adds the Credentials provider → `verifyCredentials` (shared `lib/credentials.ts`). Route handler at `app/api/auth/[...nextauth]`. JWT session strategy; `AUTH_SECRET` in `.env.example`.
- **`getCurrentUser`** now reads `auth()` and returns the SAME shape `{ id, orgId, role, name, email }` (or null) — the shell, screens, `dbForOrg`, `requireRole` are unchanged. The session's **`orgId` is the tenant boundary** (from the signed JWT, never the client). **RBAC is now real** — a VIEWER can't approve.
- **Login screen** `/login` (full-screen, outside the shell) 1:1 to `Login.dc.html` on v2 tokens; error state in ink (no red); **SSO button present but disabled** (AUTH.2); **Forgot password?** stubbed (AUTH.7); **Create a workspace** → `/signup` (AUTH.4). Sign-out from the sidebar footer.
- **Schema:** one bounded add `User.passwordHash String?` via `migrate dev`. `passwordHash` never returned/logged.
- **Scoped out (their stories):** SSO (AUTH.2), signup+provisioning (AUTH.4), invite (AUTH.5), reset/verify (AUTH.7), new-user→onboarding routing (AUTH.3/6), rate-limiting/lockout/2FA (future hardening).

---

## AUTH.4 — Signup + org provisioning

**Automated**
- `pnpm verify:auth-4` (9 checks) — Org.slug (unique) + industry + migration; signup action provisions + auto sign-in + redirect (server-only); /signup + /onboarding routes, /signup public; password **bcrypt-hashed + Zod-validated, no plaintext store**; **createWorkspace → Org + ADMIN whose hash verifies**; **duplicate email → clean field error, no new Org/User**; **slug collision → unique suffix (-2)**; **isolation: new org empty + cannot read the demo org's data**; Zod rejects weak password / bad email / empty org name. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles** (/signup route + action). migrate status clean.

**Manual (./dev.sh — logged out)**
- `/signup` (reachable while logged out) → fill Full name · Work email · Password (≥ 8) · Organization name (the **Workspace URL** auto-suggests a slug, editable) · Vertical → **Create workspace** → auto signed-in → **/onboarding → /core** (Command Center) in a **brand-new empty org** (nav populated from global modules; every screen shows its empty state — no demo data).
- Sign up again with an existing email → inline ink error "An account with this email already exists — log in instead." (no 500).
- A second signup makes a **separate isolated org** (different slug); it can't see the first org's data.

**Notes / architecture**
- **Schema:** `Org.slug String? @unique` + `Org.industry String?` via `migrate dev`. **Flagged deviation from the PRD's `slug String @unique`:** made it **nullable-unique** because a non-null unique column on a table with existing rows needs a backfill — nullable-unique still enforces uniqueness on real values, and the seed sets slugs for the demo (`axona-demo-co`) + second (`isolation-test-co`) orgs, so every real org has one.
- **Provisioning core** (`lib/provisioning.ts`, server-only, shared by the action + verify): Zod `signupSchema` (name/orgName non-empty, valid email, password ≥ 8, industry ∈ VERTICALS), email-uniqueness → clean field error, `slugify` + `uniqueSlug` (auto-suffix), one `$transaction` creating Org + first ADMIN (`bcrypt.hash`), never stores plaintext. Duplicate-email is a structured result, never a 500 (race also caught).
- **Action** (`app/signup/actions.ts`): `useActionState` server action → `provisionWorkspace` → `signIn("credentials", { redirectTo: "/onboarding" })`. `/onboarding` is a thin redirect to `/core` until **AUTH.6** (flagged `/// AUTH.6`).
- **Screen** `/signup` 1:1 to `Signup.dc.html` (full-screen, dotted-grid, account + workspace groups, live slug, "Free while in pilot · no card required", link to /login). Ink error banner, no invented reds, Lucide icons.
- **Empty-org reality (flagged):** a new org has NO per-org agents/POs/projects — modules are global so nav populates; screens render their empty states. **Not fabricated** — default per-org agent/module provisioning is deferred (SET.1 / provisioning story); the demo org's data is never copied.
- **Security:** public but hardened (Zod + bcrypt, no plaintext/logs); new session `orgId` = the new Org; creator is **ADMIN of their own org only**; no path to read/join another org (joining = AUTH.5). **Deferred (flagged):** rate-limiting/anti-abuse, email verification (AUTH.7), SSO signup (AUTH.2), onboarding wizard (AUTH.6), plan selection (BILL.*).

---

## AUTH.6 — Onboarding wizard (+ AUTH.3 routing)

**Dev note:** the demo org is pre-onboarded (`onboardedAt` set, `enabledModules=[]` ⇒ all), so demo logins skip the wizard. A fresh signup (AUTH.4) is a not-yet-onboarded ADMIN → routed to the wizard.

**Automated**
- `pnpm verify:auth-6` (9 checks) — Org.onboardedAt + enabledModules + migration; **finish action ADMIN-gated, writes enabledModules + onboardedAt, redirects /core**; wizard has 3 steps, team is skip-first (no live invites, AUTH.5 flagged); nav filter + routing server-side; **finish sets onboardedAt + writes chosen modules, re-visit → /core**; **routing (fresh ADMIN → /onboarding, onboarded → /core, non-ADMIN → /core)**; **getNavModules only-enabled (ALL when empty — demo unaffected)**; isModuleEnabled (disabled false, core always, empty ⇒ all); finish ADMIN-gated + org-scoped (VIEWER rejected, own-org only). Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles** (middleware header + /onboarding). migrate status clean.

**Manual (./dev.sh)**
- Sign up (AUTH.4) → land on the **3-step wizard**: **Step 1 Profile** (org name/vertical, prefilled) → Continue; **Step 2 Team** (repeatable email+role rows, prominent **Skip for now** — collect only, no live invites) → Continue/Skip; **Step 3 Modules** (24 modules as toggle tiles grouped Core/Value chain/Robotics/Back office, lime when on, sensible defaults) → **Finish → Command Center**.
- After finishing, a **module toggled off is hidden from the sidebar**; hitting its route directly shows a graceful **"module not enabled"** state with a link back to /core (never 500). Re-visiting `/onboarding` for the now-onboarded org → `/core`.
- **Demo login** (`admin@axona-demo.test`) **skips onboarding** (goes straight to /core, all modules visible).

**Notes / architecture**
- **Schema:** `Org.onboardedAt DateTime?` (routing flag) + `Org.enabledModules String[]` (empty ⇒ ALL — back-compat) via `migrate dev`. `migrate status` clean; FTS intact.
- **Wizard** (`/onboarding`, 1:1 to `Onboarding.dc.html`): full-screen stepper; `OnboardingWizard` client + server actions (`saveProfile`, `finishOnboarding`) **ADMIN-gated** (`requireRole`) + **org-scoped** (`dbForOrg`, only the acting user's own Org). `/onboarding` page guards: not-ADMIN or already-onboarded → `/core`.
- **AUTH.3 routing** (server-side, in `(shell)/layout.tsx`): a not-yet-onboarded org's ADMIN → `/onboarding`; everyone else stays on `/core`. Not client-side.
- **Nav enablement:** `getNavModules(enabledModules)` filters the sidebar; the layout gates a disabled module's route via a **middleware-injected `x-pathname` header** → renders `ModuleNotEnabled` (no 500). `core` is always enabled.
- **Flags:** Step 2 invites are **collect-only** — real invite send/accept is **AUTH.5**. Enablement editing later reuses `enabledModules` (**SET.1**). Default per-org agent/data provisioning still deferred (a new org stays empty).

---

## AUTH.5 — Invite + accept-invite (join an existing org)

**Automated**
- `pnpm verify:auth-5` (7 checks) — Invite model + InviteStatus + token-unique + migration; createInvites ADMIN-gated + accept creates a user at **exactly invite.role** (never escalated), joins **invite.orgId only**, single-use (ACCEPTED), bcrypt, crypto-random 32B token; accept screen + action + /invite/* public; **createInvites → PENDING + ~7d expiry + unique token, existing/dup skipped (batch not aborted)**; **accept valid → user at invited role (bcrypt verifies), ACCEPTED, not reusable**; **expired/revoked → invalid, no user**; **isolation (accepted user in inviting org only, role exact, no cross-org leak)**. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles** (/invite/[token] route + actions). migrate status clean.

**Manual (./dev.sh)**
- As an org ADMIN (e.g. via the onboarding **Team** step, or after onboarding), add a teammate email + role → invites are created; **copyable links** appear (email delivery is EMAIL.1). Copy the `/invite/:token` link.
- Open the link in a private window (logged out) → the accept screen: "**{inviter}** invited you to join **{Org}** on Axona", the **role pill**, Your name · Email (locked) · Set password → **Join {Org}** → auto signed-in → **/core** as the invited role (e.g. OPS — approve buttons gated per OPS). The invitee **skips onboarding** (org already onboarded).
- Re-open the same link (or an expired/revoked one) → clean **"This invite is no longer valid."** state with a link to log in.

**Notes / architecture**
- **Schema:** `Invite { orgId, email(lowercased), role, token @unique, status PENDING/ACCEPTED/REVOKED/EXPIRED, invitedById, invitedByLabel, createdAt, expiresAt(now+7d), acceptedAt }` + indexes, via `migrate dev`. Invite is **not** a TENANT_MODEL (the accept flow reads by token pre-auth, deriving orgId from the invite) — create/list/revoke scope orgId explicitly.
- **`lib/invites.ts`** (server-only, shared by actions + verify): `createInvites` (Zod + lowercase, per-row skip for existing-user / already-PENDING, **crypto `randomBytes(32).base64url`** token, 7d expiry, returns `${APP_URL}/invite/:token` links); `listInvites` (PENDING); `revokeInvite`; `loadInvite` (public, valid-PENDING-unexpired only); `acceptInvite` (**one race-safe txn**: re-check PENDING+unexpired → reject if email now a User → create User at **exactly invite.role** in **invite.orgId** → mark ACCEPTED).
- **Actions:** `createInvitesAction`/`revokeInviteAction` (ADMIN-gated, own-org); `acceptInviteAction` (public → accept + auto sign-in → /core). **AUTH.6 team step wired** to `createInvitesAction` (replaced the collect-only seam) — filled rows create real invites; step 3 shows the copyable links + skip notices.
- **Accept screen** `/invite/:token` 1:1 to `Accept Invite.dc.html` (inviter→org glyphs, heading, role pill, name/email-locked/password, Join). Invalid/revoked/accepted/expired → clean "no longer valid" state.
- **Security:** token unguessable (32B) + single-use + 7d expiry; invitee gets **exactly the invited role** (never ADMIN unless invited ADMIN); one invite binds one orgId (no cross-org); email uniqueness respected (no takeover); bcrypt, no plaintext/logs. **`APP_URL`** in `.env.example`.
- **Flags/deferred:** email delivery (**EMAIL.1** — link copied for now); full members & roles admin screen (**SET.2**); role change/deactivation (**SET.2**); SSO join (**AUTH.2**).

---

## SET.2 — Members & roles administration

**Automated**
- `pnpm verify:set-2` (9 checks) — User.deactivatedAt/lastSeenAt + migration; every members action is `requireRole(["ADMIN"])` line 1 + writes an audit (member.invite/role_change/deactivate/reactivate/invite_revoke); **verifyCredentials rejects a deactivated user + stamps lastSeenAt**; settings sub-nav (6) + /settings/members exist; **getMembers → users + PENDING invites + rollup, org-scoped**; **changeRole ADMIN updates+audits, last-ADMIN demotion rejected**; **setActive deactivate blocks login + audits, can't deactivate last-ADMIN/self, reactivate restores**; invite/revoke audited; cross-org member not reachable. Self-cleaning (restores roles/activation, removes its audit rows via disable-rule).
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate status clean. accessibility-review 0 on /settings/members.

**Manual (./dev.sh — as ADMIN admin@axona-demo.test)**
- Sidebar **Settings** → `/settings/members`: the roster (Person · Role · Status · Last active · actions) with the settings sub-nav (Organization · **Members** · Your profile · Notifications · Integrations · Billing; the others show a "coming soon" placeholder). Header shows active/invited/deactivated counts + the role→capability legend.
- **Invite people** → email + role → **Send invite** → a copyable `/invite/:token` link appears (EMAIL.1 delivers later); the invite shows as an **Invited** row.
- **Change role** (inline select) OPS→ENGINEER; **Deactivate** a member (row dims, they can no longer log in); **Reactivate** restores login; **Revoke** a pending invite. All four land in **/audit** with you as the actor/approver.
- **Guards:** demoting/deactivating the **last ADMIN** is rejected with a clear message; you **can't deactivate yourself**.
- Non-ADMIN loads the roster **read-only** (no controls; server rejects writes regardless).

**Notes / architecture**
- **Schema:** `User.deactivatedAt DateTime?` (set = can't log in) + `User.lastSeenAt DateTime?` (stamped on login) via `migrate dev`.
- **Login enforcement:** `verifyCredentials` (AUTH.1) now returns null if `deactivatedAt` is set, and updates `lastSeenAt` on success.
- **Read model** `lib/members.ts`: `getMembers(orgId)` merges Users (ACTIVE/DEACTIVATED) + PENDING invites (AUTH.5 `listInvites`) as INVITED rows + a rollup; `ROLE_CAPABILITIES` static legend.
- **Actions** `(shell)/settings/members/actions.ts`: `inviteMembers` (reuse createInvites), `changeRole` (last-ADMIN guard), `setActive` (last-ADMIN + self guards), `revokeInvite` — all ADMIN-gated (`requireRole` line 1), org-scoped (`dbForOrg`; Invite lookups scoped by orgId explicitly since Invite isn't a tenant model), and audited via `writeAudit` (actor = ADMIN, approver = ADMIN).
- **Screen** `/settings/members` 1:1 to `Settings - Members.dc.html`, in the shell, via a reusable **SettingsShell + SettingsNav** (the other SET.* screens reuse them; unbuilt sections → `SettingsPlaceholder`). Ink for deactivated, functional green for active, no invented reds, Lucide icons, no emoji.
- **Non-module route fix:** `/settings` (+ /audit, /launcher, /search) are exempted from AUTH.6's module-enablement gate (they aren't modules).
- **Flags/deferred:** Org profile/branding (SET.1), Your profile & security (SET.3), Notifications (SET.4), Integrations/SSO/API keys (SET.5), email delivery (EMAIL.1), SCIM (later).

---

## SET.1 — Organization settings

**Automated**
- `pnpm verify:set-1` (9 checks) — Org.logoKey/timezone/fiscalYearStartMonth/defaultMemberRole + migration; org actions ADMIN-gated line 1 + audited (org.profile_change/defaults_change/modules_change); /settings/org + sub-nav points Organization→/settings/org; **Core-stays-on guard**; **getOrgSettings profile+defaults+module grid, org-scoped**; **updateOrgProfile/updateOrgDefaults persist + audit**; **setEnabledModules writes enabledModules (nav reflects) + Core-stays-on + audits**; no cross-org write path. Self-cleaning (restores demo org + removes its org.* audit rows).
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate status clean. accessibility-review 0 on /settings/org.

**Manual (./dev.sh — as ADMIN)**
- Sidebar Settings → **Organization** (`/settings/org`): **Profile** (name · Workspace URL read-only · industry), **Branding** (locked lime accent), **Defaults** (timezone · fiscal-year start · default member role), and the **Modules** toggle table (Module · Group · Enabled).
- Edit the org name → **Save profile**; set timezone/fiscal/default-role → **Save defaults**; toggle a module off → **Save modules** → it **disappears from the sidebar nav**. All three land in **/audit** (org.profile_change / defaults_change / modules_change) with you as actor/approver.
- The default member role prefills the **Members → Invite** role select (SET.2).
- A non-ADMIN sees the page **read-only** (controls disabled; server rejects writes regardless).

**Notes / architecture**
- **Schema:** `Org.logoKey/timezone/fiscalYearStartMonth/defaultMemberRole` (all nullable) via `migrate dev`. `enabledModules` unchanged (reused from AUTH.6).
- **Read model** `lib/org-settings.ts`: `getOrgSettings(orgId)` → profile + slug (read-only) + defaults + the module grid (reuses AUTH.6's `ONBOARDING_GROUPS` so SET.1's module management is identical to onboarding's). `normalizeEnabledModules` keeps `ALWAYS_ON` core → the keep-app-usable guard. `TIMEZONES`/`MONTHS` constants.
- **Actions** `(shell)/settings/org/actions.ts`: `updateOrgProfile` (name/industry), `updateOrgDefaults` (tz/fiscal/role), `setEnabledModules` (nav revalidated) — all ADMIN-gated (`requireRole` line 1), org-scoped (`where: { id: user.orgId }`), Zod-validated, audited.
- **Screen** `/settings/org` 1:1 to `Settings - Organization.dc.html` via the reusable **SettingsShell + SettingsNav**. Ink states, functional green, no invented reds, Lucide icons, no emoji.
- **Flags/deferred:** **logo upload UI deferred** to a follow-up (the `logoKey` column exists; branding accent is locked/non-editable; upload wiring heavier than the design warrants — per PRD allowance). **slug is display-only** (changing it breaks the workspace URL — deferred to a dedicated flow). Other settings: SET.3 (your profile), SET.4 (notifications), SET.5 (integrations), BILL.* (billing).

---

## SET.3 — Your profile & security

**Automated**
- `pnpm verify:set-3` (9 checks) — User.avatarKey/tokenVersion + LoginSession + migration; profile actions own-user + audited (user.profile_change/password_change/signout_all); **getCurrentUser enforces tokenVersion (stateless-JWT revoke)** + login records device; screen exists; **login records a LoginSession + returns tokenVersion**; **changePassword wrong-current rejected, success re-hashes + bumps tokenVersion, stale token invalid**; **signOutEverywhere bumps tokenVersion + clears sessions**; **revokeSession removes an own row (own-user only)**; own-user only (no cross-user). Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate status clean. accessibility-review 0 on /settings/profile.

**Manual (./dev.sh)**
- Sidebar Settings → **Your profile** (`/settings/profile`): **Profile** (name editable · role + email read-only), **Password** (current → new + confirm), **Sessions & devices** (list + Revoke + Sign out everywhere).
- Change your name → **Save profile** (audited user.profile_change).
- **Change password:** enter the wrong current → "Your current password is incorrect."; correct current + new (≥8, matching confirm) → **other sessions are invalidated** (tokenVersion bumped) → audited user.password_change. Logging in elsewhere with the old password fails.
- **Sign out everywhere** → tokenVersion bumped, all device rows cleared, you're returned to /login (audited user.signout_all).
- **Revoke** a non-current device row → it disappears (best-effort; full JWT revoke needs sign-out-everywhere — noted in the copy).

**Notes / architecture**
- **Schema:** `User.avatarKey` (deferred upload), `User.tokenVersion Int @default(0)`, `LoginSession { orgId, userId, device, ip, lastSeenAt, createdAt }` (a TENANT_MODEL) via `migrate dev`.
- **Stateless-JWT revoke:** the JWT carries `tokenVersion` (authorize → jwt → session callbacks). **Enforced in `getCurrentUser`** (the Node session-read boundary every screen/action calls) — a token whose `tokenVersion` ≠ `User.tokenVersion` is treated as logged out. *Flag:* enforced here rather than the edge-safe `session` callback because the check needs a DB read (the middleware can't query Postgres). A password change / sign-out-everywhere bumps the counter → all prior tokens invalid.
- **Login wiring:** `verifyCredentials` now creates a `LoginSession` (device from user-agent, ip from x-forwarded-for, captured in `authorize`) and returns `tokenVersion`.
- **Actions** `(shell)/settings/profile/actions.ts` (own-user only, org-scoped, audited): `updateProfile`, `changePassword` (bcrypt-verify current → re-hash + bump tokenVersion), `signOutEverywhere` (bump + clear rows + signOut), `revokeSession` (delete own row).
- **Screen** `/settings/profile` 1:1 to `Settings - Profile.dc.html` via SettingsShell/SettingsNav. Replaces the SET.2 placeholder.
- **Flags/deferred:** avatar upload UI (column exists), 2FA/passkeys (later), per-session remote revoke is best-effort under stateless JWT (sign-out-everywhere is the reliable control).

---

## BILL.3 — Billing & subscription (+ Plans)

**Scope:** Axona-as-SaaS billing the tenant (distinct from the Finance module). **Stripe deferred (BILL.1/2)** — real data model + screens, charge actions **stubbed (no real charge)**.

**Automated**
- `pnpm verify:bill-3` (7 checks) — Subscription + InvoiceSaaS models + migration; **actions ADMIN-gated + audited + stubbed (charged:false, no stripe/charge path)**; billing + plans screens; **getBilling plan/seats/usage/invoices, seats == active members + pending (reconciles to SET.2), org-scoped**; **changePlan/addSeats update + audit (charged:false)**; getPlans 3 tiers w/ one recommended; cross-org subscription not reachable. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate clean. accessibility-review 0 on /settings/billing + /settings/billing/plans.

**Manual (./dev.sh — as ADMIN)**
- Sidebar Settings → **Billing** (`/settings/billing`): **plan strip** (Scale · ACTIVE · renews date · Change plan), **Seats** (7 / 25 used, bar, Add 5 seats), **Usage this cycle** (runs + seats bars · modules enabled), **payment method** (Visa ···· 4242 display · Update payment disabled → BILL.1), **Invoices** table (date · description · amount · Paid=green · PDF). Seats reconcile to the Members roster.
- **Change plan** → `/settings/billing/plans`: 3 tiers (Pilot · **Scale** recommended-lime · Enterprise), Current marked. Switching plan updates locally + audits `billing.plan_change` (**no charge**). **Add 5 seats** audits `billing.seats_add` (no charge). Both appear in /audit; the summary says "no charge — Stripe deferred".
- Non-ADMIN: read-only (no change/add controls; server rejects).

**Notes / architecture**
- **Schema:** `Subscription { orgId @unique, plan (PILOT/SCALE/ENTERPRISE), status, seatsPurchased, trialEndsAt, currentPeriodEnd, paymentSummary }` + `InvoiceSaaS { number, description, amountCents, status (PAID/OPEN/VOID), issuedAt }` (named distinctly from the Finance `Invoice`) — both TENANT_MODELS, via `migrate dev`.
- **Seed:** demo org → Subscription (SCALE/ACTIVE/25 seats, Visa ···· 4242) + 4 paid invoices.
- **Read model** `lib/billing.ts`: `getBilling` (seats = active users + pending invites from getMembers; usage = AgentRun+WorkflowRun this period vs plan limit; modules enabled), `getPlans` (static 3-tier config).
- **Actions** `(shell)/settings/billing/actions.ts` (ADMIN-gated, org-scoped, audited, **STUBBED**): `changePlan`, `addSeats` — update the local Subscription only, every audit records `charged:false`. Axona **never initiates a real charge** here. "Update payment" is a disabled stub.
- **Screens** `/settings/billing` + `/settings/billing/plans` 1:1 to the designs via SettingsShell/SettingsNav.
- **Flags/deferred:** live Stripe checkout/webhooks/charges (BILL.1/2), usage-metering enforcement (BILL.4), dunning (BILL.5).

---

## NOTIF.1 — Notification model + in-app notification center

**Automated**
- `pnpm verify:notif-1` (8 checks) — Notification model + index + migration; notify writer + markRead/markAllRead own-user actions; **a real source wired (ECO review → APPROVAL notify) + /// NOTIF.2 seam**; shell unread badge + screen; **seed populates the feed, getNotifications grouped Today/Earlier + unreadCount, org-scoped**; **notify writes + markRead sets readAt (own + broadcast only)**; **APPROVAL broadcast visible to a member + deep-links**; getUnreadCount matches. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate clean. accessibility-review 0 on /notifications.

**Manual (./dev.sh)**
- Sidebar **Notifications** shows an **unread badge** (5). Click → `/notifications`: a grouped **Today / Earlier** feed (approvals, exceptions, run parks, mentions), each with a type icon, one-line summary, source module · object · relative time, an **unread lime bar/dot**, and a **deep-link** (e.g. PO-9007 → /procurement). Tabs **All · Unread · Approvals**; **Mark all read** clears the unread state + badge.
- Submit an ECO to review on **/engineering** → an **APPROVAL** notification appears (broadcast to approvers) in the feed.

**Notes / architecture**
- **Schema:** `Notification { orgId, userId? (null=broadcast), type (APPROVAL/EXCEPTION/RUN/MENTION/SYSTEM), title, body, targetType, targetId, url, readAt }` + `@@index([orgId, userId, createdAt])`, a TENANT_MODEL, via `migrate dev`.
- **Seed:** 12 through-line notifications (PO-9007 awaiting approval, Site-3 regression, Osei cert, ECO-318 released, mentions, …), a mix of unread/read + recent/older so Today/Earlier + tabs render.
- **Writer/read model** `lib/notifications.ts`: `notify()` (the only writer, org-scoped), `getNotifications(orgId, userId, {filter})` (own + broadcasts, grouped, unread/approval counts), `getUnreadCount`.
- **Actions** `(shell)/notifications/actions.ts`: `markRead`/`markAllRead` — own-user + broadcasts only, org-scoped (the only content mutation).
- **Wired source:** `advanceEco` (DRAFT→REVIEW parks a change for release approval) emits an APPROVAL notify in one line; `/// NOTIF.2` seam left for the other sources (PO gate, run failures, mentions).
- **Shell badge:** `/notifications` is a CORE route (exempt from the AUTH.6 module gate); the sidebar link carries the live unread count.
- **Guardrails:** org isolation (a user sees only their org's own + broadcasts), read-only content, no invented reds, v2 tokens.
- **Flags/deferred:** wiring every source (NOTIF.2), per-channel email routing (NOTIF.3 + EMAIL.1), digest email (EMAIL.2).

---

## SET.4 — Notification preferences

**Automated**
- `pnpm verify:set-4` (6 checks) — NotificationPref model + migration; updatePrefs own-user (upsert by userId) + Zod + screen; **NOTIF.1 getNotifications + unread respect suppressedInAppTypes**; defaults applied when none (approvals/exceptions on); **prefs persist (matrix + mute + quiet), own-user (unique userId)**; **getNotifications suppresses APPROVAL when inApp off + muted suppresses all**. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all (incl. notif-1 still green) · **`pnpm build` compiles**. migrate clean. accessibility-review 0 on /settings/notifications.

**Manual (./dev.sh)**
- Sidebar Settings → **Notifications** (`/settings/notifications`): a **master mute**, the **event × channel matrix** (Approvals · Exceptions · Run failures · Weekly digest · Mentions rows × **In-app / Email** toggles), and **quiet hours**. Save.
- Toggle an event's **In-app** off → **Save** → that type is **suppressed from the /notifications feed + the shell unread badge** (verified: approvals-off hides 4 items; **Mute all** → feed shows 0).
- Email column + quiet hours are **stored** but honored by delivery in **NOTIF.3** (flagged in the copy).

**Notes / architecture**
- **Schema:** `NotificationPref { userId @unique, orgId, prefs Json (event→{inApp,email}), muted, quietStart?, quietEnd?, updatedAt }` via `migrate dev`. Scoped by the unique `userId` (own-user) — not a TENANT_MODEL (avoids the orgId-injection clash on upsert-by-userId).
- **Read model** `lib/notification-prefs.ts`: `NOTIFICATION_EVENTS` (event→NOTIF.1 type map), `defaultPrefs` (all in-app on; email on for approvals/exceptions), `getNotificationPrefs` (defaults if none, merged), `suppressedInAppTypes` (muted → all; per-event inApp=false → that type).
- **NOTIF.1 wiring:** `getNotifications` + `getUnreadCount` now filter out `suppressedInAppTypes(userId)` — the in-app feed + badge honor the prefs immediately.
- **Action** `(shell)/settings/notifications/actions.ts`: `updatePrefs` own-user (upsert by userId), Zod-validated (channel booleans, HH:MM quiet hours), keeps only known event keys.
- **Screen** `/settings/notifications` 1:1 to the design via SettingsShell/SettingsNav (replaces the SET.2 placeholder).
- **Flags/deferred:** per-preference **email routing** (NOTIF.3 + EMAIL.1) — email column + quiet hours are stored now, honored on delivery later; digest email (EMAIL.2).

---

## SET.5 — Integrations, SSO config & API keys

**Automated**
- `pnpm verify:set-5` (8 checks) — Integration/ApiKey/SsoConfig models + migration; actions ADMIN-gated + audited (apikey.create/revoke, sso.config_change, integration.status_change); **createApiKey stores keyHash (sha256), returns plaintext once, never logs it**; screen exists; **createApiKey → hash+prefix stored (NOT plaintext), getApiKeys masked, revoke + audited**; **no plaintext key stored anywhere**; getIntegrations/getSsoConfig org-scoped + SSO persists+audits; cross-org key not reachable. Self-cleaning.
- CI gate: install (frozen) · lint · typecheck · verify:all · **`pnpm build` compiles**. migrate clean. accessibility-review 0 on /settings/integrations.

**Manual (./dev.sh — as ADMIN)**
- Sidebar Settings → **Integrations** (`/settings/integrations`): **Connected systems** grid (ERP/PLM/Telemetry Connected=green · MES Error=ink · Slack/Email Not connected) with **Connect/Disconnect** (stubbed — preview); **SSO/SAML** config (provider · read-only ACS URL · IdP metadata · Enforce toggle — config-only); **API keys** table.
- **Create key** → the plaintext `ax_live_…` is shown **once** with a copy button + "you won't see it again" warning → the row then shows only the **masked** `ax_live_••••xxxx`. **Revoke** dims it. Toggle an integration + save SSO. All writes land in **/audit** (apikey.create/revoke · sso.config_change · integration.status_change) — the audit records the name/prefix, **never the plaintext**.
- Non-ADMIN: read-only.

**Notes / architecture**
- **Schema:** `Integration { orgId, kind (ERP/PLM/MES/SLACK/EMAIL/TELEMETRY), status (NOT_CONNECTED/CONNECTED/ERROR), config?, connectedAt? }` (unique per org+kind), `ApiKey { orgId, name, prefix, keyHash, createdById, lastUsedAt?, revokedAt? }`, `SsoConfig { orgId @unique, provider?, idpMetadata?, enforce }` — via `migrate dev`. Integration/ApiKey are TENANT_MODELS; SsoConfig (orgId-unique upsert) is scoped explicitly.
- **API keys hashed at rest:** `generateApiKey` mints `ax_live_<48 hex>`, stores **sha256(key)** + a short display prefix; the **plaintext is returned once** by `createApiKey` and never stored/logged (audit records name+prefix only). `getApiKeys` returns masked `ax_live_••••xxxx`.
- **Read model** `lib/integrations.ts`: `INTEGRATION_CATALOG`, `getIntegrations`, `getApiKeys` (masked), `getSsoConfig` (+ display ACS URL from APP_URL+slug).
- **Actions** `(shell)/settings/integrations/actions.ts` (ADMIN-gated, org-scoped, audited): `setIntegrationStatus` (stub), `createApiKey`, `revokeApiKey`, `updateSsoConfig` (config-only).
- **Seed:** demo → 6 integration statuses + 1 API key (hash only) + a default SsoConfig.
- **Flags/deferred:** real connector ingest (**CONN.1**), real SSO/SAML auth (**AUTH.2**), webhooks, API-key usage/scoping/enforcement — connect + SSO writes are config-only here.

---

## EMAIL.1 — Transactional email (Resend + React Email)

**Automated**
- `pnpm verify:email-1` (10 checks) — Mailer interface + Fake/Resend split + getMailer() by env; four templates (invite/verify/reset/receipt); createInvites wired to sendEmail('invite') + still returns the link; .env.example documents RESEND_API_KEY + EMAIL_FROM; **getMailer() → FakeMailer without a key / ResendMailer with a key**; **each template renders HTML with the right props (branded, no emoji)**; **sendEmail via FakeMailer records the send**; **a mailer failure does NOT throw into the caller**; **createInvites triggers an invite send (FakeMailer) + still returns the link**. Runs entirely on FakeMailer (no key, no send).
- CI gate: install (frozen; adds `resend` + `@react-email/components` + `@react-email/render`) · lint · typecheck · verify:all (FakeMailer, no key) · **`pnpm build` compiles**. migrate clean (no schema change).

**Manual**
- Without `RESEND_API_KEY` (dev/CI): sending an invite (Members → Invite, or the onboarding team step) logs `[FakeMailer] would send "…" → email` — no network, the copyable `/invite/:token` link still works.
- **With a real key:** set `RESEND_API_KEY` + `EMAIL_FROM` (a verified Resend domain, e.g. `Axona <no-reply@axonahq.com>`) in `.env`, invite yourself → you receive the branded invite email; the "Join {Org}" button opens the accept screen.

**Notes / architecture**
- **DI** `lib/email/mailer.ts`: `Mailer` interface; `getMailer()` returns **FakeMailer** when `RESEND_API_KEY` is unset (records to a sink, logs, no send) or **ResendMailer** with a key (lazy-imports the `resend` SDK so CI never loads it). The key is never logged. Mirrors the ModelClient/Embedder DI pattern.
- **Templates** `lib/email/templates/*` (React Email `@react-email/components`): `InviteEmail` · `VerifyEmail` · `ResetEmail` · `ReceiptEmail` on a shared branded `EmailLayout` (Axona wordmark, paper/ink, ink button, footer — no emoji). `renderEmail` → HTML via `@react-email/render`.
- **`sendEmail(spec, to)`** `lib/email/send.ts`: render the template → `getMailer().send`; **try/catch swallows failures** (transactional email is best-effort — the caller's action already committed).
- **Wiring:** `createInvites` (AUTH.5) now calls `sendEmail("invite", …)` per created invite (still returns the copyable link as a fallback).
- **Config:** `.env.example` gains `RESEND_API_KEY` (blank ⇒ Fake), `EMAIL_FROM`, `APP_URL`. Root `tsconfig.json` gains `jsx: react-jsx` so the verify scripts type-check the `.tsx` templates.
- **Flags/deferred:** reset/verify **flows** (AUTH.7 wires them; EMAIL.1 provides the send + templates), per-preference routing (NOTIF.3), digest (EMAIL.2), marketing/bulk (out of scope — transactional only, no autonomous sends).
