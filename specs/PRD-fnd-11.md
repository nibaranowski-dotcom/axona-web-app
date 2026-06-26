# PRD: FND.11 — Migrations + org-scoped DB client + isolation pass

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M–L (3–4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: FND.11 (E0 Foundation · Track: Foundation)
**Mode**: Full CPRD (moat-load-bearing — per-tenant isolation, ISO.1)

---

## Problem Statement

The Prisma schema (§3.1–§3.6, FND.5–10) is complete but has never touched a database, every `orgId`
is a bare scalar with no FK, and there is no enforced way to scope a query to one tenant. Without this
story there is no running database, no per-tenant isolation, and the `File.embedding` pgvector column
exists only as an opaque Prisma `Unsupported` type with no real column or ANN index. Shipping any
screen or agent before this means hand-writing `where: { orgId }` on every call — the exact omission
that becomes a multi-tenant data leak (ISO.1). This story makes the data model real and makes tenant
isolation the default, not a thing each developer remembers.

## Success Metrics

| Metric | Target |
|---|---|
| Initial migration applies cleanly to a fresh Postgres | `prisma migrate dev` → 0 errors, all §3 tables created |
| Tenant models with a formal `orgId` FK to `Org` | 100% of tenant-owned models |
| Cross-tenant read leak in the isolation test | 0 rows |
| Queries through `dbForOrg(orgId)` that omit `orgId` and still leak | 0 (extension injects it) |
| `File.embedding` real column + ANN index present | `vector(1536)` column + HNSW cosine index exist in DB |
| Verify + typecheck | `pnpm verify:fnd-11` green, `tsc --noEmit` clean |

## User Stories

- As a **backend developer**, I want a `dbForOrg(orgId)` client so that every read/write is scoped to
  one tenant without me hand-writing `where: { orgId }`, so I cannot accidentally leak across tenants.
- As a **platform engineer**, I want the first migration to create the whole schema with real FK
  constraints so that referential integrity (and `ON DELETE` behavior) is enforced by the database.
- As a **search/files developer (SRCH.1/FILE.2)**, I want `File.embedding` to be a real `vector(1536)`
  column with an ANN index so that semantic search has something to query.
- As a **security reviewer**, I want an automated test proving one org cannot read another org's rows.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | Run the first migration (`migrate dev --name init`) from `packages/db` against the docker Postgres | P0 | Requires `docker compose up -d` (FND.3) |
| R2 | Add a formal `org Org @relation(fields: [orgId], references: [id], onDelete: Cascade)` to **every** tenant-owned model; add the matching back-relation arrays on `Org` | P0 | The deferred one-pass from FND.6–10 |
| R3 | Formalize the clear cross-entity FKs with explicit `onDelete` (list in Tech Reqs) | P0 | Required FKs `Restrict`/`Cascade`; optional FKs `SetNull` |
| R4 | `dbForOrg(orgId)` — a Prisma client extension that injects `orgId` into reads and writes for tenant models | P0 | The ISO.1 enforcement surface |
| R5 | Pagination helpers (cursor-based) in `packages/db` | P0 | Used by every list endpoint (§6) |
| R6 | Convert `File.embedding` to a real `vector(1536)` column + HNSW cosine ANN index via raw SQL in the migration | P0 | Prisma can't manage `Unsupported` indexes |
| R7 | `CREATE EXTENSION IF NOT EXISTS vector` guaranteed before the vector column DDL | P0 | Belt-and-suspenders with the FND.3 init SQL |
| R8 | Resolve every entry under the “FND.11 deferred decisions” heading in `docs/manual-checks.md` | P0 | Close the loop opened in FND.6–10 |
| R9 | Cross-tenant isolation integration test | P0 | Two orgs, scoped client returns only the caller's rows |
| R10 | `verify-fnd-11.ts` + `docs/manual-checks.md` entry; `tsc --noEmit` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `pnpm --filter @axona/db exec prisma migrate dev --name init` applies with no errors on a fresh DB.
- [ ] `prisma migrate status` reports the DB in sync; the generated SQL migration is committed under `packages/db/prisma/migrations/`.
- [ ] Every tenant-owned model has `org Org @relation(... onDelete: Cascade)`; `Org` has the back-relations; `prisma validate` clean.
- [ ] Cross-entity FKs from R3 exist as real constraints in the DB (verified via `information_schema`).
- [ ] `dbForOrg(orgId)` injects `orgId` on `create`/`createMany` and into the `where` of `findMany`/`findFirst`/`count`/`aggregate`/`groupBy`/`updateMany`/`deleteMany` for tenant models; global model `Module` is untouched.
- [ ] The isolation test: seed Org A and Org B each with a Supplier; `dbForOrg(A).supplier.findMany()` returns only A's rows (0 from B).
- [ ] `File.embedding` is `vector(1536)`; an HNSW cosine index exists; a raw `SELECT` ordering by `embedding <=> $1` runs.
- [ ] All “FND.11 deferred decisions” items are checked off.
- [ ] `pnpm verify:fnd-11` green; `pnpm typecheck` clean; committed and pushed.

## Technical Requirements

### 1. Schema — formal `orgId` relations (apply to every tenant model)

Add to **each** tenant-owned model (User, Agent, Chat, Workflow, Project, Machine, Supplier, Part,
PurchaseOrder, WorkOrderMfg, NCR, SpcSample, Cert, Deal, Campaign, Delivery, Robot, TelemetryPoint,
WorkOrderField, Technician, ECO, FirmwareRelease, CompatCell, AutonomyMetric, SafetyIncident,
PolicyVersion, LedgerEntry, Invoice, UnitEconomic, Requisition, CVE, Obligation, ExportLicense,
LegalMatter):

```prisma
  org Org @relation(fields: [orgId], references: [id], onDelete: Cascade)
```

`Message`, `AgentRun`, `WorkflowRun`, `File`, `MatrixColumn`, `MachineSignal` have **no** `orgId` — they
inherit tenancy through their parent FK (do not add `orgId` to them). `Module` is global — leave it.

On `Org`, add the back-relations (Prisma requires them). Keep them named:

```prisma
model Org {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  users         User[]
  agents        Agent[]
  chats         Chat[]
  workflows     Workflow[]
  projects      Project[]
  machines      Machine[]
  suppliers     Supplier[]
  parts         Part[]
  purchaseOrders PurchaseOrder[]
  // …one array per tenant model above. Name them plainly.
}
```

### 2. Schema — cross-entity FKs (R3)

Formalize these (everything else stays scalar + index until a story needs it):

| Child.field | Parent | onDelete |
|---|---|---|
| `PurchaseOrder.supplierId` | `Supplier` | `Restrict` |
| `PurchaseOrder.partId` | `Part` | `Restrict` |
| `PurchaseOrder.draftedByAgentId` (optional) | `Agent` | `SetNull` |
| `TelemetryPoint.robotId` | `Robot` | `Cascade` |
| `WorkOrderField.techId` (optional) | `Technician` | `SetNull` |

Add the matching back-relation arrays on `Supplier`, `Part`, `Agent`, `Robot`, `Technician`. Keep the
existing parent/child relations from FND.6–8 (Agent.runs, Chat.messages, Workflow.runs, Project.files,
Machine.signals) as-is. Keep `Robot.serial` ↔ genealogy and `NCR.linkedTo`/`SafetyIncident.robotSerial`
as **string references** (not FKs) — they cross to as-built genealogy (ONT.2), out of scope here.

### 3. Org-scoped client — `packages/db/src/client.ts`

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Tenant-owned models that carry a real `orgId` column. Children that inherit
 *  tenancy via a parent FK are deliberately excluded — scope them through their parent. */
const TENANT_MODELS = new Set<string>([
  "User","Agent","Chat","Workflow","Project","Machine","Supplier","Part","PurchaseOrder",
  "WorkOrderMfg","NCR","SpcSample","Cert","Deal","Campaign","Delivery","Robot","TelemetryPoint",
  "WorkOrderField","Technician","ECO","FirmwareRelease","CompatCell","AutonomyMetric",
  "SafetyIncident","PolicyVersion","LedgerEntry","Invoice","UnitEconomic","Requisition","CVE",
  "Obligation","ExportLicense","LegalMatter",
]);

const READ_OPS = new Set([
  "findFirst","findFirstOrThrow","findMany","count","aggregate","groupBy","updateMany","deleteMany",
]);

/** Returns a Prisma client whose every tenant-model operation is pinned to one org.
 *  This is the ISO.1 enforcement surface — prefer it over the bare `prisma` for any request path. */
export function dbForOrg(orgId: string) {
  if (!orgId) throw new Error("dbForOrg requires a non-empty orgId");
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);
          const a = args as Record<string, any>;
          if (READ_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), orgId };
          } else if (operation === "create") {
            a.data = { ...(a.data ?? {}), orgId };
          } else if (operation === "createMany") {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r: any) => ({ ...r, orgId }));
          } else if (operation === "update" || operation === "delete" || operation === "upsert") {
            // unique-target ops: orgId can't be added to a `findUnique`-style where.
            // House rule: route tenant mutations through updateMany/deleteMany OR an
            // explicit ownership check. See "Common Mistakes". We still tag where defensively.
            a.where = { ...(a.where ?? {}), orgId };
          }
          return query(a);
        },
      },
    },
  });
}

