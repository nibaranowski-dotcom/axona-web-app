# PRD — PLM screens (9 new · 6 updated) · from the Axona v8 design export

**Scope:** every screen in the v8 export that is new or changed vs. the committed `axona-v2` set.
**Depth:** one lean spec per screen. **Deps:** **PLM.1** (the data layer — nothing here builds without it);
DESIGN.2 (v8 imported + committed). **Track:** PLM (E15).

## How to read this (important — CLAUDE.md rule)

**Wire-up specs DEFER to the design.** The `.dc.html` is the *sole* truth for layout, structure, stat-strip
metrics, copy, artifact choice and content-shape. Each screen below specifies only **route · design file ·
data source · actions · verify · DoD**. Do **not** hand Claude Code an element list derived from this doc —
the instruction is always *"implement `<Screen>.dc.html` 1:1 on the DS.1 primitives."* If a spec and the
design conflict, **the design wins**; flag it to Nicolas rather than diverging.

## Shared conventions (apply to every screen here)

- **Navigation model (from the v8 build note):** Engineering = the PLM hub. **List** screens (Unit registry,
  Blast radius, Test explorer, Configurations) get a back-arrow to their module + a mono eyebrow. **Detail**
  screens (Unit, As-built diff, Test run, RCA, Change order) get full breadcrumb trails
  (e.g. `Quality › Test explorer › TR-8841`, `Engineering › Unit registry › SN-2208 › As-built diff`).
- **One demo thread everywhere:** `SN-2208 → SERVO-204 lot 88421 (quarantined) → NCR-118 → ECO-318 (supersede
  → SERVO-205) → affected units → field service` (seeded by PLM.1).
- **Import-first empty states** — Unit registry and BOM must be usable from a CSV import on day one. Design the
  empty state as a real first-run surface, not an afterthought. Time-to-value is the reason a defense-robotics
  prospect rejected an incumbent PLM.
- **Substitution & version churn are the normal case**, never error states.
- **Credible with AI off** — agent output appears as *assistance* (candidate causes, drafted changes) with
  **calibrated confidence** (CONF.1) and always **propose → approve**. No screen depends on the agent to function.
- **Standing DoD (every screen):** real data via the model · org-scoped (`dbForOrg`) · RBAC enforced on every
  mutation (`requireRole` line 1) · gated actions through `decide()` + audited · v2 tokens only (no raw hex) ·
  no emoji · no invented reds · a11y 0 on the route · `tsc --noEmit` clean · verify script + CI gate green.

---

# NEW SCREENS

## PLM.2 · Unit registry — `Unit Registry.dc.html`
**Route:** `/units` · **Answers:** *"which units run sw v2.3, at Site-2, from lot X?"*
**Data:** `Unit` + resolved config (`resolveConfigAt(now)`) + open issue counts; paginated, org-scoped.
**Actions:** combinable filters (model · config version · sw version · lot · site · status) reflected in the
URL; row → `/units/:serial`; **CSV import** (`importUnits`) with dry-run + row-level errors; import-first empty state.
**Verify:** filters compose and are URL-addressable; a lot filter returns exactly the units carrying that lot;
CSV import is idempotent (re-import = no-op) and reports malformed rows without partial writes; empty state
offers import.
**Note:** distinct from Fleet — registry spans **built + deployed**; Fleet stays deployed-ops (map/telemetry).

## PLM.3 · Unit page ★ — `Unit.dc.html`
**Route:** `/units/:serial` · **The hero object.** Everything links here.
**Data:** `Unit` identity; **current resolved config** (`resolveConfigAt`); `asBuiltDiff` summary; lifecycle
timeline assembled from build → `TestRun`s → `FieldEvent`s → `ECO`s/changes, **each carrying config-at-that-time**;
open NCRs; linked change orders.
**Actions:** open as-built diff → PLM.4; open a test run → PLM.7; open blast radius for this unit's lot → PLM.5.
**Verify:** the timeline resolves config **at each event's timestamp** (not "now") — assert an event before the
field modification shows the pre-mod config; the diff summary count matches `asBuiltDiff`; all links resolve.

