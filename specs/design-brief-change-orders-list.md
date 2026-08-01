# Design brief — Change Orders list · new PLM screen

**For:** Claude Design (produces the `.dc.html` in the Axona v2 system). **From:** Head of Product.
**Gap this fills:** `/changes/:code` shows a change-order **detail** (`Change Order.dc.html`, e.g. `ECO-318`),
but there is **no list** — the `CHANGE ORDERS` breadcrumb on the detail page dead-ends. This brief adds the list
screen that breadcrumb should lead to.

**Screen:** `Change Orders.dc.html` · **Route:** `/changes` · **Type:** list (back-arrow to Engineering + a mono
eyebrow, per the v8 list-screen nav model). Sibling to `Change Order.dc.html` the way `Test Explorer.dc.html` is
to `Test Run.dc.html`.

## What it answers

**Q5 (change control) at fleet scale** — the **change queue**: what's proposed / in review / approved / released,
what each change touches, and **what's waiting on my approval.** It's the governance home for engineering change.

## Signature artifact

A **change queue** — a dense, **status-led** table of ECRs/ECOs where the **approval state** and the
**affected-units impact** are the point (not a generic table). It reads as "what's moving through change control,
and what's waiting on me." A stat strip above it makes the queue state legible at a glance.

## Elements

- **Stat / filter strip:** counts by status (**Draft · In review · Approved · Released**) and by type
  (`SUPERSEDE`, `REVISE`, `DEVIATION`, …); **"awaiting my approval"** is legible as its own number. Filters
  compose and drive the table.
- **Table columns:** code (`ECO-318`) · title · type · **status** · **affected-units count** · **effectivity**
  (from serial/date) · reviewers / approval state · updated. Mono, specific numbers.
- **Row → Change order detail** (`Change Order.dc.html`) — the list routes; **approval itself lives on the
  detail** (the gated `decide()` action), not inline in the list.
- **Agent-drafted changes:** an ECO drafted by a change agent (e.g. from an NCR) appears in the queue **tagged as
  agent-drafted + calibrated confidence**, still propose→approve. The screen works fully with the agent off.
- **Empty / first-run state:** a real "no change orders yet" state (secondary — change control is normally
  populated; import-first not required here).

## Navigation

List-screen model: **back-arrow to Engineering** + an UPPERCASE MONO eyebrow **"CHANGE ORDERS"** — this is
exactly the breadcrumb node that currently dead-ends from the detail page. Row → detail (which carries the full
breadcrumb `Engineering › Change orders › ECO-318`).

## Design system (Axona v2 — match the existing `.dc.html` set)

Archivo (UI/display) + JetBrains Mono (data/labels/numbers) · paper `#ffffff` · panel `#f4f3ef` · ink `#0a0a0a` ·
single accent lime `#c6f24f` · functional green for approved/live · **no invented reds** (at-risk/blocked use
ink) · hairlines over shadows · dotted-grid motif · **no emoji** · Lucide icons only (thin ~1.5px, sparing).
Layout: 240px sidebar · 60px topbar · 16–28px gaps; the table on a white card
(`rounded-card border border-line bg-paper`), rows hairline-separated, hover panel-2. **Voice:** numbers mono +
specific · sentence case except UPPERCASE MONO eyebrows/labels · "·" separators · lead with the outcome.
