# PRD — CONF.1 · Calibrated confidence (confidence that means what it says)

**Story:** CONF.1 — Turn the agent-emitted `confidence` field from decoration into a **calibrated** probability,
grounded in the outcomes the audit log already captures, surfaced on proposals + a reliability view, and
exposed as the gate seam the progressive-trust ladder will read.
**Spec ref:** `specs/architecture-learnings.md` (L2 intelligence spine — "`confidence` is a real calibrated
field that gates autonomy — not decoration"); backlog E13 (CONF). **Pri/size:** P0 · M–L. **Track:** Moat
(E13). **Depth:** Full CPRD — **moat-load-bearing.**
**Deps:** AUDIT.1/AUDIT.3 (immutable log with `confidence` + `approver` + the decide() outcomes), RBAC.4
(`decide()` — the human decision that is the label), MEM.1 (carries an uncalibrated `confidence` seam),
the approval surfaces (PoRow / ECO / policy / credit-note). **Downstream:** TRUST.1 (the progressive-trust
ladder — the autonomy *policy/UI* built on CONF.1's calibrated number + gate), LOOP.1 (the loop closes here).

## The problem (why this is decoration today)

Agents emit a raw `confidence` (0–1) and we render it — "conf 0.83" on a drafted PO. But **nothing measures
whether 0.83 means anything.** A model that says 0.9 on everything and is right 60% of the time is *miscalibrated*,
and right now the product would happily show "0.9" and imply certainty it hasn't earned. The architecture is
explicit that this field must be **calibrated and gate autonomy**, not decorate a card. Until a stated
confidence corresponds to an observed frequency, "AI proposes, human approves" has no principled dial for *how
much* a human needs to scrutinize — and the progressive-trust ladder (TRUST.1) has nothing real to stand on.

CONF.1 makes confidence honest: **when the agent says 0.8, it should be right ~80% of the time** — and where
it isn't, the displayed number is corrected to the empirical reality.

## What "calibrated" means here (concrete, not hand-wavy)

We already capture the ground truth: every gated agent proposal flows through `decide()` and writes an
AuditLog entry with the agent's raw `confidence` **and** the human's decision (APPROVED / REJECTED) + approver.
**The human decision is the label.** Calibration = learning the mapping `raw confidence → observed approval
rate`, per org, from that history, and applying it going forward.

- **Approved** ≈ the proposal was good (the domain's ground truth is the human approver). **Rejected** ≈ it
  wasn't. (This is a proxy, stated honestly — see Guardrails.)
- Fit a **monotonic calibration map** (isotonic regression, or binned reliability with smoothing for small N)
  from raw→calibrated over the org's decided proposals.
- **Cold start is honest:** below a minimum sample size, do NOT fake a calibrated number — show the raw
  confidence flagged **"uncalibrated"**. Calibration earns its label with data, exactly like autonomy earns
  trust with outcomes.

## Goals

1. **Calibration engine** — `calibrate(db, orgId)`: reads decided agent proposals from AuditLog, fits the
   per-org raw→calibrated map, persists it. Idempotent, incremental, **per-tenant** (an org's calibration uses
   only its own outcomes — never another tenant's).
2. **`calibratedConfidence(raw, model)`** — applies the org's map; falls back to raw+`uncalibrated` flag on
   cold start. A pure function over the persisted model (fast, no recompute at read time).
3. **Surface it honestly** — every proposal that shows confidence (PoRow, ECO, credit-note, policy, the agent
   trace, MemoryItem) shows the **calibrated** value with a state: `calibrated` vs `uncalibrated (cold start)`.
   Where raw and calibrated diverge materially, that divergence is the point — an over-confident agent's 0.9
   renders as its true ~0.6.
4. **Reliability view** — a small calibration/reliability surface (a reliability curve + Brier/ECE summary per
   org): "when agents say X%, they're right Y%." This is the *visible proof* that confidence is measured, not
   decorated — the moat made legible.
5. **The autonomy-gate seam** — `meetsAutonomyThreshold(calibrated, threshold)` + the calibrated number are
   what **TRUST.1** reads to build the progressive-trust ladder. CONF.1 provides the calibrated signal + the
   gate check; it does **not** build the ladder or change what's gated.

## Non-goals (flag, don't build)

- **The progressive-trust ladder / autonomy policy UI** → **TRUST.1**. CONF.1 exposes the calibrated number +
  `meetsAutonomyThreshold`; it does not decide autonomy levels or add a ladder surface.
- **Auto-executing above-threshold actions** → later. **Gated stays gated.** CONF.1 informs the human; it never
  flips a money/safety/contract action to auto-approve. (Non-negotiable — the whole product promise.)
- **Retraining the underlying agent models** → LOOP.1 / SLM. Calibration adjusts the *reported* confidence; it
  does not fine-tune the model that emitted it.
- **Multiclass / per-tool calibration granularity** beyond per-org (optionally per action-kind if cheap) →
  later; note the seam.

## Data model (via `prisma migrate dev` — **NEVER `db push`**, MIGRATE.1)

Persist the fitted map per org (small; recomputed from AuditLog, which stays the source of truth):

```prisma
model CalibrationModel {
  id         String   @id @default(cuid())
  orgId      String
  org        Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  scope      String   @default("org")   // "org" now; per-action-kind later (seam)
  // The fitted monotonic map + provenance, as JSON: bin edges, per-bin observed rate + count,
  // sampleSize, fitMethod ("isotonic"|"binned"), Brier, ECE, fittedAt.
  model      Json
  sampleSize Int
  fittedAt   DateTime @default(now())

  @@unique([orgId, scope])
  @@index([orgId])
}
```

- **Add `CalibrationModel` to `TENANT_MODELS`** in `packages/db/src/client.ts` (per-tenant isolation of models
  is a moat invariant — one org's calibration must never touch another's). `migrate status` clean.
- No new columns on AuditLog/MemoryItem — CONF.1 **reads** the existing `confidence`/approver history and the
  `///` CONF.1 seams already left there. (Don't fork the event log.)

## Engine (`packages/db/src/confidence/` or `@axona/agents`)

- `calibrate(db, orgId)` — pull decided agent proposals (AuditLog where actorType=AGENT, has `confidence`, and a
  terminal human decision APPROVED/REJECTED). Fit isotonic (or binned+smoothed for small N). Compute `sampleSize`,
  Brier, ECE. Upsert `CalibrationModel`. Idempotent; safe to re-run; wire into the seed (after MEM.1) so the demo
  has a fitted model. **Per-org only** — the query is org-scoped.
- `calibratedConfidence(raw, model)` — pure map application; returns `{ value, state: "calibrated"|"uncalibrated", raw }`. Cold start (sampleSize < MIN, e.g. 20) → `{ value: raw, state: "uncalibrated", raw }`.
- `meetsAutonomyThreshold(calibrated, threshold)` — boolean gate helper for TRUST.1. CONF.1 ships the helper +
  a sensible default threshold constant; it does **not** act on it.

## Surface

- **On proposals** — the approval surfaces + the agent trace render `calibratedConfidence(...)`: the calibrated
  value, with a small `uncalibrated` marker on cold start. Keep v2 tokens (ink for the number; no invented reds;
  the divergence is shown by the value itself, not a scary color).
- **Reliability view** — a compact calibration panel (reliability curve: stated vs. observed, + sampleSize +
  ECE/Brier) — placed where the moat is inspectable (e.g. an Agents/Trust section or the Audit area). Data-driven
  per org (no hardcoded narrative — PROSPECT.2 discipline). For Nomagic's tenant it reflects *their* outcomes.

## Guardrails / moat invariants

- **Per-tenant isolation of models:** `CalibrationModel` in `TENANT_MODELS`; `calibrate` org-scoped; a second
  org's calibration is fit from **zero** of the first org's data (verify assertion).
- **Honest cold start:** never render a fabricated "calibrated" number below the sample floor — flag
  `uncalibrated`. Calibration is earned, like trust.
- **Gated stays gated:** CONF.1 never auto-approves or auto-executes anything; money/safety/contract remain
  human-gated. The gate helper is advisory input to TRUST.1, not an actuator.
- **The label is a proxy, stated as such:** approve/reject is the ground-truth proxy; document it, and don't
  over-claim (a reliability panel shows sampleSize so the number's weight is legible).
- **Feeds-the-loop:** raw confidence + outcome → calibration → calibrated confidence → better-scrutinized
  proposals. This is the "models read outcomes" edge of the loop; score the work on it.
- Migration via `migrate dev` only; `migrate status` clean; seed + verify self-clean to baseline (MIGRATE.1).

## Verify + gate (`src/scripts/verify-conf-1.ts`)

1. `CalibrationModel` exists + is in `TENANT_MODELS`; `migrate status` clean (authored via `migrate dev`).
2. **Calibration corrects overconfidence:** seed a history where the agent is systematically over-confident
   (e.g. raw ≈0.9 but ~60% approved) → `calibrate` fits a map such that `calibratedConfidence(0.9)` ≈ observed
   (~0.6), not 0.9. Assert the calibrated value is materially below the raw.
3. **Cold start is honest:** with sampleSize below the floor, `calibratedConfidence` returns `state:
   "uncalibrated"` and value = raw (no fabricated calibration).
4. **Monotonic:** the calibration map is non-decreasing (higher raw never maps to lower calibrated).
5. **Per-tenant isolation:** a second org's `CalibrationModel` is fit from zero of the first org's proposals;
   calibrations differ and never cross.
6. Idempotent: re-running `calibrate` yields the same model for the same data.
7. Proposal surfaces + the reliability view render the calibrated value + `uncalibrated` state (no hardcoded
   narrative; data-driven per org).
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · `migrate status`
clean; commit + push; Actions green.

**Live acceptance (the real DoD):** in the running app, a proposal whose agent raw confidence was 0.9 but whose
kind has been historically over-approved-against shows a **calibrated** number below 0.9 with the reliability
view explaining why ("agents said ~90%, were right ~60%, n=…") — and a cold-start kind shows raw + `uncalibrated`.
Confidence now corresponds to reality. (Bonus: it renders correctly + independently in both the investor and
Nomagic tenants — CONF.1 respects PROSPECT.2's data-driven, per-tenant behavior.)

## Review gate

Stop after CONF.1; show: the migration + `CalibrationModel` in TENANT_MODELS, `calibrate` correcting a seeded
overconfident history (0.9→~0.6), the honest cold-start path, per-tenant isolation (two orgs, disjoint
calibrations), the reliability view, and a proposal surface showing the calibrated value — the moment
confidence stops being decoration.
