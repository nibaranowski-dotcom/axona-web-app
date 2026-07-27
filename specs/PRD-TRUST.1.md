# PRD — TRUST.1 · Progressive-trust ladder (earned-autonomy surface)

**Story:** TRUST.1 — a **designed, measured** trust ladder: compute each agent's earned trust *rung* from its
audited track record + confidence calibration, make it legible (per agent, per action-kind), and let `decide()`
*consult* the rung — **without granting any new autonomy on gated (money/safety/contract) actions.** The ladder
is the visible path to Act; it does not, in this story, let anything auto-act that a human gates today.
**Spec ref:** CLAUDE.md ("autonomy is earned via a progressive-trust ladder — a designed, measured surface, not
implicit"; "the propose→approve→audit runtime IS the path to Act — `decide()` + AUDIT.1 are kind-agnostic, so
Act is the same loop with more earned trust"); `specs/architecture-learnings.md` (L2 spine). **Pri/size:** P1 · M.
**Track:** Moat spine (E12–E14). **Depth:** Full CPRD. **Deps:** CONF.1 (calibration), AUDIT.1 (immutable log =
the track record), RBAC.4/5 (`decide()`), MEM.2/EVAL.1.

## Why

The product's north star is Record → Sense → Predict → **Act**, and Act is "the same propose→approve→audit loop
with more *earned* trust." But today trust is implicit: every agent action is gated the same way regardless of
how well that agent has performed. There's no measured notion of "this agent, on this action-kind, has earned a
higher rung." TRUST.1 makes autonomy an **earned, measured, visible** thing — the designed surface CLAUDE.md
calls for — so that when Act is switched on (later, per action-kind, never for money/safety/contract by default),
it rides a real track record, not a vibe. Crucially: **this story builds only the ladder + measurement + gating
hook. It grants no new autonomy.** (Build-only-Record guardrail holds.)

## The ladder (rungs)

A single ordered enum, per `(agent, actionKind)` — kind-agnostic, so it applies uniformly:

1. **SUGGEST** — agent drafts/annotates only; the human does everything. (Cold-start default.)
2. **RECOMMEND** — agent pre-fills a proposal + confidence; human reviews & approves every time.
3. **REVIEW_LIGHT** — for **non-gated, low-risk** kinds only: agent proposes, human can one-click approve a batch;
   still human-in-the-loop, lower friction.
4. **AUTO_BOUNDED** — *reserved / defined but not enabled in this story*: agent may act on a non-gated, low-risk,
   high-confidence action within explicit bounds, human notified + audited. **Gated action-kinds
   (money/safety/contract) can NEVER reach an auto rung** — hard ceiling, enforced in `decide()`.

The rung is **computed, not assigned** — read from the earned track record below. The top auto rung is *modeled*
so the surface is honest about where the ladder goes, but the gate keeps it inert for gated kinds and off by
default for everything (build only Record).

## Measurement (earned from the audit trail — the moat, not a setting)

Per `(agent, actionKind)`, computed org-scoped from AUDIT.1 history + CONF.1:

- **Volume** — count of decided proposals (need a floor before advancing past SUGGEST — no trust from one sample).
- **Approval rate** — approved ÷ decided (human agreement with the agent's proposals).
- **Override/reversal rate** — proposals a human rejected or later reversed (penalizes advancement).
- **Calibration** — CONF.1: is the agent's stated confidence honest? (over-confident history caps the rung).

A pure function `computeTrust(history, calibration) → { rung, metrics, nextRungCriteria }` maps these to a rung
with **explicit thresholds** (e.g. RECOMMEND needs ≥N decided & ≥X approval & calibrated; REVIEW_LIGHT needs
more, and non-gated-kind only). Deterministic, testable, no model call.

## Surface (legible)

- A **trust panel** on the agent surface: current rung per action-kind, the metrics behind it (volume · approval
  · override · calibration), and **"what's needed to advance"** (the nextRungCriteria) — so trust reads as earned
  and inspectable, never a black box.
- The rung shows in the **audit trail / agent trace** where an action was decided ("decided at rung RECOMMEND").
- v2 tokens, no invented reds (a capped/blocked rung uses ink, not red), no emoji.

## Gating hook (kind-agnostic, but inert for gated kinds)

- `decide()` **consults** the computed rung + CONF.1 confidence. In this story the consult is **advisory +
  recorded** — it annotates the decision with the rung and *could* relax approval friction for a non-gated,
  low-risk kind at a high rung — but **no gated action-kind (money/safety/contract) is ever auto-approved**, and
  the auto rung stays disabled by default. The hook exists so LOOP.1/Act plug in without touching `decide()`.
- Every decision still writes to AUDIT.1 with the rung recorded. Nothing bypasses the immutable log.

## Non-goals (flag — this is the whole point)

No actual autonomous execution of any gated action · no new action-kinds · no change to CONF.1 calibration or
AUDIT.1 · no learning-loop writeback (LOOP.1) · **grant no new autonomy** — SUGGEST/RECOMMEND remain the live
rungs; AUTO_BOUNDED is defined + gated-off. Build only Record.

## Data / schema

Prefer **computed-on-read** (no stored rung) — `computeTrust` runs over AUDIT.1 history at read time, org-scoped.
If a cache is warranted for the panel, a single additive, nullable, `///`-annotated `AgentTrust` read-model via
`migrate dev` (never `db push`) — but default to no new table; the audit log already holds the truth.

## Guardrails

Per-tenant isolation (rung computed only from the org's own audit history) · gated kinds have a hard auto ceiling
in `decide()` · advancement requires a volume floor + honest calibration (no trust from a tiny/over-confident
sample) · the immutable audit log is unchanged and every decision still logs · propose→approve→audit stays intact
· no `db push` · the build-only-Record + money/safety/contract-human-gated invariants both hold.

## Verify + gate (`src/scripts/verify-trust-1.ts`)

1. `computeTrust` is deterministic + org-scoped: a rich approved history for `(agent, kind)` → RECOMMEND (or
   higher for a non-gated kind); a second org computes zero/ cold-start (no leak).
2. **Volume floor:** one approval does not advance past SUGGEST.
3. **Calibration cap:** an over-confident history (CONF.1) caps the rung even with a high approval rate.
4. **Hard ceiling:** a gated action-kind (money/safety/contract) can never compute or be gated to an auto rung;
   `decide()` never auto-approves it regardless of rung/confidence.
5. `decide()` records the rung on the decision + still writes AUDIT.1; nothing bypasses the log.
6. The trust panel renders the rung + metrics + next-rung criteria for the seeded agent; a11y 0 on the route.
7. Existing CONF.1/AUDIT.1/RBAC/MEM/EVAL verifies stay green; migrate status clean (no speculative table unless a
   single nullable `///` read-model is justified).
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after TRUST.1; show: the trust panel for a seeded agent (rung + the metrics behind it + what advances it),
`computeTrust` proving the volume floor + calibration cap + the gated-kind hard ceiling, and an audit entry
recording the rung on a decision — with confirmation nothing gated auto-acts and no new autonomy was granted.
