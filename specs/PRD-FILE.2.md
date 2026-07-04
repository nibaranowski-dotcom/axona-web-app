# PRD — FILE.2 · Text-extraction + embedding pipeline

**Story:** FILE.2 — Text-extraction + embedding pipeline (queue job over uploaded files).
**Spec ref:** `specs/axona-build-spec.md` §3.3/§6; backlog E4 row 41.
**Priority / size:** P0 · M (4 dev-days). **Track:** Platform (E4). **Depth:** Full CPRD (feeds search + memory — moat-adjacent).
**Dependencies:** FILE.1 (storage client + File lifecycle — landed), SRCH.1 (SearchDoc + FTS — landed), MIGRATE.1
(File.embedding vector(1536) + `searchdoc_embedding_hnsw` / `file_embedding_hnsw` HNSW indexes now reproduced
from migrations — landed), WF.1 (BullMQ worker pattern in `apps/worker` — landed).

**Moat-adjacent.** The extracted text + embeddings are the capture substrate that activates semantic search now
and feeds operational memory (MEM.1) later. Shape it right: per-tenant isolation, a swappable embedder behind an
interface (so the model can improve without a rewrite), and idempotent re-processing. Leave the MEM.1 seam.

---

## 1. Context — what exists (build ON this)

- **File model (FND.7):** `{ projectId, name, ext, sizeBytes, blobKey, type, linkedTo, extracted: Json, embedding: vector(1536)?, modifiedAt }`.
  - `extracted` is **reserved for MTX.1** (AI-extracted column answers keyed by columnId) — do NOT repurpose it for raw text.
  - `embedding` is a pgvector `Unsupported("vector")` column — Prisma cannot write it; use raw SQL (`$executeRaw`).
- **Storage (FILE.1, `apps/web/lib/storage.ts`):** `getObjectBytes(key)` returns the blob bytes; keys are `orgId/projectId/uuid.ext`.
- **Search (SRCH.1/SRCH.4, `packages/db/src/search`):** `SearchDoc` (type, refId, title, subtitle, url, orgId, tsv, embedding), `reindex.ts` with `upsertDoc()` + `ensureSearchIndexSchema()`; `query.ts` has `search()` (FTS) and a dormant `semanticSearch()` (TODO FILE.2: embed query, `ORDER BY embedding <=> $1`, fuse with FTS).
- **Worker (WF.1, `apps/worker`):** BullMQ pattern established (queue + executor). FILE.1 left a `/// FILE.2` seam on the upload route (no auto-processing yet).

## 2. Goals

1. An **Embedder** interface with a real provider impl + a deterministic **FakeEmbedder** (DI, mirroring ART.1's
   `ModelClient`) so the pipeline runs offline/CI without an API key.
2. **Type-aware text extraction** from a File's blob bytes (txt/md/json direct; pdf/docx via a parser; safe fallback).
3. A **BullMQ extract-embed job** in `apps/worker`: fetch blob → extract text → embed → persist (File.text + File.embedding + a searchable SearchDoc row). Idempotent, org-scoped.
4. **Auto-enqueue on upload** (wire FILE.1's `/// FILE.2` seam) + a **backfill** for the seeded files.
5. **Activate `semanticSearch()`** — implement the dormant query and give `/api/search` a hybrid (FTS ∪ vector) result so files become findable by meaning, not just keyword.

## 3. Non-goals (explicit)

- **Per-chunk / multi-vector** embeddings — one file-level embedding for now; chunk-level retrieval is MTX.1/MEM.1.
- **The ask-across-files column extraction** (populating `File.extracted` per column) — that is MTX.1.
- **Operational memory graph** (MEM.1) — leave the seam; do not build the graph here.
- **A bespoke re-ranker** — a simple score fusion (or union with FTS priority) is enough.
- Confidence/approval fields — not applicable to extraction; no AUDIT.3 columns here.

## 4. Data model

Re-use File + SearchDoc. **One bounded schema addition** (via `prisma migrate dev` — NEVER `db push`, per MIGRATE.1):

- `File.text String?` — the extracted plain text (bounded/truncated), used by search body + MTX.1's per-file Q&A.
  Keep `File.extracted` (Json) reserved for MTX.1 column answers. Add a `/// MTX.1` + `/// MEM.1` pointer.
- **No** column for the vector beyond the existing `File.embedding` (write it via raw SQL). Do not add
  confidence/approver columns. `prisma migrate status` clean after the migration; the raw-SQL DDL stays in
  migrations (MIGRATE.1 invariant).

## 5. Embedder (DI — `packages/agents/src/embed/` or `packages/db/src/embed/`)

```
interface Embedder { embed(texts: string[]): Promise<number[][]>; readonly dim: number }  // dim === 1536
```
- **RealEmbedder** — a provider at 1536 dims (e.g. OpenAI `text-embedding-3-small`, or Voyage with a 1536 output);
  provider + key from env; batch inputs; truncate to the model's token limit. Selected only when the key env is set.
- **FakeEmbedder** — deterministic 1536-vector from a hash of the text (seeded, L2-normalized). No network. This is
  what dev/CI use. The pipeline and `semanticSearch` must produce stable results with it.
- One factory `getEmbedder()` picks real-vs-fake by env, exactly like `AnthropicModelClient` vs `FakeModelClient`.

## 6. Extraction (`packages/…/extract.ts`)

- Dispatch by `ext`/`type`: `txt|md|json|csv` → utf8 decode; `pdf` → `pdf-parse`; `docx` → `mammoth`; unknown/binary
  → skip with a logged reason (store empty text, mark processed). Pin any parser deps in the worker package.
- Normalize whitespace; cap stored `File.text` to a bounded length (e.g. first ~20k chars) and cap the embed input
  to the model limit. Never throw the job on a single bad file — catch, log, mark that file failed, continue.

## 7. Queue job (`apps/worker`)

- **Queue** `file-extract` on the FND.3 Redis. Payload `{ fileId, orgId }`.
- **Processor:** load File org-scoped via `dbForOrg(orgId)` (join through project.orgId — File has no orgId);
  `getObjectBytes(blobKey)`; extract text; `getEmbedder().embed([text])`; then in one logical step:
  - `File.text = <extracted>` (Prisma update),
  - `File.embedding` via raw SQL `UPDATE "File" SET embedding = $1::vector WHERE id = $2` (org-checked),
  - upsert a `SearchDoc { type: FILE, refId: fileId, title: name, subtitle: <snippet/linkedTo>, url: /projects/:projectId, orgId }` via `upsertDoc()` and set its `embedding` (raw SQL) so files are FTS- **and** vector-searchable.
- **Idempotent:** re-running a file overwrites cleanly (no dup SearchDoc — upsert by (type, refId)).
- **Embedder/DB gating:** uses FakeEmbedder when no provider key; requires Redis+DB to run live (mirror the
  DB-gated skip in CI — the processor logic is unit-testable in-process without a live queue).

## 8. Trigger + backfill

- **On upload:** FILE.1's `POST /api/projects/:id/files` enqueues `file-extract` after `File.create` (replace the
  `/// FILE.2` seam). Non-blocking — the upload returns 201 immediately; processing is async.
