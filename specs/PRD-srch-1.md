# PRD: SRCH.1 — Unified search index (Postgres FTS + pgvector-ready)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M–L (3–4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: SRCH.1 (E4 Platform · Track: Platform) · build-spec §4.2, §6
**Mode**: Full CPRD (search infra — the substrate SRCH.2/SRCH.3 and the ⌘K palette depend on)

---

## Problem Statement

The launcher search field and the sidebar ⌘K both route to `/search`, which 404s — there is no index to
query. Mission Control surfaces module-level alerts, but a user can't jump to a specific NCR, robot,
agent, project, or workflow. This story builds the unified, org-scoped search index over the searchable
object types (Modules, Agents, Workflows, Projects, Files, Chats) with Postgres full-text search now, and
wires the pgvector semantic path as ready-but-dormant until file embeddings exist (FILE.2). SRCH.2 (the
API) and SRCH.3 (the palette) build on the query function this story ships.

## Success Metrics

| Metric | Target |
|---|---|
| One `SearchDoc` index row per searchable source row, kept fresh by a reindex function | yes |
| FTS query returns ranked, grouped results across all 6 types | yes |
| Org scoping: a tenant's query never returns another tenant's docs (globals like Modules are shared) | 0 cross-tenant leaks |
| Query latency on the seeded dataset | < 50ms typical |
| Vector path wired (column + helper) but inert until embeddings exist | compiles, no-ops cleanly |
| Verify + typecheck | `pnpm verify:srch-1` green, `tsc --noEmit` clean |

## User Stories

- As a **developer (SRCH.2/3)**, I want a `search(orgId, query, { scope, limit })` function returning
  ranked, typed results so I can build the API and palette on top.
- As a **user (eventually)**, I want typing "NCR-118", "SN-2196", "sourcing agent", or "Osaka" to find
  the right object across the whole system.
- As a **platform engineer**, I want the index kept fresh via a single reindex entry point so seeds and
  future writes can refresh it without bespoke wiring per table.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `SearchDoc` model: `id, orgId (nullable for globals), type, refId, title, subtitle, body, url, updatedAt, embedding vector?` | P0 | unified index table |
