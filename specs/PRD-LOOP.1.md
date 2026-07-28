# PRD — LOOP.1 · Learning-loop writeback (outcomes → memory → better proposals)

**Story:** LOOP.1 — close the learning loop's **capture + feedback** edges: when a human decides an agent
proposal (approve / reject / override / later reversal), write a structured **outcome episode** into operational
memory and expose it as a clean **labeled substrate**, so that (a) MEM.2 auto-injects "last time we saw this,
here's what the human did" into future similar proposals, (b) CONF.1 has real labels to recalibrate against, and
(c) TRUST.1's track record is fed. **Model *retraining* stays stubbed** (SLM/later) — LOOP.1 makes the data flow
real, not the training. This is the `data → memory → models → better proposals → outcomes → data` loop, wired for
Record.
**Spec ref:** CLAUDE.md ("feeds-the-loop test"; "learning loop stubbed" but "shape these correctly from day one";
"only L2 compounds — it is the moat"); `specs/architecture-learnings.md` (L2 learning loop). **Pri/size:** P1 · M.
**Track:** Moat spine (E12–E14) — the keystone. **Depth:** Full CPRD. **Deps:** MEM.1/MEM.1a (store + recall),
MEM.2 (auto-injection), CONF.1 (consumes labels), AUDIT.1 (the decision events), TRUST.1 (reads track record),
RBAC.4/5 (`decide()`).

## Why

The moat is L2 — the compounding intelligence layer — and its engine is the loop: work produces outcomes,
outcomes become memory + labels, memory + labels make the next proposal better, which produces more outcomes.
Today the *retrieval* (MEM.1), *injection* (MEM.2), *calibration* (CONF.1) and *trust* (TRUST.1) nodes exist, but
the **writeback edge is missing**: a human approves or overrides a proposal and that verdict dies in the audit
log — it never becomes a memory the next proposal can learn from, or a label CONF.1 can calibrate against. LOOP.1
wires that edge. It's the difference between a system that *has* memory and one that *accumulates* it. Nothing
here retrains a model (that's SLM/LOOP.2) — it makes the **labeled substrate flow** so retraining plugs in later
without a retrofit (the top capture-fidelity risk).

## Goals

1. **Outcome writeback** — on every `decide()` verdict (approve / reject / override / reversal), write a
   structured **outcome episode** into the operational-memory store (MEM.1): the proposal, the human's verdict,
   the **delta** (did the human change the agent's output? by how much?), the subject entity, model + stated
   confidence, provenance (the AUDIT.1 entry id), timestamp, org. Immutable-linked to the audit entry; never
   overwrites it.
2. **Feeds the next proposal** — because the outcome is now a memory episode, **MEM.2 auto-injects it** into a
   future similar situation ("this matches PO-9007 — last time the human overrode the agent's supplier"). Prove
   the closed edge end-to-end: override a proposal → a later similar proposal's context carries that override.
3. **Labeled substrate for calibration** — a clean, read-only `decisionOutcomes(db, { agent?, actionKind?, since? })`
   returning the typed labeled set (proposal confidence vs. human verdict = the label) that CONF.1's calibration
   can consume. LOOP.1 **provides** the labels; it does not itself refit the model (CONF.1 owns fitting) — but the
   pipe from outcomes → calibration data is real and tested.
4. **Legible + demoable** — a `loop` trace line on writeback ("recorded outcome: eco.release OVERRIDDEN → memory
   ep MEM-…"), and the injected-precedent path is visible in the agent trace (ties to MEM.2's `memory` line).

## Non-goals (flag — the stub boundary)

No model **retraining / fine-tuning** (SLM / LOOP.2) · no **autonomy** change (TRUST.1's ceiling + build-only-
Record hold — outcomes inform, humans still decide) · no change to the memory **store schema** beyond an outcome
episode *kind* (reuse MEM.1's episode shape; add a table only if a single additive `///` model is truly needed) ·
no change to CONF.1's fitting logic (LOOP.1 supplies labels, CONF.1 fits) · no rewrite of AUDIT.1 (LOOP.1 reads it
+ links to it, never mutates it).

## Approach

- A `recordOutcome(db, decision)` hook called **from within `decide()`** (or immediately after, same transaction
  boundary) that composes the outcome episode and writes it to the MEM.1 store, org-scoped, linked to the audit
  entry. Idempotent per audit-entry id (re-running doesn't double-write).
- Reuse MEM.1's episode representation + embedding path so the outcome is immediately **recall-able by MEM.2** —
  no parallel store. The episode's text/keys are chosen so graph-proximity + vector recall surface it for a
  matching future subject.
- `decisionOutcomes(...)` — a thin read over those episodes (or over AUDIT.1 joined to the episode), typed as
  `{ agent, actionKind, subjectRef, statedConfidence, verdict, delta, at, auditRef }[]`, org-scoped, read-only.
- Wire the `loop` trace line; keep everything propose→approve→audit.

## Guardrails

Per-tenant isolation (outcomes written + read only within the org) · immutable audit log untouched (LOOP.1 links,
never mutates) · idempotent writeback (no double-count — protects TRUST.1's metrics + CONF.1's labels) · outcomes
**inform**, humans still decide (no autonomy; TRUST.1 ceiling + build-only-Record hold) · no model retraining ·
no `db push` (any hook is a single additive nullable `///` field/model via `migrate dev`) · reuse the MEM.1 store
(no parallel memory) · self-cleaning verify (MIGRATE.1).

## Verify + gate (`src/scripts/verify-loop-1.ts`)

1. **Writeback:** a `decide()` verdict writes exactly one outcome episode to the MEM.1 store, linked to the audit
   entry, org-scoped; **idempotent** (re-running the same decision does not double-write).
2. **Closed loop (the headline):** override an agent proposal for a subject, then assemble context (MEM.2) for a
   **later similar** subject → the assembled block **contains that override** — proving outcome → memory → next
   proposal without a manual recall.
3. **Labeled substrate:** `decisionOutcomes(...)` returns the typed labels (stated confidence vs. verdict),
   org-scoped (2nd org → zero), read-only (no mutation path); shape is consumable by CONF.1's calibration.
4. **Stub boundary honored:** no retraining runs; CONF.1's fitted model is unchanged by LOOP.1 itself; TRUST.1
   metrics reflect the (idempotent, non-double-counted) outcomes; AUDIT.1 is unmutated.
5. Isolation + existing MEM.1/MEM.2/CONF.1/TRUST.1/AUDIT.1/EVAL verifies stay green; migrate status clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Live acceptance (the demo that proves the moat)

Override an agent's proposal once. Later, on a similar situation, ask the agent a bare question — its context now
carries "last time the human overrode this," visible in the `memory`/`loop` trace, and its proposal reflects the
correction. The system didn't just remember a fact — it **learned from a decision**. That's L2 compounding.

## Review gate

Stop after LOOP.1; show: the `loop` trace on a `decide()` writeback (outcome → memory episode), the closed-loop
proof (override → MEM.2 injects it into a later similar proposal), `decisionOutcomes` returning the org-scoped
labeled substrate, and confirmation nothing retrained / no autonomy was granted / AUDIT.1 unmutated.
