# Design brief — PLM (configuration & traceability) screens

**For:** Claude Design (produces the per-screen `.dc.html` in the Axona v2 system).
**From:** Head of Product. **Grounded in:** the PLM MVP spec (Marcel Gordon interview, ex-VP Product Helsing).
**Goal:** design the screens that let a user answer the five questions below — inside the existing Axona v2
design system, so each screen drops into the app as a route.

## The five questions the product must answer

1. **As-designed vs as-built** — is this unit actually what we designed? What got substituted?
2. **Configuration management** — exact **hardware version + software version + component set** per unit.
3. **Test traceability** — this test result belongs to *which* unit, in *which* configuration, under what conditions?
4. **Root-cause** — was the failure software, hardware, design, production, a bad component, or a field modification?
5. **Change control** — what changed, who approved it, from when, and **which units are affected**?

## Non-negotiable design system (Axona v2 — match the existing `.dc.html` set)

Archivo (UI/display) + JetBrains Mono (data/labels/numbers) · paper `#ffffff` · panel `#f4f3ef` · ink `#0a0a0a` ·
**single accent lime `#c6f24f`** · functional green `#1f9e6f` for live/approved · **no invented reds** (critical
states use ink) · hairlines over shadows · dotted-grid motif · **no emoji, ever** · Lucide icons only, thin
(~1.5px) stroke, sparingly. Layout: **240px sidebar · 60px topbar · 16–28px gaps**. Data tables sit on a **white
card** (`rounded-card border border-line bg-paper`), rows hairline-separated, hover panel-2.

**Voice:** numbers are **mono + specific** (read like a machine reported them) · **sentence case** except
**UPPERCASE MONO eyebrows/labels** · "·" separators · lead with outcomes, not module names.

**Function-first — every screen leads with its signature artifact.** No generic-table slop. If a screen's answer
is a diff, the diff is the hero; if it's a timeline, the timeline is the hero.

---

# NEW SCREENS

## D1 · Unit page ★ (the hero object — design this first)
**Answers:** all five, for one physical unit. This is the object everything else links to.
**Signature artifact:** a **lifecycle timeline** (build → tests → field events → changes) with the unit's
**current resolved configuration** pinned above it.
**Elements:** identity header (serial · model · build date · status · site/customer) · **current config card**
(hardware version + software/firmware version + component set, with a "locked/baseline" state) · **as-designed
vs as-built diff summary** (count of substitutions, expandable) · lifecycle timeline (each event carries the
config-at-that-time) · open issues (NCRs/failures) · linked test runs · linked change orders.
**Note:** config is **time-resolved** — the page must make "what was this unit running *then*" legible, not just
"now."

## D2 · Unit registry (filterable list)
**Answers:** *"which units run sw v2.3, at Site-2, from lot X?"* — the query that sells the product.
**Signature artifact:** a dense, **filter-led** unit table where the filters are the product (model · config
version · sw version · lot · site · status), with the active filter set legible as mono chips.
**Elements:** filter bar (multi-select, combinable) · results count as a mono number · columns: serial · model ·
config version · sw version · site/customer · status · open issues · last event. Row → D1.
**Distinct from Fleet:** this spans **built + deployed** units (the registry), where Fleet is deployed-ops
(uptime/telemetry/map). Don't duplicate Fleet's map.

## D3 · Configuration / baseline view
**Answers:** Q2 (configuration management) at the fleet level.
**Signature artifact:** a **named configuration version** card set — each showing its resolved hw + sw content
and **how many units match**, with a lock/baseline state.
**Elements:** list of named config versions (baselined vs draft) · contents panel (hw part revisions + sw/firmware
versions) · matching-units count → D2 filtered · **lock/baseline action** (a gated, approvable action) · diff
between two config versions.

## D4 · BOM (as-designed) + revision history
**Answers:** Q1's design side, Q5's effectivity.
**Signature artifact:** a **multi-level BOM tree** (indented, expandable), each line showing part revision +
qty + position.
**Elements:** model + design revision selector · BOM tree · per-part revision + effectivity dates · linked change
orders · revision history rail (rev A → B → C with what changed).

## D5 · As-designed ↔ as-built diff viewer
**Answers:** Q1 — the money question. *"The same robot is not actually the same."*
**Signature artifact:** a **two-column diff** (as-designed | as-built) aligned by BOM position, with
**substitutions flagged in ink** (never red) and matched lines de-emphasised.
**Elements:** per-position rows (expected part revision vs actual installed part revision + lot/serial) ·
substitution flag + reason/who/when · a summary strip (N positions · M substitutions · lots involved) · deep
links to the substituted part and its lot.

## D6 · Test explorer
**Answers:** Q3 — and enables cross-config comparison.
**Signature artifact:** a **run comparison** surface — test runs listed with pass/fail, **grouped or comparable
by configuration**, so "how did builds differ" is visible.
**Elements:** filters (test procedure · unit · config version · date · outcome) · run list with pass/fail + key
measurements · **compare mode** (select 2+ runs → side-by-side measurements + config deltas). Row → D7.

