# PRD — IO.1 · Universal spreadsheet import/export + AI-assisted extraction

**Story:** IO.1 — a **horizontal** import/export capability: create/update **any** entity from a spreadsheet
(CSV/xlsx), round-trip export, bulk-update, and an **AI-verified import** (an agent maps a messy file + flags
anomalies; a human approves). It generalizes the import pattern we already ship — it does **not** introduce a
parallel importer.
**Spec ref:** extracted from a design partner's requirements (`specs/horizontal-prd-candidates.md`, Tier 1).
**Pri/size:** P1 · L (phased). **Track:** Moat spine / platform-horizontal (E12-adjacent — AI extraction +
human approval feeds the loop). **Depth:** Full CPRD. **Deps:** PLM.2 `importUnits` (`packages/db/src/plm/
import.ts`), MTX.1 extraction (`packages/agents/src/matrix/extract.ts` + `matrix-extract` job), FILE.1 storage
(`packages/db/src/storage.ts`), the agent runtime (propose→approve→audit), RBAC/`decide()`, AUDIT.1.

## Non-negotiable — BUILD ON WHAT EXISTS (do not reinvent)

This is the point of the story. Concretely:
1. **Extract, don't duplicate.** Lift the internals of `importUnits` (parse · header-map · dry-run · row-level
   errors · idempotent upsert · no-partial-writes) into a **shared `importEntity` core**. Then **`importUnits`
   becomes a thin caller** of that core — **its behavior and signature must not change** (`verify:plm-2` stays
   green, byte-for-byte outputs). No second CSV parser; reuse `import.ts`'s `parseCsv`.
2. **Reuse MTX.1 for the AI layer** — the AI-verify/AI-map pass calls the existing `extractColumn` / matrix
   extraction primitive; do not add a new extraction path or a new model client.
3. **Reuse FILE.1** for the uploaded file blob; **reuse the agent runtime** (propose→approve→audit) for the
   AI-verified path — an AI-mapped/flagged import is a **proposal a human approves**, never an auto-write.
4. **No new heavy deps** beyond an xlsx parser if xlsx is in scope (CSV needs none — `parseCsv` exists).
A reviewer must be able to see that IO.1 is `importUnits` generalized + MTX.1 + FILE.1 wired together — not a new
subsystem.

## Why (moat framing)

"Own the context / relevance beats volume" applies to *ingest* too: the fastest path to value for a hardware team
is getting their real BOMs/parts/POs *in*, verified. The **AI-verified import** (agent proposes a column mapping +
flags anomalies → human confirms) produces **labeled human decisions on messy real data** — which is exactly the
substrate the learning loop compounds on. So IO.1 is horizontal *and* moat-aligned (it feeds `data → memory →
better proposals`), not table-stakes plumbing.

## Scope — phased (don't boil the ocean)

**Phase 1 (this story) — the reusable core + AI-verify on 2 entities:**
- `importEntity(db, { entity, source, mapping?, dryRun })` — the generalized core (the `importUnits` contract).
- Register **2 entities** as the proving pattern: keep **Units** (via the refactored `importUnits`) + add one
  more high-value one (**Parts/Inventory** or **BOM lines** — pick per the registry shape). A tiny per-entity
  descriptor (columns · keys · zod row schema · upsert) is the only per-entity code.
- **AI-verify pass (optional, MTX.1):** given a messy file with unknown headers, the agent proposes a
  column→field **mapping** + flags suspect rows, with **calibrated confidence**; the human reviews the mapping in
  a dry-run preview and **approves** before any write (propose→approve→audit). No mapping = the file is treated
  as already-clean (current `importUnits` behavior).
- **A shared import UI surface** (upload → dry-run preview with row errors + the AI-proposed mapping → confirm)
  reused across the registered entities.

**Phase 2 (follow-up) — export + bulk-update:** round-trip **export** (download the exact shape you can
re-upload) and **bulk-update** existing rows by key. **Phase 3:** register more entities + generalize the UI.
(Phase 2/3 are named here for shape; **build only Phase 1** now.)

## Data / contract (identical to `importUnits`)

`importEntity` returns `{ dryRun, created, updated, errors: RowError[], totalRows }`; **dry-run defaults on** for
previews; **no partial writes** (validate all → write valid set atomically or nothing on a hard failure per the
existing contract); **idempotent** upsert by the entity's natural key; **org-scoped** (`dbForOrg`). Row errors
carry `{ row, column?, message }`.

## Guardrails

Org-scoped (`dbForOrg`) · **RBAC on the write** (`requireRole`/`decide()` — imports mutate) · dry-run default for
previews · idempotent · **no partial writes** · AI-mapped import is **propose→approve** (never auto-writes) with
CONF.1 confidence + AUDIT.1 on the committed import · **reuse `import.ts`/`parseCsv`, MTX.1 `extractColumn`,
FILE.1** (no parallel systems) · `importUnits` unchanged · additive only, no schema change (imports write
existing models) · migrate clean · no new heavy deps for CSV.

## Verify + gate (`src/scripts/verify-io-1.ts`)

1. **`importUnits` unchanged** — its outputs are byte-identical after the refactor; `verify:plm-2` stays green
   (this is the "build-on-top" proof).
2. **Generic core works on a 2nd entity** — same contract (dry-run, row-level errors, idempotent, no partial
   writes), org-scoped (a 2nd org can't be written into).
3. **AI-verify (MTX.1)** — a messy file with unknown headers yields an agent-proposed mapping + flagged rows as a
   **proposal with calibrated confidence**; nothing is written until the human confirms; the confirmed import
   writes + audits. Uses the existing extraction primitive (assert no new extraction path).
4. **Idempotent + no-partial-writes** hold on a re-run and on a mixed valid/invalid file.
5. Reuse proof: no second CSV parser; MTX.1 + FILE.1 are the extraction/storage seams used.
6. a11y 0 on the import UI route; existing PLM/MTX/FILE/RBAC/AUDIT verifies stay green; migrate clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after IO.1 Phase 1; show: `importUnits` byte-unchanged + `verify:plm-2` green (the build-on-top proof); the
generic core importing a 2nd entity with the same dry-run/row-error/idempotent contract; the AI-verify flow (MTX.1
proposes a mapping + flags rows → human approves → audited write, nothing auto-written); and confirmation no
parallel parser/extractor/storage was introduced.
