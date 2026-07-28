# PRD — PLM.11 · Configuration detail (full page)

**Story:** PLM.11 — the full-page view of one named configuration, opened from the Configurations list. Answers
Q2 for a single config: exact HW + SW content, baseline/lock state, how many units run exactly this, how it
differs from the prior baseline, and which changes produced it.
**Screen (1:1 source):** `design/prototypes/axona-v2/Configuration.dc.html` — copied in from the **v11** design
export (`~/Desktop/Axona App_v11`). **Route:** `/configurations/:code` · detail, breadcrumb
`Engineering › Configurations › :code`. **Parent:** `Configurations.dc.html` (PLM.10) — each card becomes a link
into this page. **Pri/size:** P1 · M. **Track:** PLM (E15). **Depth:** Full-ish CPRD (carries a gated
dual-approver action). **Deps:** PLM.1 (`ConfigurationVersion`, `resolveConfigAt`, registry filter), PLM.4
(`asBuiltDiff` alignment logic), PLM.9/`Change Order.dc.html` (change history links), RBAC.5 + `decide()`,
AUDIT.1, CONF.1. **Flagged dep:** D4/BOM screen (PLM.13) — not built; see below.

## How to read this (CLAUDE.md rule)

Wire-up defers to the design. `Configuration.dc.html` is the sole truth for layout, stat strip, copy, and
artifact choice. This PRD specifies only **data source · actions · verify · DoD** — implement the file 1:1 on the
DS.1 primitives; if PRD and design conflict, the design wins (flag it).

## Data

- Reuse **`ConfigurationVersion`** (PLM.1) — resolved HW + SW content, baseline/draft state, matching-units.
  Extend **additively** (via `migrate dev`, never `db push`) only if the fields below are missing: `baselinedAt`,
  `baselinedBy`, `supersedes` / `supersededBy` (self-relation), and a **frozen manifest snapshot** captured at
  lock time (same immutability pattern as `TestRun.configSnapshot` — the baseline content is frozen, not a live
  re-resolve). Draft configs resolve live; baselined configs render their frozen snapshot.
- **Manifest (the hero):** `hwPositions[]` (position → part revision → qty) + `swItems[]` (kind → name → version →
  cert state). Mono, itemized.
- **Matching-units count:** the **same query** that powers the registry's config filter — deep-link to
  `/units?config=:code`, do not duplicate the logic.
- **Diff:** positional comparison between two `ConfigurationVersion`s (version selector) — **reuse PLM.4's
  `asBuiltDiff` alignment**; changed lines in **ink** (old revision struck through), matched lines de-emphasised.
- **Change history:** the ECOs that produced or are queued against this config (with effectivity) → link to
  `Change Order.dc.html` (PLM.9).

## Actions

- **Lock / baseline** — a **gated, two-approver** action: locking a draft freezes its manifest (immutable);
  **unlock requires a second approver**. Model as propose→approve through **`decide()`** (RBAC-gated, audited to
  AUDIT.1) — never a bare toggle. A locked baseline's contents cannot mutate.
- Open the version diff (selector); open a change order (change history); jump to the filtered registry
  (matching units).
- **Agent seam:** a configuration agent may flag drift (e.g. an uncaptured field swap) as a **proposal with
  calibrated confidence** (CONF.1), **dismissible**, propose→approve. The screen is fully usable with the agent
  off.

## States

`draft` (lock available) · `baseline` (locked; unlock gated / second approver) · `superseded` (points to its
successor). Render each distinctly per the design (functional green for baseline/locked; ink for superseded — no
red).

## Flagged dependency — D4 / BOM screen (PLM.13)

The "view all positions in the BOM" affordance has **no destination** — the BOM screen (D4) was never built. **Do
not scope D4 into PLM.11.** Keep the link stubbed to the Engineering hub (current behavior) with a `/// PLM.13-BOM`
pointer, and log **PLM.13 (BOM + revision history)** as the follow-up. Flag if the v11 `.dc.html` assumes a live
BOM route.

## Guardrails

Org-scoped (`dbForOrg`) · additive migration only (no `db push`; only the missing baseline/lineage fields + frozen
snapshot) · lock/unlock is RBAC-gated + **dual-approver** via `decide()` + audited · a baselined manifest is
immutable (frozen snapshot, not a live join) · matching-units + diff **reuse** existing logic (no parallel query)
· v2 tokens · no emoji · no invented reds · agent output is assistance only (propose→approve, dismissible).

## Verify + gate (`src/scripts/verify-plm-11.ts`)

1. `/configurations/:code` renders the resolved manifest (HW positions + SW items) for the seeded config; a
   Configurations-list card links here.
2. **Frozen baseline:** a baselined config renders its frozen snapshot — changing an underlying part revision does
   **not** alter a baselined config's manifest (assert immutability); a draft config resolves live.
3. **Matching-units count** equals the registry filtered by that config code (same query), org-scoped.
4. **Diff** between two versions renders HW+SW deltas via the as-built alignment (changed in ink, matched
   de-emphasised).
5. **Lock is gated + dual-approver + audited:** a single approver cannot finalize; the action routes through
   `decide()` and writes an AUDIT.1 entry; a locked config is immutable.
6. a11y 0 on the route; existing PLM/CONF/RBAC/AUDIT verifies stay green; migrate status clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after PLM.11; show: the Configuration page for a seeded config (manifest + baseline state + matching-units →
registry), the frozen-baseline immutability proof, the version diff, and the lock action routing through
`decide()` (dual-approver) with its audit entry — plus confirmation D4/BOM is flagged (PLM.13), not scoped in.