## PLM.4 · As-built diff — `As-Built Diff.dc.html`
**Route:** `/units/:serial/as-built` · **Answers Q1** — "the same robot is not actually the same."
**Data:** `asBuiltDiff(unitId)` — as-designed `BomLine` aligned to `AsBuiltRecord` by position.
**Actions:** expand a position (who installed, when, why); deep-link to the substituted part revision + its lot.
**Verify:** every BOM position appears exactly once; substitutions are flagged (SN-2208 shows the SERVO-204
rev B substitution + lot 88421); matched lines are de-emphasised; **substitutions render in ink, never red**.

## PLM.5 · Blast radius — `Blast Radius.dc.html`
**Route:** `/blast-radius` · **The traversal already ships (ONT.1) — this is its UI.**
**Data:** `affectedUnits` / `getBlastRadius` for an input of lot | sw version | ECO | part revision; results
grouped by module with the **relation path** that reached each record.
**Actions:** input selector; drill into any affected record; hand-off action (e.g. to field service).
**Verify:** selecting lot 88421 returns the seeded multi-module cascade with relation paths; results are
org-scoped (a second org returns zero); grouping matches the module tagging.

## PLM.6 · Test explorer — `Test Explorer.dc.html`
**Route:** `/tests` · **Answers Q3** at fleet scale.
**Data:** `TestRun` list + outcome + key measurements, grouped/filterable by procedure · unit · config version ·
date · outcome.
**Actions:** filters; **compare mode** — select 2+ runs → side-by-side measurements **+ config deltas**; row → PLM.7.
**Verify:** compare mode surfaces the config delta between TR-8841 (fail, SBX-B-4.2) and TR-8802 (pass,
SBX-B-4.1) — i.e. the screen makes "how the builds differed" visible, which is the whole point.

## PLM.7 · Test run — `Test Run.dc.html`
**Route:** `/tests/:code` · **The frozen config snapshot is the hero.**
**Data:** `TestRun` (+ `TestResult` steps) with its **frozen** `configSnapshot`, environment/conditions,
operator, procedure.
**Actions:** open the unit → PLM.3; open the resulting failure/NCR → PLM.8.
**Verify:** the rendered snapshot comes from `TestRun.configSnapshot` (frozen), **not** a live re-resolve —
assert that changing the unit's current config does not alter this page; per-step limits + pass/fail render.

## PLM.8 · RCA workspace — `RCA.dc.html`
**Route:** `/rca/:ncrCode` · **Answers Q4.**
**Data:** the failure (unit + config-at-failure) plus assembled evidence: config diffs vs passing units ·
shared lots · sw deltas · **similar prior failures via MEM.1 `recallMemory`** (graph proximity).
**Actions:** **root-cause classification** — `software · hardware · design · production · component ·
field_modification` — written to `NCR.rootCause`, RBAC-gated + audited; disposition; hand off affected units → PLM.5.
**Verify:** classification persists + writes an audit entry; agent-proposed candidate causes render as
**proposals with calibrated confidence** (CONF.1) and never auto-classify; MEM.1 recall surfaces the prior
related failure; the screen is fully usable with the agent disabled.

## PLM.9 · Change order — `Change Order.dc.html`
**Route:** `/changes/:code` · **Answers Q5.**
**Data:** `ChangeRequest`/`ECO` — rationale, affected part revisions, reviewers + approval state, **effectivity**
(from serial/date), **affected units** (`affectedUnits`), rollout status per unit.
**Actions:** review/approve via **`decide()`** (RBAC-gated, audited — reuse RBAC.5 `eco.release`); set effectivity;
track rollout.
**Verify:** approval routes through `decide()` and is audited; the affected-units block is computed (not
hardcoded) and respects effectivity; rollout state is per-unit.