## D7 · Test run detail
**Answers:** Q3 for a single run.
**Signature artifact:** the **frozen configuration snapshot** shown alongside results — the whole point is that
the result is inseparable from the config it ran on.
**Elements:** run header (test id · unit · procedure · operator · timestamp · overall pass/fail) · **frozen
config snapshot card** (hw + sw at run time — visibly immutable) · environment/conditions · per-step results
table (measurement · limits · pass/fail) · linked failure report if it failed.

## D8 · RCA workspace (failure investigation)
**Answers:** Q4 — the diagnostic screen.
**Signature artifact:** a **candidate-cause board**: symptom at the top, then evidence columns the system
assembles — config diffs vs passing units · shared lots · sw deltas · similar prior failures — converging on a
**root-cause classification**.
**Elements:** symptom/failure header (unit + config at failure) · evidence columns (each a compact, citable
list) · **root-cause classifier** — a single explicit selector: `software · hardware · design · production ·
component · field-modification` · disposition + resolution · affected-units handoff → D10.
**Agent seam:** the system *proposes* candidate causes with a calibrated confidence; the human classifies.
Design for propose→approve, not auto-diagnosis.

## D9 · Change (ECR → ECO) detail page
**Answers:** Q5.
**Signature artifact:** the **affected-units impact block** — a change is only real when you can see what it
touches.
**Elements:** proposal (rationale · affected part revisions) · reviewers + approval state (who, when) ·
**effectivity** (from which serial/date) · **affected units count → D2 filtered** · rollout status (planned ·
in progress · complete, per unit) · full change history.

## D10 · Blast-radius / impact view
**Answers:** Q4+Q5 at fleet scale. *(The traversal already exists in the product; this is its UI.)*
**Signature artifact:** an **impact cascade** — an input selector (lot | sw version | ECO | part revision) →
grouped affected records **by module**, each showing the relation path that reached it.
**Elements:** input selector · impact summary strip (N units · M sites · which customers) · grouped results with
relation paths · per-group drill-in · export/handoff action (e.g. hand to field service).

---

# V2 OF EXISTING SCREENS

## V1 · Engineering & PLM — v2 (becomes the PLM home)
Today: ECOs table, firmware releases, HW↔firmware compat matrix. **Add:** entry points to BOM (D4), part
revisions + lifecycle, configuration baselines (D3), and the ECR→ECO flow (D9). Keep the compat matrix — it's a
good signature artifact; the screen becomes the design-side hub.

## V2 · Quality — v2 (gains test + RCA)
Today: SPC control chart, NCR table, Pareto. **Add:** test traceability entry (D6/D7) as a first-class section,
and on NCRs a **root-cause classification** field + links to the triggering test run / field event.
**Important:** SPC (process monitoring) and test runs (per-unit verification) are **different things** — design
them as distinct sections, don't merge.

## V3 · Manufacturing — v2 (as-built capture)
Today: line-flow station board, build genealogy. **Add:** the **as-built capture** step (scan/import components,
lots, revisions against the BOM at build → auto-diff, flag substitutions) and link every unit to D1. The
genealogy view should become an entry point to the Unit page, not a dead end.

## V4 · Fleet — v2 (config-aware)
Today: deployment map, live units, telemetry sparklines. **Add:** config version + sw version columns/filters,
and link each deployed unit to D1. Keep the map — Fleet stays deployed-ops; the registry (D2) is the PLM list.

## V5 · Field Service — v2 (field modifications)
Today: dispatch board, work-order queue with SLA. **Add:** recording a **field event / field modification** —
a swap or mod at a deployed unit that **updates that unit's configuration**, with approval + history. This is
the most commonly missed PLM path: config drifts in the field and nobody records it.

## V6 · Procurement / Inventory — v2 (part master + lots)
**Add:** part master attributes (lifecycle status, approved vendors, category) and **lot traceability**
(which lot → which units, via D10). Lower priority than V1–V5.

---

# Sequencing (design in this order — it mirrors the build wedge)

**Wave 1 — the wedge ("Unit registry + as-built configuration"):** **D1 · D2 · D5**, then **V3** (capture) and
**D10** (the traversal already exists — this is just its UI). This alone answers Q1, Q2 and most of Q5.

**Wave 2 — the "wow" (test traceability):** **D6 · D7**, then **V2**. Marcel's highest-value UX.

**Wave 3 — diagnosis + governance:** **D8** (RCA), **D9** + **V1** (change control), **D3** (baselines).

**Wave 4:** **V4 · V5 · V6.**

# Design constraints carried from the customer research

- **Fast time-to-value — value in days, not months.** The screens must work from a **CSV/spreadsheet import**
  (no migration, no heavy config). Design an **import-first empty state** for D2/D4: "import your BOM / units"
  as a real, inviting first-run surface, not an afterthought.
- **Must survive rapid iteration** — parts get substituted mid-build and software changes constantly. Substitution
  and version churn are the **normal case**, not the exception; don't design them as error states.
- **Don't lead with AI on these screens.** The core value is plumbing — the golden thread. Agent proposals appear
  as *assistance* (candidate causes, drafted changes) with calibrated confidence, always propose→approve. The
  screens must be credible with the AI turned off.