export type OrgScopedDb = ReturnType<typeof dbForOrg>;
```

### 4. Pagination helpers — `packages/db/src/pagination.ts`

```ts
export interface PageArgs { cursor?: string | null; take?: number; }

const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;

/** Build the cursor args. Always over-fetch by 1 to detect a next page. */
export function paginateArgs({ cursor, take = DEFAULT_TAKE }: PageArgs) {
  const t = Math.min(Math.max(take, 1), MAX_TAKE);
  return { take: t + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
}

/** Split rows into the page + the next cursor. */
export function pageResult<T extends { id: string }>(rows: T[], take = DEFAULT_TAKE) {
  const t = Math.min(Math.max(take, 1), MAX_TAKE);
  const hasMore = rows.length > t;
  const items = hasMore ? rows.slice(0, t) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
```

Export both, plus `dbForOrg`/`prisma`, from `packages/db/src/index.ts`.

### 5. pgvector — raw SQL in the init migration (R6/R7)

After `prisma migrate dev --name init` generates `packages/db/prisma/migrations/<ts>_init/migration.sql`,
append (or add a follow-on migration `enable_pgvector_ann`) — **edit the SQL before applying, or create a
second migration and re-run**:

```sql
-- pgvector: real typed column + ANN index for File.embedding (SRCH.1 / FILE.2)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "File" ALTER COLUMN "embedding" TYPE vector(1536);
CREATE INDEX IF NOT EXISTS "file_embedding_hnsw"
  ON "File" USING hnsw ("embedding" vector_cosine_ops);
```

Dimension **1536** is the default (revisit when the embedding model is chosen in FILE.2); record it in
`docs/manual-checks.md`. Use **HNSW** (pgvector ≥ 0.5) with `vector_cosine_ops`.

### 6. Deferred-decisions closeout (R8)

Open `docs/manual-checks.md`, find the “FND.11 deferred decisions” heading, and check off: formal
`orgId` relations + FK constraints (R2/R3), ISO.1 enforcement via `dbForOrg` (R4), and the pgvector
column/index (R6). Leave a one-line note for anything intentionally still deferred (e.g. genealogy FKs → ONT.2).

## UX Flow

```
request (orgId from session)
   │
   ▼
dbForOrg(orgId)  ──►  prisma.$extends(query injector)
   │                        │
   │   model in TENANT_MODELS? ── no ──►  pass through (e.g. Module)
   │            │ yes
   │            ▼
   │   read op?  ── yes ──►  where = { ...where, orgId }
   │            │ no
   │            ▼
   │   create?  ── yes ──►  data  = { ...data,  orgId }
   │            │ no (unique-target write)
   │            ▼
   │   where tagged with orgId + house-rule ownership check
   ▼
Postgres (FK constraints + cascade enforce integrity at the DB)
```

## Edge Cases

| Case | Handling |
|---|---|
| `findUnique`/`update`/`delete` by id — can't inject `orgId` into a unique where | House rule: tenant mutations go through `updateMany`/`deleteMany` (which the extension scopes) or an explicit `findFirst({where:{id,orgId}})` ownership check first. Documented in Common Mistakes. |
| Nested writes (`create` with nested relations) | Extension scopes the top-level model only; nested tenant rows must be created through their own scoped call or carry `orgId` explicitly. Note in docs. |
| Querying a global model (`Module`) through `dbForOrg` | Passes through untouched (not in `TENANT_MODELS`). |
| `File.embedding` is `NULL` until FILE.2 extracts it | Column nullable; HNSW index skips NULLs. Fine. |
| Migration run before `docker compose up` | Fails fast with a connection error; manual-checks tells the dev to bring infra up first. |
| Re-running `migrate dev` after the raw-SQL edit | Use a separate `enable_pgvector_ann` migration so Prisma's migration history stays consistent; don't hand-edit an already-applied migration. |
| `onDelete: Cascade` on Org delete wiping tenant data | Intended (tenant offboarding). Note it's destructive; real org-delete UX is gated later. |

## Out of Scope

- The org-scoped client wired into API routes / server actions (that's per-endpoint, in RBAC.2 and each module).
- Embedding generation / extraction pipeline (FILE.2) and search API (SRCH.2).
- Genealogy FKs and the immutable event log (ONT.1/ONT.2).
- Timescale/hypertable conversion for telemetry (TEL.1).
- Seeding the narrative (FND.12 — next story; this story only needs enough rows for the isolation test).
- RLS (row-level security) at the Postgres role level — app-level scoping is the chosen mechanism; note RLS as a future hardening option.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.3 docker-compose (Postgres + pgvector) | Done | R1/R6 — needs a live DB |
| FND.5–10 schema (§3.1–§3.6) | Done | R2/R3 — relations added on top |
| FND.1 `packages/db` workspace | Done | where the client + helpers live |
| FND.12 seed | Blocked by this | seeds run against the migrated DB |

## Implementation Plan

**Day 1 — schema relations + migration**
- Morning: add `org` relations to all tenant models + back-relations on `Org`; add the R3 cross-entity FKs. `prisma validate` + `format`.
- Afternoon: `docker compose up -d`; `prisma migrate dev --name init`; confirm all tables + FKs via `\d` / `information_schema`.

**Day 2 — pgvector + scoped client**
- Morning: add `enable_pgvector_ann` migration (extension + `vector(1536)` + HNSW); re-apply; confirm index.
- Afternoon: implement `dbForOrg` extension + pagination helpers; export from `packages/db`.

**Day 3 — isolation test + verify + closeout**
- Morning: write the cross-tenant integration test; close out the deferred-decisions list.
- Afternoon: `verify-fnd-11.ts` + manual-checks entry; `tsc`/`lint`; commit + push.

## Verification Script

`src/scripts/verify-fnd-11.ts`:

```ts
// Run: pnpm verify:fnd-11
async function run() {
  let passed = 0, failed = 0;
  async function check(label: string, fn: () => boolean | Promise<boolean>) {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${label} — ${(e as Error).message}`); failed++; }
  }
  console.log("\nVerifying FND.11 — migrations + org-scoped client + isolation\n");
  const fs = await import("fs");
  const path = await import("path");

  // STATIC — schema + client + migration files
  const schema = fs.readFileSync("packages/db/prisma/schema.prisma", "utf8");
  await check("Org has back-relation arrays", () => /users\s+User\[\]/.test(schema) && /suppliers\s+Supplier\[\]/.test(schema));
  await check("tenant model has formal org relation", () => /org\s+Org\s+@relation\(fields:\s*\[orgId\]/.test(schema));
  await check("cross-entity FK: PurchaseOrder -> Supplier", () => /supplier\s+Supplier\s+@relation/.test(schema));
  await check("client.ts exports dbForOrg", () => fs.existsSync("packages/db/src/client.ts") && /export function dbForOrg/.test(fs.readFileSync("packages/db/src/client.ts","utf8")));
  await check("pagination helpers exist", () => fs.existsSync("packages/db/src/pagination.ts"));
  const migDir = "packages/db/prisma/migrations";
  await check("init migration committed", () => fs.existsSync(migDir) && fs.readdirSync(migDir).some(d => /_init$/.test(d)));
  await check("pgvector ANN migration present", () => {
    const sql = fs.readdirSync(migDir).flatMap(d => { const p = path.join(migDir, d, "migration.sql"); return fs.existsSync(p) ? [fs.readFileSync(p,"utf8")] : []; }).join("\n");
    return /USING hnsw/.test(sql) && /vector\(1536\)/.test(sql) && /CREATE EXTENSION IF NOT EXISTS vector/.test(sql);
  });

  // INTEGRATION — only if a DB is reachable
  const hasDb = !!process.env.DATABASE_URL;
  if (!hasDb) {
    console.log("  SKIP integration checks — DATABASE_URL not set (run with docker up; see manual-checks)");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    await check("migration applied — Org table queryable", async () => { await prisma.org.count(); return true; });
    await check("cross-tenant isolation — scoped read returns only caller org", async () => {
      const a = await prisma.org.create({ data: { name: "verify-A" } });
      const b = await prisma.org.create({ data: { name: "verify-B" } });
      await dbForOrg(a.id).supplier.create({ data: { name: "A-sup", tier: 1, riskScore: 0.1, onTimePct: 99 } as any });
      await dbForOrg(b.id).supplier.create({ data: { name: "B-sup", tier: 1, riskScore: 0.2, onTimePct: 98 } as any });
      const seenByA = await dbForOrg(a.id).supplier.findMany();
      const ok = seenByA.every((s: any) => s.orgId === a.id) && seenByA.length >= 1;
      // cleanup
      await prisma.org.delete({ where: { id: a.id } });
      await prisma.org.delete({ where: { id: b.id } });
      return ok;
    });
  }

  if (failed === 0) { console.log(`\nPASSED — ${passed} checks`); console.log("See docs/manual-checks.md for DB verification."); }
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## FND.11 — Migrations + org-scoped client + isolation
**Automated**
- `pnpm verify:fnd-11` — schema relations, dbForOrg, migrations, pgvector ANN; + integration checks when DATABASE_URL is set.
- `pnpm typecheck` — tsc --noEmit clean.

**Manual (run `docker compose up -d` first)**
- [ ] `pnpm --filter @axona/db exec prisma migrate status` → "Database schema is up to date".
- [ ] `psql $DATABASE_URL -c '\d "File"'` shows `embedding | vector(1536)`.
- [ ] `psql $DATABASE_URL -c "\di file_embedding_hnsw"` shows the HNSW index.
- [ ] FK constraints exist: `select conname from pg_constraint where contype='f'` includes PurchaseOrder→Supplier/Part, TelemetryPoint→Robot, and org FKs.
- [ ] Isolation: seed two orgs, confirm `dbForOrg(A).supplier.findMany()` returns 0 of B's rows.
- [ ] Embedding dimension recorded here = 1536 (revisit in FILE.2 when the embedding model is set).

### FND.11 deferred decisions — CLOSED
- [x] Formal orgId @relation + FK constraints across tenant models (R2/R3).
- [x] ISO.1 isolation enforced via dbForOrg (R4).
- [x] pgvector real column + HNSW ANN index (R6).
- [ ] (Still deferred) genealogy FKs + immutable event log → ONT.1/ONT.2; Timescale → TEL.1.
```

## Common Mistakes to Avoid

1. **Injecting `orgId` into a `findUnique` where** — Prisma rejects non-unique fields in a unique where. Use `findFirst({ where: { id, orgId } })` for ownership-checked reads, and `updateMany`/`deleteMany` for scoped writes.
2. **Hand-editing an already-applied migration** to add the pgvector SQL — breaks migration history. Add a **separate** `enable_pgvector_ann` migration instead.
3. **Forgetting the back-relation arrays on `Org`** — Prisma won't validate a one-sided relation; every `org Org @relation` needs its array on `Org`.
4. **Adding `orgId` to child models** (Message/AgentRun/File/MachineSignal/…) — they inherit tenancy via the parent FK; adding it duplicates the source of truth.
5. **Assuming the extension scopes nested writes** — it scopes the top-level model only. Nested tenant creates must carry `orgId` or go through their own scoped call.
6. **Using `ivfflat` and forgetting to set lists / train** — prefer HNSW for a zero-config, good-recall index at this scale.

## Cursor Rules for This Story

- Every tenant model gets `org Org @relation(... onDelete: Cascade)`; `Module` and FK-child models do not.
- `dbForOrg(orgId)` is the only sanctioned request-path client; the bare `prisma` is for migrations/seed/system tasks only.
- pgvector column is `vector(1536)` + HNSW cosine; the dimension is recorded in manual-checks.
- No live data in the verify test that isn't cleaned up; integration checks self-clean.
- Close every “FND.11 deferred decisions” item or explicitly re-defer it with a reason.

## Rollback Plan

Revert the FND.11 commit (schema relation additions, `client.ts`, `pagination.ts`, migrations, verify
script). To roll back the database: `prisma migrate reset` drops and recreates from migration history —
**this destroys all local dev data**, which is acceptable here because there is no production data and
the narrative seed (FND.12) has not run yet. If only the pgvector migration is bad, roll forward with a
corrective migration rather than editing history. Data affected: local dev database only — no production
data exists. Otherwise zero data risk.