## PLM.10 · Configurations — `Configurations.dc.html`
**Route:** `/configurations` · **Answers Q2** at fleet level.
**Data:** `ConfigurationVersion` list — resolved hw + sw content, baseline/draft state, **matching-units count**.
**Actions:** **lock/baseline** a configuration (gated via `decide()` + audited); diff two configuration versions;
matching-units count → PLM.2 filtered.
**Verify:** the matching-units count equals the registry filtered by that config; lock is RBAC-gated + audited
and a locked config is immutable; the version diff renders hw + sw deltas.

---

# UPDATED SCREENS (v2 — implement the changed regions 1:1 against the v8 file)

> For each: re-implement against the **v8** `.dc.html`, which supersedes the committed axona-v2 version. Keep
> existing behaviour and verify scripts green; add the new region.

## PLM.V1 · Engineering — `Engineering.dc.html` (becomes the PLM hub)
**Adds:** the **PLM entry-point band** — navigation into Unit registry, Configurations, BOM/part revisions, and
the ECR→ECO flow — alongside the existing ECO table + HW↔FW compat matrix (both retained).
**Verify:** existing ENG verifies stay green; every PLM entry point routes correctly.

## PLM.V2 · Quality — `Quality.dc.html`
**Adds:** a **test-traceability section** (entry to PLM.6/PLM.7) and a **root-cause field** on NCRs (+ links to
the triggering test run / field event).
**Critical:** SPC (process monitoring) and test runs (per-unit verification) are **different things** — keep
them as distinct sections; do not merge.
**Verify:** QUAL verifies stay green; the SPC chart is untouched; root cause persists + is audited.

## PLM.V3 · Manufacturing — `Manufacturing.dc.html`
**Adds:** **as-built capture** at build (scan/import components, lots, revisions against the BOM → auto-diff,
flag substitutions) writing `AsBuiltRecord`; the genealogy view links to the Unit page (PLM.3) instead of dead-ending.
**Verify:** capture writes as-built records + computes the diff at write time; **as-built is captured, never
reconstructed**; MFG verifies stay green.

## PLM.V4 · Fleet — `Fleet.dc.html`
**Adds:** **config version + sw version** columns/filters; each deployed unit links to its Unit page.
**Keeps:** the deployment map + telemetry (Fleet remains deployed-ops; the registry is PLM.2).
**Verify:** FLEET verifies stay green; config/sw columns are resolved (not stored scalars); links resolve.

## PLM.V5 · Field Service — `Field Service.dc.html`
**Adds:** recording a **field event / field modification** — a swap or mod at a deployed unit that **updates
that unit's configuration**, with approval + history (writes `FieldEvent` + a new `UnitSoftwareState`/as-built
delta + a frozen snapshot).
**Why it matters:** config drifts in the field and nobody records it — the most commonly missed PLM path.
**Verify:** a recorded field modification changes `resolveConfigAt(now)` but **not** any prior frozen snapshot;
the event is RBAC-gated + audited; FIELD verifies stay green.

## PLM.V6 · Inventory — `Inventory.dc.html`
**Adds:** part master attributes (lifecycle status, approved vendors, category) + **lot traceability**
(which lot → which units, via PLM.5).
**Verify:** INV verifies stay green; lot → units resolves through the same façade as blast radius.

---

# Sequencing

**Wave 1 (the wedge — "unit registry + as-built configuration"):** PLM.1 (data) → **PLM.2 · PLM.3 · PLM.4** →
**PLM.V3** (capture) → **PLM.5** (cheap: traversal already exists). Answers Q1, Q2 and most of Q5.
**Wave 2 (the "wow" — test traceability):** **PLM.6 · PLM.7 → PLM.V2.**
**Wave 3 (diagnosis + governance):** **PLM.8** (RCA) → **PLM.9 · PLM.V1** (change control) → **PLM.10** (baselines).
**Wave 4:** **PLM.V4 · PLM.V5 · PLM.V6.**

One story → one commit → next. Every UI story implements its `.dc.html` **1:1**; visual fidelity is part of the
DoD, checked per story, never deferred to a later pass.
