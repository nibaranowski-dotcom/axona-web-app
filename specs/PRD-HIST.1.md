# PRD — HIST.1 · Per-record audited change history (universal, on AUDIT.1)

**Story:** HIST.1 — a **horizontal** "History" panel on every entity detail view: the record's full, immutable
**audited timeline** (who · did what · when · before→after; agent entries show model + confidence). It surfaces
the AUDIT.1 log we already own, filtered to one record — the "tracking all changes in all docs" requirement — and
makes every record **self-documenting**. It pairs with LINK.1 (Connected objects) as the second detail-view rail:
*what this is linked to* + *what's happened to it*. Generalizes AUDIT.1; does **not** build a second audit store.
**Spec ref:** `specs/horizontal-prd-candidates.md` (Tier 1). **Pri/size:** P1 · S–M. **Track:** platform-horizontal
(rides the moat's AUDIT.1 spine). **Depth:** Full-ish CPRD. **Deps:** AUDIT.1 `AuditLog` (`targetType`+`targetId`
already on every row) + `writeAudit` + the existing audit query (`apps/web/.../audit`, `AuditView.tsx`), AUDIT.3
(model/confidence enrichment), RBAC (read), LINK.1 (the sibling rail).

## Non-negotiable — BUILD ON AUDIT.1 (do not reinvent)

Same discipline as IO.1 / LINK.1:
1. **Reuse the log + the existing reader.** `AuditLog` already has `targetType` + `targetId` on every entry. Add
   a shared **`getRecordHistory(db, { targetType, targetId, cursor? })`** that reuses the **same query path** the
   audit list already uses (the audit API filters by `targetType`; extend it to also filter `targetId`, or add
   the scoped query alongside it) — **no new audit store, no second reader.**
2. **Reuse AuditView's rendering conventions** (actor label, dotted action verb, summary, the AUDIT.3
   model/confidence badge on agent entries, before→after from `inputs`/`output`). A shared `<RecordHistory>`
   timeline component; don't fork the audit-row rendering.
3. **Read-only, immutable.** HIST.1 never writes or mutates the log — it only reads. (Writes still happen via
   `writeAudit` at the action sites; HIST.1 adds no new write path.)
A reviewer must see HIST.1 = the AUDIT.1 log filtered by target + a shared timeline panel — not a new audit system.

## Scope

- **`getRecordHistory(db, { targetType, targetId, cursor? })`** → the record's audit entries newest-first,
  paginated, org-scoped (`dbForOrg`); each `{ actorType, actorLabel, action, summary, inputs?, output?, model?,
  confidence?, createdAt }`.
- **A shared `<RecordHistory>` timeline panel:** actor · action · summary · relative time; expand an entry for
  **before→after** (`inputs`→`output`); agent entries show the AUDIT.3 **model + calibrated confidence** badge;
  empty state for a record with no history.
- **Surface it on the same entity detail views as LINK.1** (as the sibling secondary rail): Unit, NCR/RCA, Change
  order (ECO), Configuration, Test run, PO/Procurement, Part/Inventory. Match the existing layout — secondary
  rail, don't disturb the signature artifact or the LINK.1 panel.
- v2 tokens · no emoji · Lucide thin icons · a11y (timeline is a labeled list, keyboard-operable).

## Guardrails

Org-scoped · **read RBAC** · **reuse `AuditLog` + the existing audit query** (`getRecordHistory` shares the reader;
no new store/reader) · **read-only / immutable** (never mutate the log; no new write path) · reuse AuditView's row
rendering (no fork) · one shared panel · **no schema change** (`AuditLog` exists; `targetType`/`targetId` already
present) · migrate clean · additive only · pairs cleanly with the LINK.1 rail (shared detail-view layout).

## Verify + gate (`src/scripts/verify-hist-1.ts`)

1. **Build-on-top proof:** `getRecordHistory` uses the existing `AuditLog` reader/query (assert no new audit
   store/model and no second reader path); existing `verify:audit-1/2/3` stay green.
2. `getRecordHistory` returns the seeded trail for a known entity — e.g. **ECO-318** (its `decide()` lock/approve
   entries) or **NCR-118** — newest-first, paginated, org-scoped (a 2nd org → 0).
3. **Agent entries** render the AUDIT.3 **model + confidence** (an agent-authored entry shows its model + CONF.1
   confidence); before→after renders from `inputs`/`output`.
4. The `<RecordHistory>` panel renders on ≥5 detail views alongside the LINK.1 rail without disturbing the
   signature artifact; empty state on a record with no entries.
5. **Read-only:** HIST.1 adds no write/mutation path to the audit log.
6. a11y 0 on the touched routes; existing AUDIT/PLM verifies stay green; migrate clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after HIST.1; show: the `<RecordHistory>` panel on 2–3 detail views (Unit/NCR/ECO) — newest-first timeline
with an agent entry's model+confidence and a before→after expand; org-scoped isolation; and confirmation it reads
the existing AUDIT.1 log (no second store/reader, no new write path), with `verify:audit-*` green.
