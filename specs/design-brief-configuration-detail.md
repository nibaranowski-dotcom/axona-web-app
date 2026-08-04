# Design brief — Configuration detail (full page) · new PLM screen

**For:** Claude Design (produces the `.dc.html` in the Axona v2 system). **From:** Head of Product.
**Gap this fills:** `/configurations` lists named configuration versions (`Configurations.dc.html`), but a
configuration has **no full-page view** — clicking `CFG-B-4.2` in the list goes nowhere. This brief adds the
detail screen the list should open into.

**Screen:** `Configuration.dc.html` · **Route:** `/configurations/:code` · **Type:** detail (full breadcrumb:
`Engineering › Configurations › CFG-B-4.2`). Sibling to `Configurations.dc.html` the way `Unit.dc.html` is to
`Unit Registry.dc.html`.

## What it answers

**Q2 (configuration management) for one named configuration** — the exact hardware + software content, what's
baselined/locked, **how many units run exactly this**, how it differs from the prior baseline, and what changed
it. This is the object the registry, test runs, and change orders all point at when they name a config version.

## Signature artifact

The **resolved configuration manifest** — a clean two-part HW + SW content block (part revisions + firmware
versions) with a prominent **baseline/lock state**, paired with the **matching-units count** as the "this is
real — N units run exactly this" proof. Not a generic table: the manifest + lock + unit count is the hero.

## Elements

- **Identity header:** config code (`CFG-B-4.2`) · model (`AX-2`) · **baseline vs draft** state + lock icon
  (functional green for baseline/locked) · lineage (**supersedes / superseded-by** the adjacent version).
- **Resolved content (the manifest):** HW — each position → its part revision (e.g. `COMPUTE-720 rev C`); SW —
  firmware/software versions (e.g. `firmware v4.2.1`). Mono, specific, itemized.
- **Matching-units count → deep-link** to Unit registry filtered to this config (the query that sells the
  product — "which units run exactly this").
- **Diff vs another version:** a version selector → HW + SW **deltas** (what changed `CFG-B-4.1 → -4.2`), version
  bumps / substitutions rendered **in ink** (never red), matched lines de-emphasised.
- **Lock / baseline action:** a **gated, approvable** action (lock a draft as a baseline; a locked baseline is
  immutable, unlock is gated) — shown as propose→approve, not a bare toggle.
- **Change history:** the ECOs/changes that produced or affect this config → link to the Change order detail
  (`Change Order.dc.html`), with effectivity.
- **Agent seam (optional):** a configuration agent may flag drift or propose a baseline, shown as a **proposal +
  calibrated confidence**, propose→approve. The screen is fully usable with the agent off.

## States

**Draft** (editable; "lock to baseline" available) · **Baseline** (locked, immutable; unlock gated) ·
**Superseded** (points to its successor). No import-first needed (this is the detail of an existing config).

## Navigation

Full breadcrumb `Engineering › Configurations › :code`; back to the Configurations list. Deep-links out to the
filtered registry, to change orders, and to the version being diffed against.

## Design system (Axona v2 — match the existing `.dc.html` set)

Archivo (UI/display) + JetBrains Mono (data/labels/numbers) · paper `#ffffff` · panel `#f4f3ef` · ink `#0a0a0a` ·
single accent lime `#c6f24f` · functional green for baseline/live/approved · **no invented reds** (critical/diff
states use ink) · hairlines over shadows · dotted-grid motif · **no emoji** · Lucide icons only (thin ~1.5px,
sparing). Layout: 240px sidebar · 60px topbar · 16–28px gaps; content on white cards
(`rounded-card border border-line bg-paper`). **Voice:** numbers mono + specific · sentence case except
UPPERCASE MONO eyebrows/labels · "·" separators · lead with the outcome, not the module name.
