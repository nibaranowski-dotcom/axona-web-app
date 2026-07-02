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