- **Backfill:** a script `pnpm db:embed:backfill` (or fold into `db:seed:blobs`) that enqueues/processes all 18
  seeded Files (their placeholder blobs from FILE.1) so search + MTX.1 have real text + vectors from a fresh seed.

## 9. Activate semantic search (`packages/db/src/search/query.ts`)

- Implement `semanticSearch(orgId, q)`: embed `q` with `getEmbedder()`, then
  `SELECT … FROM "SearchDoc" WHERE embedding IS NOT NULL AND ("orgId" = $orgId OR "orgId" IS NULL) ORDER BY embedding <=> $qvec LIMIT k`.
- Give `search()`/`/api/search` a **hybrid**: union FTS hits with vector hits, FTS-priority then vector for recall
  (simple fusion — no learned re-ranker). Keep the existing FTS-only behavior correct when embeddings are absent.

## 10. Tenancy · moat invariants (DoD-blocking)

- **Isolation:** File reads join `project.orgId`; SearchDoc rows carry `orgId`; the vector query filters by org (or
  NULL globals). One tenant's text/vectors never surface to another.
- **Feeds-the-loop:** extracted text + embeddings are the capture that powers search now and MEM.1 later — leave the
  `/// MEM.1` seam on `File.text`/`File.embedding`; do not build the memory graph here.
- **Guardrails:** extraction is read-of-blob + write-of-derived-data only; no external calls except the embedder;
  the embedder is swappable and offline-capable. No `db push` — the `File.text` migration goes through `migrate dev`.

## 11. Verification + gate

- `src/scripts/verify-file-2.ts` (gated on DB/S3/Redis env like siblings; always run pure-logic checks):
  1. FakeEmbedder returns a 1536-dim L2-normalized vector; deterministic for the same input.
  2. Extraction: txt/md decode to text; an unknown type is skipped without throwing.
  3. Processor over a seeded File: sets `File.text` (non-empty), writes `File.embedding` (raw SQL, readable back),
     and upserts a `SearchDoc(FILE)` with a non-null embedding — idempotent on a second run (no dup doc).
  4. `semanticSearch(orgId, "<seeded topic>")` returns the seeded file; a cross-org query does NOT.
  5. `/api/search` hybrid still returns the Procurement MODULE hit (FTS unbroken) AND now a FILE hit for a file topic.
- `docs/manual-checks.md` entry (upload → wait → file appears in search).
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all`;
  tsc clean; verify:all green (must run with FakeEmbedder, no provider key, and skip live MinIO/Redis in CI);
  `prisma migrate status` clean; then commit + push and confirm GitHub Actions on `main` is green.

## 12. Review gate

**Stop after FILE.2** and show me: (a) the Embedder interface + Fake/Real split, (b) a processed seeded file
(File.text populated + embedding written + SearchDoc row), (c) `semanticSearch` returning that file, and (d)
verify-file-2 output — before continuing to MTX.1.

---

### Completeness check (6-point)
1. Story + spec ref — FILE.2, §3.3/§6, E4 row 41. ✓
2. Every requirement — embedder DI, extraction, queue job, auto-enqueue + backfill, semanticSearch activation. ✓
3. DoD — org isolation, RBAC inherited from FILE.1's routes, verify + manual-checks, tsc clean, CI gate, migrate clean. ✓
4. Real deps — FILE.1, SRCH.1, MIGRATE.1, WF.1. ✓
5. Moat flagged — feeds search/memory, swappable embedder, MEM.1 seam, per-tenant isolation, feeds-the-loop. ✓
6. Review gate — §12. ✓
