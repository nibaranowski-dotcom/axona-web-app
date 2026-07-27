# Product north star — Record → Sense → Predict → Act

**Source:** Shubham Shrivastava (CTO) framing, founder call 2026-07-21. **Adopted:** 2026-07-23.
**Status:** architectural north star + roadmap narrative. **Build guardrail:** build **only Record** now.

## The 4-layer arc

Axona is a 4-layer stack over one spine. Each layer feeds the next; the learning loop + physical-world
connectivity across them is the moat.

| Layer | What it is | Timeline | Status |
|---|---|---|---|
| **1 · Record** | The AI-native operating system for how a robotics/manufacturing company runs — per-unit build genealogy, work orders, BOM, procurement, quality, as-built, test, RCA, change control. **The wedge, and the labeled data bootstrap for everything above.** | **Now** | Built (procurement wedge + full PLM program + moat spine) |
| **2 · Sense** | Camera + real-time process monitoring on the line — what's actually happening at each station. Adds live signal on top of the recorded genealogy. | Next | Not built — seam only |
| **3 · Predict** | Failure / defect prediction from assembly + component + sensor data — what's about to go wrong. Turns the Record substrate + Sense signal into foresight. | Later | Not built — seam only |
| **4 · Act** | End-to-end autonomous execution across the operation — the system acts, a human approves. The far end of the **propose → approve → audit** loop, not a separate system. | Vision | Not built — the runtime already generalizes to it |

**The compounding chain:** Record produces the labeled substrate → Sense adds live signal → Predict turns it
into foresight → Act closes the loop. Only the loop compounds; it is the moat.

## How this maps to the existing architecture (they're complementary axes)

The `architecture-learnings.md` L1–L4 split is a *software-layer* axis; Record→Sense→Predict→Act is a
*data-maturity* axis. They cross cleanly:

- **Record** = the L3 domain apps (the 24 modules + PLM) running on the L1 foundation (connectors · ontology ·
  per-unit genealogy · immutable event log). It's the capture layer — and "capture fidelity caps the moat."
- **Sense / Predict** = new typed inputs (station sensors) + the L2 intelligence spine (operational memory ·
  specialized models · the learning loop) consuming them. MEM.1/CONF.1 are the first L2 pieces; Predict is where
  L2 turns Record+Sense into foresight.
- **Act** = the propose→approve→audit runtime (RBAC.4 `decide()` + AUDIT.1) at full autonomy, gated by CONF.1's
  calibrated confidence + the TRUST.1 ladder. Act is not a new system — it's the same loop with more earned trust.

## The guardrail (non-negotiable)

- **Build only Record now.** Hold the wedge there until it's a business (first LOI + first prototype on Record).
- **Design the seams now, build only Record.** Leave typed hooks for (a) station-level sensor/event streams and
  (b) per-unit outcome labels, so Sense/Predict/Act plug in later without a retrofit. (This is SEAMS.1 — the only
  buildable item from this brief.)
- **Do NOT** add Sense/Predict/Act modules to the build spec or sprint. Building cameras and failure-prediction
  before selling a work order is the failure mode.
- **The runtime already reaches Act.** Keep every agent action on propose→approve→audit; design the approval/
  audit layer so it generalizes from Record to Act (it already does — `decide()` is kind-agnostic).

## Roadmap narrative (deck / partner calls)

Present as **Now / Next / Later / Vision**:
- **Now — Record.** The operating system for how robotics companies run; per-unit genealogy is the wedge.
- **Next — Sense.** Live process monitoring on the line, on top of the recorded genealogy.
- **Later — Predict.** Failure/defect prediction from the assembled substrate.
- **Vision — Act.** Autonomous execution across the operation, human-approved.

**Keep the live product and marketing site manufacturing-first (Record).** Present the upper layers as "where
this goes," never as shipping. Don't over-claim; the arc is the narrative, Record is the product.
