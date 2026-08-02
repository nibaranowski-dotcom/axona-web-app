# Design brief — dense-table frozen-column pattern (unblocks TABLE.2 / TABLE.3)

**For:** Claude Design. **From:** Head of Product. **Deliverable:** a canonical dense-table card/scroll pattern
documented in the guidelines + updated `.dc.html` for the four affected screens.

## The problem (why engineering is blocked)

Procurement already ships a frozen identifier column at narrow widths (UX.17 — the PO code stays pinned while the
row scrolls horizontally). We want the same on the other dense tables — **Unit Registry**, **Change Orders**,
**Engineering ECO**, **Test Explorer** — but their designs wrap the table in an `overflow-hidden` rounded card
(needed to clip the rounded corners), and that `overflow-hidden` sits between the sticky cell and the scroll
container, which **breaks `position: sticky`** — the identifier scrolls straight off. It's a structural
conflict in the card, not a tuning issue, so it needs a design decision, not a code hack.

## DECISION (LANDED — design note, 2026-08-01): YES, pin the identifier

Resolved. On wide PLM tables, losing which row you're reading is a real cost, and Procurement already ships the
frozen-PO precedent — **consistency wins, so pin the leading identifier on every dense table.** The canonical
pattern below is now the spec (proven on `Change Orders.dc.html` as the reference impl); apply it to Unit
Registry (freeze the serial), Engineering ECO (freeze the ECO code), and Test Explorer (2-col freeze: checkbox +
identifier). This supersedes the earlier "no frozen column" parking — that was pre-decision, when the
`overflow-hidden` card made `sticky` impossible; the card-as-scroller structure below resolves it.

### Canonical pattern (from the design note — implement 1:1, 0px @ the design width as the gate)
1. **The rounded card itself is the horizontal scroll container** — `border-radius` + `overflow-x:auto` on ONE
   element. No nested `overflow-hidden` card between the sticky cell and the scroller (that's what broke `sticky`).
2. **Frozen leading cell:** `.frz{ position:sticky; left:0; background:inherit; z-index:1 }`. The row/header
   carries an EXPLICIT opaque `background:var(--paper)` so `inherit` occludes cleanly and follows `:hover` →
   `--panel-2`.
3. **Conditional separator:** a scroll listener toggles `.scrolled`; `.dscroll.scrolled .frz{ box-shadow:1px 0 0
   0 var(--line) }` — a hairline that appears only when scrolled (matches Procurement). No heavy shadow.
4. Keep the `min-width` floor on header, rows, and pagination so tracks never collapse. Tokens only.

## What to define (the canonical dense-table pattern)

1. **A card + scroll structure that supports a sticky leading column AND keeps the rounded-card clipping.** The
   clean resolution is to make the **rounded card itself the horizontal scroll container** (border-radius +
   `overflow-x:auto` on one element), so a sticky cell sticks to it and the corners still clip — rather than
   nesting a separate `overflow-hidden` card between the sticky cell and the scroller. Define this as the
   standard dense-table shell so every table uses one structure.
2. **The frozen-column treatment while scrolling.** At rest (no scroll) the leading column looks **identical to
   today** (this is a hard requirement — 0px change at the design/wide width). When the row scrolls beneath it,
   the frozen column reads as pinned via a **subtle separator** — a hairline or a soft right-edge shadow that
   appears only when scrolled (matching Procurement's conditional hairline). Specify its background so content
   occludes cleanly, and the layering.
3. **Apply to the four screens** — updated `.dc.html` each, keeping wide-width appearance unchanged and adding
   the narrow-width scroll + frozen leading column:
   - **Unit Registry** — freeze the **serial**.
   - **Change Orders** — freeze the **ECO/change code** (this table also has the 878px min-width we just shipped;
     keep it).
   - **Engineering ECO** table — freeze the **ECO code** (its identifier also clips ~3px today — settle it here).
   - **Test Explorer** — the awkward one: identifier is **column 2, behind a checkbox** (so a **2-column freeze**:
     checkbox + identifier), and it has a **header row per procedure group** inside one scroller. Define how the
     frozen columns and the repeating group headers coexist (the group headers must align across the freeze).
4. **Consistency:** this is the shared pattern — it must match Procurement's already-shipped frozen-PO behavior
   so all dense tables read the same.

## Design system (Axona v2 — unchanged)

Archivo + JetBrains Mono · paper `#ffffff` · panel `#f4f3ef` · ink `#0a0a0a` · single lime accent · functional
green for live/approved · **no invented reds** · **hairlines over shadows** (the frozen separator is a hairline or
a *very* soft edge, not a heavy shadow) · rounded-card · **no emoji** · Lucide icons only. The frozen column uses
tokens for its background, never raw hex.

## Deliverable

The canonical dense-table shell documented in the guidelines, + updated `Unit Registry.dc.html`,
`Change Orders.dc.html`, `Engineering.dc.html` (ECO table), and `Test Explorer.dc.html` declaring it. Wide-width
appearance must be pixel-unchanged; the frozen-column + scroll behavior is the narrow-width addition. Engineering
then implements each 1:1 with **0px @ the design width** as the gate.
