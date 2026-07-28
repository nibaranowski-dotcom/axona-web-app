# PRD — PLM.12 · Change Orders list

**Story:** PLM.12 — the change queue: the list the `CHANGE ORDERS` breadcrumb on `Change Order.dc.html` dead-ends
to. Answers Q5 at fleet scale — what's proposed / in review / approved / released, what each change touches, and
**what's waiting on my approval.**
**Screen (1:1 source):** `design/prototypes/axona-v2/Change Orders.dc.html` — copied in from the **v11** design
export (`~/Desktop/Axona App_v11`). **Route:** `/changes` · list (back-arrow to Engineering + `CHANGE ORDERS`
mono eyebrow). **Child:** `Change Order.dc.html` (PLM.9) — its breadcrumb now resolves to this list. **Pri/size:**
P1 · S–M. **Track:** PLM (E15). **Depth:** Condensed–full CPRD. **Deps:** PLM.1/PLM.9 (`ChangeRequest`/ECO +
reviewers + effectivity), ONT.1 (`affectedUnits`/blast-radius traversal), RBAC (current user), CONF.1.

## How to read this (CLAUDE.md rule)

Wire-up defers to the design. `Change Orders.dc.html` is the sole truth for layout, the stat strip, columns, and
copy. This PRD specifies only **data source · actions · verify · DoD** — implement the file 1:1; design wins on
conflict (flag it).

## Data

- Reuse **`ChangeRequest`/ECO** (PLM.1/PLM.9): `code`, `title`, `type` (`SUPERSEDE · REVISE · DEVIATION`),
  `status` (`draft · in_review · approved · released`), `effectivity` (from serial or date), `reviewers[]` with
  per-reviewer approval state, `source` (NCR · lot review · design study), and `draftedByAgent` + `confidence`
  when agent-originated. Add only what's missing, additively (`migrate dev`, never `db push`).
- **Affected-units count** is a **computed traversal** (effectivity + affected part revisions → units) — **shared
  with the blast-radius traversal** (`affectedUnits`, ONT.1), not a stored scalar. Render heavier in ink past a
  threshold so large-impact changes read first (per the design).
- **"Awaiting my approval"** is a **per-user server-side query** over `reviewers[]` (the current user is a pending
  reviewer) — this is the number the screen exists for. Make it **first-class in the API**, not a client-side
  filter; it drives both its own stat tile and a filter.
- **Stat strip:** counts by status and by type + the awaiting-me number (per the design).

## Actions

- **Filters compose server-side** — status × type × awaiting-me, reflected so the table query runs on the server
  (not client-only).
- **Row → `Change Order.dc.html`** (PLM.9). **Approval lives on the detail page only** — the list routes, it does
  **not** approve inline; the gated `decide()` action stays on the detail.
- **Agent-drafted rows** carry an `AGENT-DRAFTED · <confidence>` tag (CONF.1) + their source; still propose→approve.

## States / empty

Row statuses draft · in_review · approved · released (design's treatment; functional green for approved/released,
ink for at-risk — no red). A real **"no change orders yet"** empty state (secondary — change control is normally
populated; no import-first needed).

## Guardrails

Org-scoped (`dbForOrg`) · affected-units is the **shared** blast-radius traversal (no parallel/hardcoded count) ·
awaiting-me is a **server-side** per-user query (first-class API, not client filter) · filters run server-side ·
**no approval action on the list** (approval stays gated on the detail via `decide()`) · additive migration only
(no `db push`) · v2 tokens · no emoji · no invented reds · agent-drafted rows are assistance (propose→approve).

## Verify + gate (`src/scripts/verify-plm-12.ts`)

1. `/changes` lists the seeded change orders with code · title · type · status · affected-units · effectivity ·
   approval state; a row routes to `Change Order.dc.html`.
2. **Affected-units count** on a row equals the blast-radius traversal for that change (same façade), org-scoped.
3. **Awaiting-me** is a server-side per-user query: a user who is a pending reviewer sees the change in the
   awaiting-me tile/filter; a non-reviewer does not — and the count is computed server-side (assert it's not a
   client filter over the full list).
4. **Filters compose** server-side (status × type × awaiting-me) and are reflected in the query.
5. **No inline approval:** the list exposes no `decide()`/approve mutation; approval remains only on the detail.
6. a11y 0 on the route; existing PLM/ONT/RBAC/CONF verifies stay green; migrate status clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after PLM.12; show: the change queue at `/changes` (stat strip + status-led rows), the affected-units count
matching the blast-radius traversal, the awaiting-me query working per-user (server-side), and confirmation the
list routes to the detail without any inline approval.
