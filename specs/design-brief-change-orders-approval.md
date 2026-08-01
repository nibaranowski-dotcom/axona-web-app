# Design brief — Change Orders "Approval" column (CHG.1)

*For Claude Design. Output: an updated `Change Orders.dc.html` in the axona-v2 export. Implementation
(CHG.1) is 1:1 against whatever you ship — so the design is the decision, not the code.*

## The problem

On the Change Orders list (`/changes` · `Change Orders.dc.html`), the **Approval** column (last, ~1.1fr)
**clips**: ~126px of content (the dual-approver treatment + status) resolves into ~63px at standard widths,
so the approval state reads as `APPRO… N…` — truncated and illegible. This is an investor-facing PLM screen,
and the dual sign-off *is the point* of a change-order record (propose → approve → audit), so it can't be the
one thing that's unreadable.

Pre-existing (predates the table work); surfaced precisely because the table now uses content-independent
tracks, so a column either fits its track or clips — no more silent inflation.

## Goal

Make the Approval state **legible at the table's normal widths** without breaking the dense-table alignment or
the screen's design language. The fix lives in the design; keep it 1:1-implementable.

## Constraints (design DNA — do not drift)

- Archivo (display/UI) + JetBrains Mono (labels/codes/counters); **no third typeface**.
- Ink-on-paper; single accent **lime `#c6f24f`** used sparingly; functional green only for live/approved status.
- **Hairlines over shadows**, rounded corners, pills for chips/tags. **No emoji.** Mono UPPERCASE for eyebrows/labels.
- The table shares the **content-independent track model** (TABLE.1): each column is a fixed or `minmax(floor, …)`
  track sized to its content. So the Approval column needs a **width the design commits to** — either a fixed px
  track sized to a compact treatment, or a real floor — not an open `1.1fr` that clips.
- Match the rest of `Change Orders.dc.html`; this is a targeted fix to one column, not a redesign of the screen.

## Directions to consider (pick what reads best — your call)

1. **Compact status chip (recommended).** Replace the clipped avatar-stack + text with a mono chip that states
   the approval state in a fixed narrow track — e.g. `2/2 APPROVED` (functional green), `1/2 PENDING`, `DRAFT` —
   sized to the widest chip, matching the Procurement status-chip pattern. Legible, fixed-width, on-brand.
2. **Rebalance the row.** Give Approval a real floor and let the **Change** description column (which currently
   truncates ~295px → ~119px) absorb the loss — truncating a description is correct; truncating approval isn't.
3. **Two-line cell.** Approver identity on one line, status on the next, within a slightly taller row — only if it
   stays consistent with the other rows' height.

I lean **(1)**: a fixed-width mono status chip fits the dense-table track model cleanly and makes the state
scannable, which is what a reviewer wants from this column.

## Also, if trivial in the same pass

Engineering ECO's identifier (ECO code) clips ~3px at 1366 for the same track-fit reason — a small floor on that
column would settle it. Optional, same family of fix.

## Deliverable

Updated `Change Orders.dc.html` (and optionally the Engineering ECO screen) with the Approval column legible at
standard widths, tokens only (no raw hex), and a **committed track width** for the new treatment so it fits the
content-independent grid. CHG.1 then implements it 1:1. No real company/person names anywhere (SEED.1).
