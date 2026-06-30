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
