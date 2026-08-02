# PRD — DEMOVERIFY: a "safe to send" guard for prospect demo links

*Motivation: prospect emails ship deep-links into a seeded tenant (e.g. `…/units/<serial>`, `…/procurement`
against a named PO). Today a human (me) verifies each link resolves and each claim matches the data before a
send. That caught two real errors in one prospect email ("one part across 5 locations" — false; "no local
spare" — contradicted by the seeded WO). Automate it so no email ever ships with a dead link or a claim the
data contradicts.*

(Prospect names and their hero codes stay OUT of this file and out of the tracked tree — they live only in the
gitignored `prospects/` tenants, per SEED.1. The examples below are illustrative placeholders.)

## Goal

`pnpm verify:demo <prospect>` — given a prospect's **walkthrough manifest** (the exact deep-links + hero codes
+ claimed facts an email uses), assert against that org's seeded data that: every deep-link resolves to a real,
**populated** entity on that tenant; every **claimed fact** holds; and the entities are org-isolated. Output a
per-email **SAFE TO SEND / NOT SAFE** with the exact failing link or claim. Runs on the seed (local) and can run
against prod.

## The walkthrough manifest (per prospect)

A declarative list, stored next to the prospect config (GITIGNORED — it names the tenant + hero codes). Each
step:
- `route` — the exact app route the email links (e.g. `/units/<serial>`, `/procurement`).
- `heroCode` + `kind` — the entity the step is about (a unit serial, a PO code, an NCR code, …).
- `claims[]` — the specific factual assertions the email makes about it, as checkable predicates, e.g.:
  - `<po>.status == SENT && daysPastPromised >= 6` ("six days late")
  - `part <sku>.onHand < minLevel` ("below min")
  - `<po>.draftedByAgentId != null` ("agent-drafted")
  - `unit <serial>.customerLabel == Customer-A` ("deployed at Customer-A")
  - `buildReadiness(<serial>).pctInHouse ≈ 85 && blocked == 2`
  - `<testRun>.result == FAIL` ("here a failure")

The manifest is the email's claims turned into data assertions — authoring it forces every sentence to be
data-backed.

## Checks

1. **Link resolves + populated:** each `route`'s `heroCode` exists for that org and renders non-empty (unit has
   a BOM/as-built, PO has lines, NCR has an RCA, etc.) — catches dead links / missing codes / thin screens.
2. **Route is real:** the route matches a live app route (no 404 pattern, incl. dynamic segments).
3. **Claims hold:** every `claims[]` predicate is true against the seeded data — catches narrative that the data
   contradicts (the two real errors above would have failed here).
4. **Org isolation:** every hero entity belongs to the named org only (2nd org → not found); no cross-tenant code.

## Output

Per prospect: `SAFE TO SEND` (all green) or `NOT SAFE` with the exact `route` + failing check/claim and the actual
value (e.g. "servo in 2 locations, email claims 5"). Non-zero exit on any failure.

## Build / DoD

- `src/scripts/verify-demo.ts` + `verify:demo` script; reuses the org-scoped client, the existing entity reads,
  and `computeBuildReadiness` (BR.1) — no parallel data layer.
- Manifests live gitignored beside each prospect config; `verify:all` runs `verify:demo` for any prospect whose
  manifest is present, and skips cleanly when absent (the prospect-tenant pattern).
- Deterministic (injectable `now`, per VERIFY.3). orgId-scoped. `verify-demo` self-test: a manifest with a wrong
  claim FAILS; a correct one passes.
- Authoring pass: write a manifest per prospect tenant from the three current emails; running it must reproduce
  the two known failures (proving the guard bites) — then they're fixed and it goes green.
- tsc clean; verify:all + eval green; docs/manual-checks.md entry.

## Guardrails

Manifests are gitignored (name tenants + hero codes) · assertions read real data, never fabricate · the guard
fails a send on any dead link or contradicted claim — it never "passes to be nice" · deterministic · additive.

## Why it's worth it

Every prospect send reuses this: author the manifest once from the email, `verify:demo` gates the send. It turns
"the Head of Product eyeballs the links each time" into a repeatable check — and it already has a track record
(two real catches on the first email set).