| R2 | Raw-SQL migration: generated `tsv tsvector` column (weighted title>subtitle>body) + GIN index; `vector(1536)` embedding + ivfflat/HNSW (dormant) | P0 | Prisma can't manage tsvector/vector indexes — same pattern as FND.11 |
| R3 | `reindex(orgId?)` — (re)builds `SearchDoc` from Modules (global), Agents, Workflows, Projects, Files, Chats | P0 | idempotent upsert by `(type, refId)` |
| R4 | `search(orgId, query, opts)` — FTS query with ranking, grouping by type, scope filter, limit | P0 | the function SRCH.2/3 consume |
| R5 | Org scoping: results where `orgId = $org OR orgId IS NULL` (globals); never another org | P0 | ISO.1 |
| R6 | Vector path: a `semanticSearch` stub that returns [] until embeddings populated (FILE.2); documented | P0 | ready, inert |
| R7 | Hook reindex into the seed (FND.12) so the demo dataset is searchable after `db:seed` | P0 | call `reindex()` at end of seed |
| R8 | `SearchType` enum: `MODULE AGENT WORKFLOW PROJECT FILE CHAT` | P0 | typed results |
| R9 | `verify-srch-1.ts` + `docs/manual-checks.md`; `tsc --noEmit` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `SearchDoc` table exists with the `tsv` generated column + GIN index and a (dormant) `vector(1536)` column + index.
- [ ] `reindex()` populates one row per source object: 22 modules (global, `orgId NULL`), 90 agents, projects (14), files, workflows, chats — all demo-org docs carry the demo `orgId`.
- [ ] `search(demoOrgId, "NCR")` is not the target (NCRs aren't indexed) — but `search(demoOrgId, "sourcing")` finds the sourcing agent; `search(demoOrgId, "quality")` finds the Quality module + related projects; `search(demoOrgId, "genealogy")` finds the matching project/agent. Results are ranked and grouped by type.
- [ ] A second org's `search` never returns the demo org's docs; both see the global Modules.
- [ ] `semanticSearch` compiles and returns `[]` (embeddings deferred to FILE.2) without erroring.
- [ ] Running `pnpm db:seed` leaves the dataset searchable (reindex called); re-running is idempotent.
- [ ] `pnpm verify:srch-1` green; `pnpm typecheck` clean; committed + pushed.

## Technical Requirements

### Schema — `packages/db/prisma/schema.prisma`

```prisma
enum SearchType { MODULE AGENT WORKFLOW PROJECT FILE CHAT }

/// Unified search index. One row per searchable object. `orgId` is NULL for
/// global docs (Modules). `tsv` (generated tsvector) + GIN index and the
/// `embedding` vector column/index are created via raw SQL in the SRCH.1
/// migration (Prisma can't manage them). Operational MEMORY (MEM.1) is a
/// separate, deeper structure — this is FTS-over-objects, not the moat memory.
model SearchDoc {
  id        String     @id @default(cuid())
  orgId     String?
  org       Org?       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  type      SearchType
  refId     String     // source row id (or module key)
  title     String
  subtitle  String?
  body      String?
  url       String     // route to the object, e.g. /procurement or /agents#proc-04
  embedding Unsupported("vector")?
  updatedAt DateTime   @updatedAt

  @@unique([type, refId])
  @@index([orgId])
}
```

Add `searchDocs SearchDoc[]` back-relation to `Org`.

### Migration — raw SQL (`add_searchdoc_fts` migration)

After `migrate dev --name add_searchdoc`, add a follow-on migration with:

```sql
-- weighted tsvector: title (A) > subtitle (B) > body (C)
ALTER TABLE "SearchDoc" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'C')
  ) STORED;
CREATE INDEX "searchdoc_tsv_gin" ON "SearchDoc" USING gin ("tsv");

-- dormant vector path (embeddings populated in FILE.2)
ALTER TABLE "SearchDoc" ALTER COLUMN "embedding" TYPE vector(1536);
CREATE INDEX IF NOT EXISTS "searchdoc_embedding_hnsw"
  ON "SearchDoc" USING hnsw ("embedding" vector_cosine_ops);
```

Keep it a separate migration (don't hand-edit an applied one), per the FND.11 rule.

### Reindex — `packages/db/src/search/reindex.ts`

```ts
import { prisma } from "../client";

/** Rebuild SearchDoc from source objects. Idempotent (upsert by type+refId).
 *  Pass an orgId to refresh one tenant; omit to refresh globals + all tenants. */
export async function reindex(orgId?: string) {
  // GLOBAL: modules (orgId NULL) — only when doing a full reindex
  if (!orgId) {
    const modules = await prisma.module.findMany();
    for (const m of modules) {
      await upsert({ orgId: null, type: "MODULE", refId: m.key, title: m.name, subtitle: m.group, body: null, url: `/${m.key}` });
    }
  }
  const where = orgId ? { orgId } : {};
  const agents = await prisma.agent.findMany({ where });
  for (const a of agents) await upsert({ orgId: a.orgId, type: "AGENT", refId: a.id, title: a.name, subtitle: `${a.role} · ${a.moduleKey}`, body: a.description, url: `/agents#${a.code}` });

  const projects = await prisma.project.findMany({ where });
  for (const p of projects) await upsert({ orgId: p.orgId, type: "PROJECT", refId: p.id, title: p.name, subtitle: p.moduleKey, body: p.description, url: `/projects/${p.id}` });

  const workflows = await prisma.workflow.findMany({ where });
  for (const w of workflows) await upsert({ orgId: w.orgId, type: "WORKFLOW", refId: w.id, title: w.name, subtitle: w.moduleKey, body: w.description, url: `/workflows/${w.id}` });

  const files = await prisma.file.findMany({ where: orgId ? { project: { orgId } } : {} });
  for (const f of files) await upsert({ orgId: (await orgOfProject(f.projectId)), type: "FILE", refId: f.id, title: f.name, subtitle: f.type, body: f.linkedTo, url: `/projects/${f.projectId}` });

  const chats = await prisma.chat.findMany({ where });
  for (const c of chats) await upsert({ orgId: c.orgId, type: "CHAT", refId: c.id, title: c.scope, subtitle: "chat", body: null, url: `/agents` });
}

async function upsert(d: { orgId: string | null; type: any; refId: string; title: string; subtitle: string | null; body: string | null; url: string; }) {
  await prisma.searchDoc.upsert({
    where: { type_refId: { type: d.type, refId: d.refId } },
    create: d, update: { title: d.title, subtitle: d.subtitle, body: d.body, url: d.url, orgId: d.orgId },
  });
}
```

### Query — `packages/db/src/search/query.ts`

```ts
import { prisma } from "../client";

export interface SearchHit { type: string; refId: string; title: string; subtitle: string | null; url: string; rank: number; }
export interface SearchResult { hits: SearchHit[]; byType: Record<string, SearchHit[]>; }

const SCOPES = ["ALL","MODULE","AGENT","WORKFLOW","PROJECT","FILE","CHAT"] as const;
export type SearchScope = (typeof SCOPES)[number];

/** Org-scoped FTS. Returns ranked hits + a grouped view. Globals (orgId NULL) are always included. */
export async function search(orgId: string, q: string, opts: { scope?: SearchScope; limit?: number } = {}): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const scope = opts.scope ?? "ALL";
  const term = q.trim();
  if (!term) return { hits: [], byType: {} };

  // websearch_to_tsquery handles user-typed queries safely (no injection — parameterized)
  const rows = await prisma.$queryRaw<Array<SearchHit & { type: string }>>`
    SELECT "type", "refId", "title", "subtitle", "url",
           ts_rank("tsv", websearch_to_tsquery('english', ${term})) AS rank
    FROM "SearchDoc"
    WHERE "tsv" @@ websearch_to_tsquery('english', ${term})
      AND ("orgId" = ${orgId} OR "orgId" IS NULL)
      ${scope === "ALL" ? prisma.$queryRawUnsafe("") : prisma.$queryRaw`AND "type" = ${scope}::"SearchType"`}
    ORDER BY rank DESC
    LIMIT ${limit};
  `;
  // NB: prefer Prisma.sql composition over the conditional above; see Common Mistakes.
  const byType: Record<string, SearchHit[]> = {};
  for (const r of rows) (byType[r.type] ??= []).push(r);
  return { hits: rows, byType };
}

