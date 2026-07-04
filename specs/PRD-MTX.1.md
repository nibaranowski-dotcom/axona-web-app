# PRD — MTX.1 · Ask-across-files column extraction

**Story:** MTX.1 — Ask-across-files column extraction job (`POST /projects/:id/columns` → per-file answers).
**Spec ref:** `specs/axona-build-spec.md` §3.3 / §4.8; backlog E4 row 42.
**Priority / size:** P0 · M (4 dev-days). **Track:** Platform (E4). **Depth:** Full CPRD (moat-load-bearing — the
Hebbia-style file matrix + the propose→approve→audit substrate).
**Dependencies:** FILE.2 (File.text + embeddings — landed), ART.1/ART.2 (ModelClient DI + FakeModelClient +
structured-output pattern — landed), FND.7 (MatrixColumn + File.extracted — landed).

**Moat-load-bearing.** Each extracted cell is an **agent-drafted proposal** with a **citation** and a **calibrated
confidence** — the exact propose→approve→audit / cite-your-sources shape the product is built on. `confidence` is a
real field (CONF.1 seam) that will gate autonomy; `citation` grounds every answer in the file. Get the capture shape
right now even though approval/audit UIs come later.

---

## 1. Context — what exists (build ON this)

- **Models (FND.7):** `MatrixColumn { id, projectId, question, createdBy, createdAt }`; answers live in
  `File.extracted` (Json) **keyed by columnId** (reserved for exactly this). `File.text` (FILE.2) is the per-file
  source text to answer from. File has no `orgId` — scope through `project.orgId`.
- **Runtime (ART.1/ART.2):** `ModelClient` DI (`AnthropicModelClient` real / `FakeModelClient` offline), structured
  output via Zod, `runAgent`. Reuse the client + the Zod discipline — do NOT add a second model path.
- **FILE.2 patterns:** worker-or-in-process execution, DB/env-gated verify, idempotent writes, org isolation.

## 2. Goals

1. `POST /api/projects/:id/columns { question }` — RBAC-gated, org-scoped: create a `MatrixColumn`, then extract an
   answer to `question` for **every File in the project** from its `File.text`, storing each in
   `File.extracted[columnId]` as `{ value, citation, confidence }`.
2. A **structured extraction call** over `File.text` (Zod-validated `{ value, citation, confidence }`) using the
   `ModelClient` — deterministic under `FakeModelClient` so it runs offline/CI.
3. **Matrix read** `GET /api/projects/:id/matrix` → files (rows) × columns × answers, for MTX.2.
4. **Re-run** a column and **backfill** existing columns for the seeded files, idempotently.
5. **Seed** a couple of through-line columns with per-file answers so MTX.2 renders populated.

## 3. Non-goals (explicit)

- **The matrix screen** (sticky-header table + ask-across-files bar + citation-aware side agent) → MTX.2.
- **Cross-file / multi-hop reasoning** — per-file extraction only (one file → one answer per column).
- **Auto-answering existing columns on every future upload** — provide the backfill/re-run path; a FILE.2→MTX.1
  auto-hook is a flagged follow-up, not required here.
- **Approval / audit UI** — leave the `/// RBAC.4` (approve an answer) + `/// AUDIT.3` (immutable log) + `/// CONF.1`
  (calibration) seams; store the fields, don't build the surfaces.
