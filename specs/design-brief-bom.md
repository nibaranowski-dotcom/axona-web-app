# Design brief — BOM (as-designed) + revision history · new PLM screen (D4 / PLM.13)

**For:** Claude Design (produces the `.dc.html` in the Axona v2 system). **From:** Head of Product.
**Gap this fills:** the Configuration detail (PLM.11) has a "view all positions in the BOM →" affordance that
currently dead-ends at the Engineering hub — the **BOM screen was never designed** (it was D4 in the original PLM
brief, deferred). This brief adds it. It's the **as-designed** side of the "as-designed vs as-built" story
(PLM.4 is the as-built diff; this is the design source of truth those diffs align against).

**Screen:** `BOM.dc.html` · **Route:** `/bom/:model` (with a model + design-revision selector) · **Type:** detail
with a list-like tree. Breadcrumb `Engineering › BOM › HX-2 (rev C)`.

## What it answers

**Q1's design side** (what the unit is *supposed* to be) and **Q5's effectivity** (which design revision applies
from which serial/date). It's the canonical multi-level bill of materials for a product model at a chosen design
revision — the thing the as-built diff (PLM.4) and change orders (PLM.9) reference.

## Signature artifact

A **multi-level BOM tree** — indented, expandable assemblies → sub-assemblies → parts — where each line carries
its **part revision · qty · position (ref-des)**. The tree *is* the screen (not a flat table); depth and
substitution/effectivity legibility are the point.

## Elements

- **Header / selectors:** model (`HX-2`) + **design-revision selector** (rev A · rev B · **rev C** current) —
  changing the revision re-resolves the whole tree to that revision's content.
- **BOM tree (the hero):** indented expandable rows; each line = position/ref-des · part number → **part
  revision** · description · qty · UoM. Assemblies expand to their children; a running part count in a mono
  eyebrow. Long/￼substituted lines stay in ink (never red).
- **Per-part detail (row expand):** the part's current revision, **effectivity** (from serial / date), approved
  status, and links to the part in Inventory and to any **change orders** that touch it (→ `Change Order.dc.html`).
- **Revision-history rail:** a side/opposite rail showing the model's design revisions **rev A → B → C** with a
  one-line "what changed" per bump (which positions/parts changed, driven by which ECO). Selecting a revision in
  the rail drives the tree selector.
- **Effectivity band:** makes "this revision applies from SN-…/date" legible (ties to change-order effectivity).
- **Import-first empty state:** the BOM must be usable from a **CSV/spreadsheet import** on day one (a real
  first-run surface — "import your BOM"), consistent with the Unit-registry import pattern. Time-to-value is the
  reason a defense-robotics prospect rejected an incumbent PLM.
- **Agent seam (optional):** an engineering agent may flag a BOM issue (an obsolete revision, a single-source
  part) as a **proposal with calibrated confidence**, dismissible. The screen is fully usable with the agent off.

## States

Current (baselined) revision vs a draft/in-work revision · a superseded revision (read-only, points to its
successor) · the import-first empty state (no BOM yet). Substitutions/version churn are the **normal case**, not
error states.

## Navigation

Breadcrumb `Engineering › BOM › :model (rev)`; deep-links out to Inventory (the part), to change orders (the ECO
that changed a line), and inbound from the Configuration detail's "view all positions" link (PLM.11 → here) and
from the as-built diff (PLM.4, which aligns as-built against this as-designed tree).

## Design system (Axona v2 — match the existing `.dc.html` set)

Archivo (UI/display) + JetBrains Mono (data/labels/numbers/part-revs) · paper `#ffffff` · panel `#f4f3ef` · ink
`#0a0a0a` · single accent lime `#c6f24f` · functional green for baselined/approved · **no invented reds**
(critical/diff states use ink) · hairlines over shadows · dotted-grid motif · **no emoji** · Lucide icons only
(thin ~1.5px, sparing — e.g. the tree expand chevrons). Layout: 240px sidebar · 60px topbar · 16–28px gaps; the
tree on a white card (`rounded-card border border-line bg-paper`), rows hairline-separated. **Voice:** numbers
mono + specific · sentence case except UPPERCASE MONO eyebrows/labels · "·" separators · lead with the outcome.