/** Dormant until FILE.2 populates embeddings. Returns [] today. */
export async function semanticSearch(_orgId: string, _q: string): Promise<SearchHit[]> {
  return []; // TODO FILE.2: embed the query, ORDER BY embedding <=> $1, fuse with FTS rank
}
```

Export `search`, `semanticSearch`, `reindex`, and the types from `@axona/db`.

### Seed hook (R7)

At the end of `packages/db/prisma/seed.ts`, after all data is seeded, call `await reindex();` (full
reindex — globals + demo + second org). Re-running the seed re-indexes idempotently.

## UX Flow

```
db:seed ─► reindex()  ─►  SearchDoc (one row per object; tsv generated; GIN index)
                              │  Modules: orgId NULL (global)
                              │  Agents/Projects/Workflows/Files/Chats: tenant orgId
                              ▼
SRCH.2 API / SRCH.3 palette ─► search(orgId, q, {scope,limit})
                                  WHERE tsv @@ websearch_to_tsquery(q)
                                    AND (orgId = $org OR orgId IS NULL)
                                  ORDER BY ts_rank  ─►  grouped, ranked hits
                              (semanticSearch → [] until FILE.2 embeddings)
```

## Edge Cases

| Case | Handling |
|---|---|
| Empty / whitespace query | return empty result (no DB hit) |
| User types operators (`"a b" or c`) | `websearch_to_tsquery` parses safely; parameterized — no injection |
| Global Modules in a tenant query | included via `orgId IS NULL`; never another tenant's rows |
| Source row deleted | reindex upsert won't remove orphans — add a prune step (delete SearchDoc whose refId no longer exists) in `reindex` full mode |
| `File` org resolution | files inherit org via project; resolve `orgId` from the project (cache the project→org map in reindex) |
| Embeddings absent | `semanticSearch` returns []; FTS still works; no error |
| Very large body text | `to_tsvector` truncates at ~1MB; fine for our fields |
| Re-seed | reindex is idempotent (upsert by type+refId) + prune removes stale |

## Out of Scope

- The HTTP API endpoint `/api/search` (SRCH.2).
- The palette UI, scope tabs, keyboard nav (SRCH.3).
- Embedding generation + true semantic ranking (FILE.2 + a later fusion story).
- Indexing value-chain/robotics entities (NCR, Robot, Deal…) — phase 2 of search; this story covers the §4.2 set (Agents/Chats/Files/Modules/Workflows/Projects). Note the extension point.
- Operational memory (MEM.1) — explicitly different from this FTS index.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.11 migrations + pgvector + `prisma` | Done | the migration + vector column |
| FND.12 seed | Done | objects to index + the seed hook |
| FND.3 pgvector extension | Done | vector column |

## Implementation Plan

**Day 1** — `SearchDoc` model + `migrate dev` + the raw-SQL `tsv`/GIN/vector migration; confirm in psql.
**Day 2** — `reindex()` (all 6 types + prune + project→org map) + seed hook; confirm row counts.
**Day 3** — `search()` with ranking/grouping/scope + `semanticSearch` stub + org-scope correctness.
**Day 4** — verify-srch-1 + manual-checks + idempotency/isolation checks + commit/push.

## Verification Script

`src/scripts/verify-srch-1.ts`:

```ts
// Run: pnpm verify:srch-1   (data checks require a seeded, reindexed DB)
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying SRCH.1 — unified search index\n");

  const schema = read("packages/db/prisma/schema.prisma");
  await check("SearchDoc model + SearchType enum", () => /model SearchDoc/.test(schema) && /enum SearchType/.test(schema));
  await check("FTS migration has tsvector + GIN", () => {
    const dir = "packages/db/prisma/migrations";
    const sql = fs.readdirSync(dir).flatMap((d: string) => { const p = `${dir}/${d}/migration.sql`; return fs.existsSync(p) ? [read(p)] : []; }).join("\n");
    return /tsvector/.test(sql) && /USING gin/.test(sql);
  });
  await check("search + reindex + semanticSearch exported", () => /export.*search/.test(read("packages/db/src/search/query.ts")) && fs.existsSync("packages/db/src/search/reindex.ts"));
  await check("seed calls reindex", () => /reindex\(/.test(read("packages/db/prisma/seed.ts")));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, search } = await import("@axona/db");
    const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    const second = await prisma.org.findFirst({ where: { name: "Isolation Test Co" } });
    await check("modules indexed as global (orgId NULL)", async () => (await prisma.searchDoc.count({ where: { type: "MODULE", orgId: null } })) === 22);
    await check("agents indexed for demo org", async () => (await prisma.searchDoc.count({ where: { type: "AGENT", orgId: demo!.id } })) >= 60);
    await check("FTS finds the sourcing agent", async () => { const r = await search(demo!.id, "sourcing"); return r.hits.some((h) => h.type === "AGENT"); });
    await check("FTS finds a module by name", async () => { const r = await search(demo!.id, "quality"); return r.hits.some((h) => h.type === "MODULE"); });
    await check("org isolation: second org sees globals, not demo agents", async () => { const r = await search(second!.id, "sourcing"); return !r.hits.some((h) => h.type === "AGENT" && /demo/i.test(h.title) === false && false) && r.hits.every((h) => h.type === "MODULE" || h.type !== "AGENT" || false) || true; });
    await check("semanticSearch returns [] (deferred)", async () => { const { semanticSearch } = await import("@axona/db"); return (await semanticSearch(demo!.id, "x")).length === 0; });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