- **The general search index** — this writes `File.extracted`, not `SearchDoc` (that's FILE.2).

## 4. Data model

Re-use `MatrixColumn` + `File.extracted` — **no schema change**. Define the answer shape as a shared Zod type:

```
ColumnAnswer = z.object({
  value:      z.string(),               // the extracted answer ("" / "n/a" when the file doesn't address it)
  citation:   z.string(),               // a short verbatim quote/span from File.text grounding the answer
  confidence: z.number().min(0).max(1), // calibrated; low = flag for human review (CONF.1 seam)
})
// File.extracted : Record<columnId, ColumnAnswer>
```
Add `/// CONF.1` + `/// AUDIT.3` pointer comments where the answer is written. `prisma validate` clean; no migration.

## 5. Extraction engine (`packages/agents` — reuse the ModelClient)

- `extractColumn(model: ModelClient, fileText: string, question: string): Promise<ColumnAnswer>` — a single
  structured-output call: system prompt = "answer the question from ONLY the provided document text; quote the
  span you used; if the document doesn't address it, value:'n/a' with low confidence; never invent." Parse with the
  `ColumnAnswer` Zod schema; **try/catch** — a parse/model failure yields a low-confidence `{value:"", citation:"",
  confidence:0}` for that file, never aborts the batch.
- `FakeModelClient` returns a deterministic answer (e.g. derived from the question + a snippet of `fileText`) so the
  pipeline + verify are stable offline. `AnthropicModelClient` used only when the key env is set.
- Truncate `fileText` to the model's input budget; the answer must cite from the provided text.

## 6. Job (worker-or-in-process, like FILE.2)

- **Queue** `matrix-extract` on Redis. Adding a column enqueues one fan-out over the project's files.
- **Fan-out:** for each File in the project (org-scoped via `dbForOrg(orgId)` + `project.orgId`), run
  `extractColumn(File.text, question)`; collect with **`Promise.allSettled`** (one file failing never aborts the
  rest); write each answer to `File.extracted[columnId]` with an **idempotent merge** (set/replace only that
  columnId's key — never clobber other columns' answers).
- Files with empty `File.text` (unprocessed / binary-skipped) get an explicit low-confidence `n/a`.
- In-process path for verify/backfill when Redis is absent (mirror FILE.2).

## 7. API surface (`apps/web`)

- `POST /api/projects/:id/columns` — `requireRole()` line 1 (contributor+); org-scoped; create `MatrixColumn`,
  enqueue the fan-out, return the column **immediately** (answers fill in async — MTX.2 shows an "extracting" state).
- `POST /api/projects/:id/columns/:columnId/rerun` — re-answer a column (idempotent).
- `GET /api/projects/:id/matrix` — files (rows: name, type, linkedTo) × columns (question) × `File.extracted[columnId]`
  answers (value + citation + confidence), org-scoped read for MTX.2.
- `DELETE /api/columns/:id` — RBAC-gated; removes the MatrixColumn and its answers from `File.extracted` (that key).

## 8. Seed — richness = mock richness

- On a through-line project (the ECO-318 / NCR-118 file set from FILE.1's seeded files), seed **2–3 MatrixColumns**
  matching the spec's examples — e.g. "Cost / spec impact", "Agent flag", "Owner" — with a per-file `ColumnAnswer`
  (value + a real citation from the seeded file text + a confidence spread, at least one low-confidence "flag for
  review"). Idempotent. So MTX.2 renders a populated matrix with citations + a review flag out of the box.

## 9. Tenancy · moat invariants (DoD-blocking)

- **Isolation:** columns + answers reached only through `project.orgId`; one tenant's matrix never leaks to another.
- **Propose→approve→audit:** answers are **agent-drafted proposals** — store `confidence` + `citation`; leave the
  `/// RBAC.4` (approve) + `/// AUDIT.3` (immutable input·output·model·confidence·approver) + `/// CONF.1`
  (calibration) seams. Do not surface an answer as "approved" — that's a later story.
- **Never invent:** the prompt + schema force a citation from the provided text; no-answer → `n/a` + low confidence,
  not a hallucinated value. (guardrails.config: never fabricate a source.)
- **Feeds-the-loop:** extracted answers + confidence + (later) human approvals are training signal for MEM.1/LOOP —
  shape the capture now; leave the `/// MEM.1` seam.

## 10. Verification + gate

- `src/scripts/verify-mtx-1.ts` (DB-gated like siblings; pure-logic checks always run; uses FakeModelClient — no key):
  1. `extractColumn` returns a Zod-valid `ColumnAnswer` (value + citation + confidence∈[0,1]); a forced model/parse
     failure yields the low-confidence fallback, no throw.
  2. `POST /columns` creates a MatrixColumn and (in-process) fans out: every File in the project gets an answer under
     that columnId in `File.extracted`; other columns' answers are untouched (idempotent merge).
  3. A file with empty `File.text` gets an explicit low-confidence `n/a`.
  4. `GET /matrix` returns rows × columns × answers with citations; a cross-org project id returns nothing.
  5. Re-run replaces only that column's answers; the seeded columns include a low-confidence "flag for review".
- `docs/manual-checks.md` entry (open a project → add a column via the ask bar → answers appear per file — MTX.2).
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all`;
  tsc clean; verify:all green (FakeModelClient, no live Redis/DB in CI); `prisma migrate status` clean; commit + push;
  confirm GitHub Actions on `main` green.

## 11. Review gate

**Stop after MTX.1** and show me: (a) the `ColumnAnswer` Zod shape + `extractColumn` (Fake path), (b) a project where
adding a column answers every file into `File.extracted[columnId]` with citations + confidence, (c) the seeded
matrix from `GET /matrix` (incl. a low-confidence flag), and (d) verify-mtx-1 output — before continuing to MTX.2.

---

### Completeness check (6-point)
1. Story + spec ref — MTX.1, §3.3/§4.8, E4 row 42. ✓
2. Every requirement — POST /columns + fan-out extraction, structured ColumnAnswer, matrix read, re-run/backfill, seed. ✓
3. DoD — org isolation, RBAC on writes, verify + manual-checks, tsc clean, CI gate, migrate clean, no schema change. ✓
4. Real deps — FILE.2, ART.1/2, FND.7. ✓
5. Moat flagged — confidence + citation capture, propose→approve→audit seams (RBAC.4/AUDIT.3/CONF.1), never-invent, MEM.1 seam, feeds-the-loop. ✓
6. Review gate — §11. ✓
