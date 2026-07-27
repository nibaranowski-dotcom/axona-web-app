# PRD — SEAMS.1 · Record-layer seams for the up-stack (design the seams, build only Record)

**Story:** SEAMS.1 — Record the Record→Sense→Predict→Act north star in the repo's canonical docs, and leave
**clean typed hooks** in the Record schema for (a) station-level sensor/event streams and (b) per-unit outcome
labels — so Sense/Predict/Act plug in later without a retrofit. **Build only the seams. No Sense/Predict/Act
features.**
**Spec ref:** `specs/product-north-star.md`; `specs/architecture-learnings.md` (capture fidelity caps the moat;
telemetry is a first-class typed input). **Pri/size:** P2 · S. **Track:** Architecture/seams. **Depth:** Condensed.
**Deps:** the Record layer (PLM program, MFG telemetry, TestResult/NCR/FieldEvent), the agent runtime.

## Why

The CTO's 4-layer framing gives the product an architectural north star: Record (now) → Sense → Predict → Act.
The near-term product is **Record only**. But the schema and the propose→approve→audit runtime should be shaped
now so the upper layers plug in cleanly — retrofitting the capture layer is the top moat risk. Much of this is
already true (telemetry is typed; TestResult/NCR.rootCause/FieldEvent are outcome labels); SEAMS.1 makes the two
seams explicit and documented, and adds nothing speculative.

## Scope — three things, all seam-only

1. **Document the north star (canonical, so every session inherits it):**
   - Add a short "Product north star — Record → Sense → Predict → Act" note to **CLAUDE.md** (positioning/
     architecture section): the 4 layers, "build only Record now", and "the propose→approve→audit runtime is the
     path to Act."
   - Cross-reference `specs/product-north-star.md` as the fuller narrative.
   - Add a line to `specs/architecture-learnings.md` mapping the data-maturity axis (Record→…→Act) onto the
     software-layer axis (L1–L4) so the two framings don't drift.

2. **Seam (a) — station-level sensor/event stream hook (Sense):**
   - Do NOT build a sensor pipeline or a new capture table speculatively. Instead leave a **typed interface + a
     `///` SENSE pointer** on the Record spine: a `StationEvent` / `StationSignal` shape (unitId? · station ·
     ts · metric · value / eventType · payload) documented as "the Sense-layer input; station telemetry tied to
     a unit-at-station; not captured yet — SENSE.1 builds the ingest." Reuse the existing `MachineSignal`/
     `TelemetryPoint` typed-telemetry pattern; point the new seam at it. No migration unless a single nullable
     `///`-annotated hook is genuinely warranted — prefer an interface + pointer over a premature table.

3. **Seam (b) — per-unit outcome labels (Predict):**
   - The labels Predict will train on already exist (TestResult pass/fail, NCR.rootCause, FieldEvent outcomes).
     Make them **retrievable as a clean per-unit labeled substrate**: a thin, read-only `unitOutcomes(db, unitId)`
     in `packages/db/src/plm/` that aggregates a unit's test results + NCRs (with rootCause) + field events into
     a typed `UnitOutcome[]` (kind · outcome · at · sourceType/sourceId · configSnapshot ref). Org-scoped;
     read-only; no new capture, no new table — it reads what Record already holds. Documented as "the Predict-
     layer training substrate; Predict.1 consumes this."

## Non-goals (flag — this is the whole point)

No Sense ingest · no Predict model · no Act autonomy · no new modules · no camera/sensor pipeline · no schema
tables built speculatively (a typed interface + `///` pointer is the seam, not a table). If seam (a) seems to
want a real table, STOP and flag — it's SENSE.1's call, not this story's.

## Guardrails

Non-breaking (docs + one read helper + typed interfaces/pointers only); no new capture; `unitOutcomes` is
read-only + org-scoped (per-tenant isolation); if any migration is truly needed it's a single nullable
`///`-annotated hook via `migrate dev` (never `db push`); the CLAUDE.md wedge line (Procurement) and the
"build only Record now" guardrail both stay intact.

## Verify + gate (`src/scripts/verify-seams-1.ts`)

1. CLAUDE.md carries the Record→Sense→Predict→Act north star + the "build only Record now" guardrail; the
   Procurement wedge line is unchanged (assert both present).
2. `product-north-star.md` + the `architecture-learnings.md` axis-mapping line exist.
3. The `StationEvent`/`StationSignal` typed seam + `/// SENSE` pointer exist (interface, not a built pipeline).
4. `unitOutcomes(db, unitId)` returns a typed per-unit outcome substrate for SN-2208 (its test results + NCR-118
   rootCause + field events), org-scoped; a second org returns zero. Read-only — no mutation path.
5. Non-breaking: all existing verifies stay green; migrate status clean (no speculative tables).
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm build · migrate clean; commit +
push; Actions green.

## Review gate

Stop after SEAMS.1; show: the CLAUDE.md north-star note (with the wedge line intact), the two typed seams
(StationEvent interface + `unitOutcomes` output for SN-2208), and confirmation nothing Sense/Predict/Act was
actually built.