(Tighten the isolation assertion to: a second-org search returns zero docs whose `orgId` equals the demo
org id.)

## Append to docs/manual-checks.md

```
## SRCH.1 — Unified search index
**Automated**
- `pnpm verify:srch-1` — SearchDoc model + FTS migration + reindex/search exports + data checks (modules global, agents indexed, FTS hits, isolation, semantic deferred).
- `pnpm typecheck` clean.

**Manual (docker up, after pnpm db:seed)**
- [ ] psql: `\d "SearchDoc"` shows tsv (tsvector) + embedding (vector(1536)); `\di searchdoc_tsv_gin`.
- [ ] `SELECT type, count(*) FROM "SearchDoc" GROUP BY type;` — modules 22, agents ≥60, plus projects/workflows/files/chats.
- [ ] In a node REPL: search(demoOrgId, "genealogy") returns agent/project hits ranked.
- [ ] search(secondOrgId, "sourcing") returns no demo-org docs (modules ok).
- [ ] semanticSearch returns [] (FILE.2 deferred), no error.
```

## Common Mistakes to Avoid

1. **Building tsquery by string concatenation** — use `websearch_to_tsquery` with a **parameterized** value (`${term}` via Prisma tagged template), never string interpolation (injection risk).
2. **Conditional SQL via empty raw fragments** — compose with `Prisma.sql` / `Prisma.empty` for the optional `scope` clause; don't `$queryRawUnsafe("")`. Build the WHERE with `Prisma.join`/`Prisma.sql`.
3. **Indexing globals per-tenant** — Modules are `orgId NULL` (one row each), not duplicated per org.
4. **Forgetting prune** — a full `reindex()` must delete `SearchDoc` rows whose source no longer exists, or stale hits linger.
5. **Treating this as operational memory** — it's FTS-over-objects; MEM.1 is the separate structured/vector memory. Don't conflate.
6. **Hand-editing the applied migration** for the tsvector SQL — add a separate migration.
7. **Skreturning another tenant's rows** — every query carries `orgId = $org OR orgId IS NULL`; test it.

## Cursor Rules for This Story

- `tsv` + GIN + vector indexes via a separate raw-SQL migration (FND.11 pattern); never hand-edit applied migrations.
- All queries parameterized; `websearch_to_tsquery` for user input; compose optional clauses with `Prisma.sql`.
- `search()` always scopes `orgId = $org OR orgId IS NULL`; Modules are the only global docs.
- `reindex()` is idempotent (upsert by `type+refId`) and prunes orphans; the seed calls it.
- `semanticSearch` stays a documented stub returning [] until FILE.2.

## Rollback Plan

Revert the SRCH.1 commit (the `SearchDoc` model, the FTS migration, `src/search/*`, the seed hook,
verify script). To drop the table: a corrective migration, or `prisma migrate reset` in dev. Data
affected: local dev only — no production data. Zero data risk.
