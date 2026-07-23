# PRD — AUDIT.4 · Implement `/audit` against its first real design

**Story:** AUDIT.4 — Rebuild the audit-trail screen 1:1 against `Audit Trail.dc.html`, which arrived in the v8
export. **Preserve CONF.1's ReliabilityPanel.**
**Pri/size:** P1 · S–M. **Track:** Core/moat surface. **Depth:** Condensed (UI wire-up).
**Deps:** AUDIT.2 (the existing screen + read model), AUDIT.3 (model·confidence·approver), CONF.1
(ReliabilityPanel + calibrated confidence), UX.11 (table truncation), DESIGN.2 (the imported mock).

## Why

`/audit` is the one screen that was built **without a design** — AUDIT.2 shipped it from a PRD alone. The v8
export finally supplies `Audit Trail.dc.html`, so the screen can now meet the same 1:1 standard as every other
route. This matters more than a cosmetic pass: the audit trail is the **trust surface** — it's what answers
"I'm not letting an AI touch my supply chain" in a demo — and it's currently the least design-considered screen
in the product.

## Scope

Implement `design/prototypes/axona-v2/Audit Trail.dc.html` **1:1** on the DS.1 primitives. The `.dc.html` is the
sole truth for layout, structure, stat-strip metrics, copy, and content-shape — do **not** re-derive those from
this doc or from the current implementation.

**Data source is unchanged:** the existing AUDIT.2 read model (org-scoped, paginated, read-only — the log is
append-only; there is no write path from this screen).

## Must survive the rebuild (regressions to avoid)

1. **CONF.1's `ReliabilityPanel`** — the calibration/reliability curve (stated-vs-observed, sampleSize, ECE/
   Brier, the plain-language read) currently lives on `/audit`. It must remain, integrated coherently with the
   new design. If the mock has no obvious slot for it, place it sensibly and **flag the placement** for review
   rather than dropping it.
2. **Calibrated confidence per row** — rows render the calibrated value with the `·raw 0.90` divergence hint
   and the `uncal` marker on cold start (CONF.1). Keep it.
3. **UX.11 truncation** — actor/action/target/approver/summary cells use `min-w-0` + `truncate` + title
   tooltips so nothing collides, **including with the agent pane open** (that was the original reported bug).
4. **UX.5 sticky header** — the column header stays sticky below the topbar without bleed.
5. **Filters** — actor/action/target filtering keeps working.
6. **PROSPECT.2 discipline** — no hardcoded narrative; everything data-driven per org (renders correctly in
   both the investor and prospect tenants).

## Verify + gate (`src/scripts/verify-audit-4.ts`)

1. The screen matches the mock's structure (assert its distinguishing regions exist — derive them from the
   `.dc.html`, not from this doc).
2. `ReliabilityPanel` still renders on `/audit` with its CONF.1 data.
3. Rows render calibrated confidence + the raw-divergence hint + the uncalibrated marker.
4. Truncation holds (no overflow with the agent pane open); sticky header intact; filters work.
5. Read-only — no mutation path introduced; existing AUDIT.2/AUDIT.3/CONF.1 verifies stay green.
6. v2 tokens only · no emoji · no invented reds · data-driven per org.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · a11y 0 on `/audit`;
commit + push; Actions green.

## Review gate

Stop after AUDIT.4; show: `/audit` matching the mock, the ReliabilityPanel still present with real calibration
data, a row showing calibrated-vs-raw confidence, and the table with the agent pane open (no collision).
