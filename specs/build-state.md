# Axona build — handover / running state

**Purpose.** This is the volatile working state that git + CLAUDE.md can't reconstruct on their own:
where we are in the build, what's uncommitted, the deferred-decisions ledger, and the remaining screens.
When a Cowork chat compresses or you start fresh, a new "Joe" reads this + CLAUDE.md + backlog.md and
continues without losing a step. **Keep this file current — it's updated as each story lands.**

---

## 0. Who you are (the new instance reads this first)

You are **Joe, Head of Product** on the Axona Web App. In this Cowork tab you are the PM layer; **Claude
Code (a separate terminal tab) implements.** Your default output is a **single copy-paste build block** for
Claude Code — named story + requirements + a stop/review gate — no surrounding commentary unless asked.
Full persona, workflow rules, PRD-depth policy, condensed-block template, and design discipline are in
**`CLAUDE.md`** (source of truth — read it fully). This file is only the *where we are* pointer.

**Before emitting anything, orient yourself:**
1. Read `CLAUDE.md` (persona + all rules), `backlog.md` (story order + what's done), this file.
2. Run `git log --oneline -30` — **git is the authoritative record of what's committed.** This file's
   "current state" can lag by one story; git can't.
3. Confirm the working tree is clean (`git status`) before handing over a new block.

---

## 1. What Axona is (one-liner)

The AI-native **operating system for robotics companies** (always "operating system," never "ERP") —
whole robot lifecycle as 24 modules over a horizontal Core + a fleet of cooperating agents. Wedge =
**agentic procurement + per-unit build genealogy**. Moat = the **multi-agent intelligence layer** (L2:
specialized models + operational memory + the learning loop). Source of truth for the product =
`specs/axona-build-spec.md`; architecture spine = `specs/architecture-learnings.md`.

---

## 2. Hard workflow rules (the ones that bite if forgotten — full versions in CLAUDE.md)

- **One story → commit → next.** Never hand over a new build block while the prior story is uncommitted.
  Every block opens with the approve + commit + push of the prior story, then the next build line.
- **Design fidelity is 1:1 and non-negotiable.** Every UI story implements its screen against the local
  file `design/prototypes/axona-v2/<Screen>.dc.html`, matched **like a dev pixel-perfecting an approved
  frontend.** The `.dc.html` decides ALL visuals: layout, structure, stat-strip metrics, copy, artifact
  choice (table vs board vs chart). **Wire-up blocks DEFER to the design — you supply only data source /
  actions / verify / DoD. Never hand Claude Code an element or metric list from your own interpretation.**
  (This is the ENG.2 lesson: an unflagged kanban+wrong-stats divergence because a block over-rode the
  design. If you see a genuine reason to diverge, FLAG it to Nicolas and get agreement *before* encoding
  it in a block — discussion first, then the PRD.)
- **Seed richness = mock richness.** Seed enough that each screen renders as *populated* as its mock
  (multiple ECOs, a full compat grid, a populated genealogy). Thin seed → thin screen. UI stories that
  render thin get a seed-enrichment pass.
- **PRD depth is hybrid.** Condensed block for mechanical stories (Prisma schemas, config, simple
  data/API CRUD). Full CPRD written to `/specs/PRD-<story>.md` for complex / moat-load-bearing stories
  (agent runtime, RBAC/approval/audit, search/files, the moat layer, screens carrying agents/AI output).
- **Moat invariants apply to every story** (from `architecture-learnings.md`): capture genealogy
  as-built never reconstructed; propose→approve→audit with a real calibrated `confidence` field; only L2
  compounds; `guardrails.config` is enforced (never auto-place an order, never claim stock without a
  source, never invent a supplier/lead time); per-tenant isolation of data AND models.
- **Brand invariants:** Archivo + JetBrains Mono; paper #fff / panel #f4f3ef / ink #0a0a0a; single accent
  lime #c6f24f; functional green #1f9e6f for live/approved; no invented reds (critical = ink); hairlines
  over shadows; Lucide icons ~1.5px; **no emoji**; v2 tokens only (no raw hex). 240px sidebar / 60px topbar.
- **Repo/auth:** remote is `nibaranowski-dotcom/axona-web-app`. **NEVER push to a pemo-io repo** (that's
  Nicolas's other company). If git auth flips to pemo-io: `gh auth switch --user nibaranowski-dotcom`
  then `gh auth setup-git`. Push guard: `AXONA_ALLOW_MAIN_PUSH=1 git push`.
- **DoD per story:** real data via the model; agent trace where relevant; human-in-the-loop on gated
  actions; RBAC enforced where it applies; v2 tokens; `accessibility-review` = 0; verify script +
  `docs/manual-checks.md` entry; `tsc --noEmit` + `verify:all` clean.

---

## 3. CURRENT STATE  ← update this section as stories land

**Last landed:** PPL.1 — People data/API (cert matrix + field-team roster + requisitions + rollup; Osei
HV/battery expiring = dispatch gate; shared cert-parsing `lib/certs.ts`; read-only, org-scoped).
Verified 9/9, tsc + verify:all green, FIELD.1 still 8/8.

**Commit status:** ⚠️ confirm against `git log`. PPL.1 was **approved for commit** with message:
`PPL.1 — People data/API (cert matrix + field-team roster + requisitions + rollup; Osei HV/battery expiring = dispatch gate; shared cert-parsing lib/certs.ts; read-only, org-scoped)`
— if `git log` shows it committed, the tree is clean and you can proceed to PPL.2's build directly.
If not yet committed, the PPL.2 block must open with that commit first.

**Next up:** **PPL.2 — the People screen.** Match `design/prototypes/axona-v2/People.dc.html` 1:1.
Signature artifact = the **certification matrix** (tech × cert type). Wire PPL.1's `getPeopleData(orgId)`.
**Seed pass required:** matrix is currently 6 techs × 1 cert type (hvBattery) → renders thin. Enrich with
the cert TYPES the design's columns imply (HV/battery, robotics-safety, electrical, confined-space,
forklift — use the design's own column set), realistic VALID/EXPIRING/missing mix, keep **M. Osei's
HV/battery EXPIRING as the dispatch gate** tied back to Field Service. People agents auto-populate the
pane. Read-only unless the design shows an action (flag if gated). Add `verify-ppl-2.ts` + docs entry.

---

## 4. Deferred-decisions ledger (real design calls we consciously parked — not bugs)

Each is a "data-shape gap flagged, not fabricated." Revisit when its owning story comes up.

| Deferred | Current stand-in | Unblocks at |
|---|---|---|
| OEE / cycle-time / availability / yield feed | on-time/yield/units-day/takt show real In-build/In-progress/Built/On-hold counts instead | a telemetry/quality feed (MEM.1 / QUAL) |
| Station routing / build-order model | canonical `STATION_ORDER` hardcoded in `lib/manufacturing.ts` | a routing model (future MFG story) |
| Multiple production lines | one plant station pipeline | per-line model |
| In-line tests / SPC | Throughput & bottlenecks panel; SPC lives in Quality | QUAL module |
| Work-order / re-sequence "Apply" (gated write) | seed the agent action; no live write | a scheduling model + RBAC gate |
| Parts-tree (full BOM) genealogy | station-level as-built trace + `/// ONT.2` pointer | ONT.2 (as-built ontology) |
| Immutable event log (inputs·output·model·confidence·approver) | `/// TODO AUDIT.3` seams | AUDIT.3 |
| Agent-drafted + status columns | `/// RBAC.4 / AUDIT.3` pointers | RBAC.4 / AUDIT.3 |
| Telemetry / SPC as first-class typed input | shaped but learning loop stubbed | MEM.1 / LOOP |

Tenancy pattern (scalar `orgId` + `@@index`, FK indexes, no formal relations) and the org-scoped client
`dbForOrg` are **already landed** (FND.11 / ISO.1) — new schema stories follow that pattern, live
migrations are fine now.

---

## 5. Remaining work (after PPL.2)

**Module screens still to do / retrofit:** Inventory, Sales & CRM (note: `Sales & CRM.dc.html` must be
hand-edited — its `&` breaks the design's find/replace scripts), Marketing, Security.

**Core screens** (need their backend stories first): Workflows (WF.1), Projects (ART.3), Machines
(FILE.2 / MTX.1). Agents screen + Mission Control body = retrofits once their backends exist.

**Cross-module narrative (the through-line — keep every new screen consistent with it):** the
BMW / Kawasaki sample deal → **ECO-318** (engineering change) → **SERVO-204 vs SERVO-205** drive →
**lot-88421** defect → **NCR-118** (the quality nonconformance) → held unit **HX2-0208** at Test →
**M. Osei's** expiring HV/battery cert gating field dispatch. It's now told across ~10 module screens.
BMW/Kawasaki are **fictional sample data** — fine inside the app (labeled), must be anonymized in
anything that leaves the app (decks/screenshots) → "Tier-1 auto OEM," etc.

**Backlog order** lives in `backlog.md` (133 stories / 15 epics). Work it in order; "next" = the next
runnable row. Rows are CPRD-triggerable if Nicolas wants a full PRD first.

---

## 6. How to resume in a fresh chat

Paste this as the first message:

> You're Joe, Head of Product on the Axona Web App (Cowork PM layer; Claude Code implements in a separate
> tab). Read `CLAUDE.md`, `backlog.md`, and `specs/build-state.md` in full, then run `git log --oneline -20`
> and `git status` to confirm what's committed. Then give me the next build block — condensed or full-CPRD
> per the hybrid policy — following the one-story→commit→next rule and 1:1 design fidelity. Next up is PPL.2
> unless git shows otherwise.

Then just say **"next"** (or a StoryID) each round, exactly as before.
