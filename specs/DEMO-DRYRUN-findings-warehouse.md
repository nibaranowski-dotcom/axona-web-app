# Warehouse-tenant dry-run — findings (live walkthrough, app.axonahq.com, prod)

Eyeballed walkthrough of the warehouse prospect's script on the live warehouse tenant.
Automated gates (verify:demo SAFE · verify:demo-script SCRIPT-TRUE · verify:demo-agent
AGENT-SAFE · off-path crawl CLEAN) all pass — these findings are the presentation-level
issues those checks structurally cannot see (narrative fit, surfacing gaps, entry path).
Guardrail: this file names no banned marque (it's in specs/, tracked).

## Hero beats — hold up
- **Beat 1 /inventory** — reorder-agent panel: proposal · confidence 0.75 (from 1.00) ·
  four evidence signals · "NM-GRIP-SERVO 0 on hand vs 8" · Confirm shortage. Fully agentic,
  on-narrative. STRONG.
- **Beat 4 /field-service fault loop (the money moment)** — works and closes. The
  connected-objects loop is clickable both directions and lands on PO-NM-9007 ("drafted
  because this field swap consumed the last spare"): WO-NM-5521 ↔ NM-PICK-0132 ↔
  NM-GRIP-SERVO ↔ PO-NM-9007. No dead-end.
- **Beat 5 /units/NM-PICK-0142** — build-readiness agent · 85% · blockers NM-GRIP-SERVO +
  NM-OPTIC · confidence 0.75 · "Warsaw assembly." On-narrative. STRONG.

## Issues (severity)

### 1. Base-seed pollution — HIGH (undermines "modeled on you")
Root cause: `seedProspectOrg` (src/scripts/lib/prospect-seed.ts:79) calls the shared
`seedTenantModules(...)` before the prospect's own `seed()`, so the drone-flavored base
narrative is seeded into EVERY tenant. On the warehouse tenant it reads wrong: /core,
/procurement, /field-service show SN-21xx serials, SERVO-204 / LIDAR-360 / BATT-AX2 POs,
"AX-2 margin," drive-torque NCRs, "HV/battery cert." The off-path crawl passed (rows are
populated + marque-free) — it cannot see "off-narrative." Only hurts the warehouse tenant;
the same base seed is on-narrative for the defense/drone tenant.

### 2. Hero PO buried — HIGH (procurement is the warehouse prospect's #1 pain / landing screen)
On /procurement, PO-NM-9007 is row 15 of 19, under the base drone POs. Three near-duplicate
"9007" codes: PO-9007 (SERVO-205), PO-N9007 (GRIP-EOAT-G7), PO-NM-9007. First rows the
prospect sees are drone parts, not the gripper-servo story.

### 3. Script over-claims procurement detail — MEDIUM
No PO detail view exists, so the "system is chasing the supplier automatically" (beat 2) and
"6 of 6 matched · serial NMC-88231 captured" (beat 3) are NOT shown on screen — only a LATE
badge and a Received status. Data is present (verify confirms) but unsurfaced. These were the
DEMO.6 beats (#8 auto-chase, #9 3-way match) not built.

### 4. Fault-loop entry path — LOW (path note)
The clickable loop lives on the unit page (connected-objects), not on /field-service — whose
WO rows don't click. Demo the loop from the unit page, not the field-service list.

## Recommended fixes
- **#1 + #2 (do before the warehouse meeting):** make the base seed domain-aware so the
  warehouse tenant gets warehouse-appropriate base entities (or seed no drone base for it).
  Kills the drone tells AND de-clutters /procurement so PO-NM-9007 surfaces. One prod re-seed
  after.
- **#3:** soften the script wording (don't promise on-screen chase/3-way-match detail), or
  build the PO detail view (bigger).
- **#4:** demo the loop from /units/NM-PICK-0132, not /field-service.
- **Zero-code fallback if no time:** presenter stays on the clean NM-* path (inventory →
  unit page → loop → readiness), skips /core, filters /procurement to "Agent-drafted."

## Defense/drone tenant
Likely clean — the drone base seed is on-narrative for a drone company. Verify with a
dry-run on that tenant (needs a login to it).
