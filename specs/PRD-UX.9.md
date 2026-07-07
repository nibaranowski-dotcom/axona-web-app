# PRD — UX.9 · Agent-chat trace open/close (collapsible trace sub-pane)

**Story:** UX.9 — Replace the current agent-chat trace with the collapsible open/close pattern from the v9 design.
**Pri/size:** P1 · S. **Track:** Platform/polish. **Depth:** CPRD (condensed). Pure UI, no data/schema change.
**Deps:** the agent chat (AgentPane / PaneChat / AgentChat), the existing TraceConsole / TraceLine. Design reference:
`design/prototypes/axona-v2/Procurement.dc.html` (v9 — shows the new agent-chat trace).

## Problem
The trace inside an agent chat currently renders poorly (always-expanded / no clean collapse — see the "bad"
current state). The v9 design has a proper **collapsible trace sub-pane** at the bottom of the chat.

## The new pattern (from the v9 Procurement design)
A native `<details>`-based **trace sub-pane** pinned at the **bottom of the agent chat**:
- Dark surface (`#121214`); a **summary bar** = a status dot (accent = live) + `TRACE` · the orchestrator name
  (e.g. `proc-orchestrator`) · a **chevron** (`.tracechev` rotates `-90deg` when closed → `0deg` when open).
- `.tracepane[open]` → `flex:1; min-height:120px` (shows the scan/correlate/tool/result lines); `:not([open])` →
  `flex:none` (just the summary bar). Native `<details>`/`<summary>` toggle (list-marker hidden), smooth chevron
  transition (`.15s`). A "Live" indicator + a collapse control at the top of the chat per the design.

## Implementation
- Adopt this collapsible trace sub-pane in the **agent chat** component (the right-pane chat and the `/agents` chat),
  replacing the current trace rendering — matching `Procurement.dc.html` 1:1 for the trace region.
- Keep the trace **content** rendering via the existing TraceCollector/TraceLine (scan · correlate · tool ·
  policy-check · result); this story changes only the **container open/close + summary bar**, not the line format.
- Use native `<details open>`/`<summary>` (accessible by default) or a controlled equivalent with `aria-expanded`;
  honor `prefers-reduced-motion` (no transition). v2 tokens, Lucide/inline chevron ~1.7px, no emoji, no invented reds.
- Out of scope (flag): the suggestion chips (Add buffer / Compare vendors / …) shown in the v9 chat are a separate
  agent-suggestions feature — not part of this trace story.

## Verify + gate (`src/scripts/verify-ux-9.ts`)
1. The agent-chat trace renders as a collapsible details sub-pane (summary bar with TRACE + orchestrator + chevron;
   open → expanded with the trace lines, closed → summary only) matching the v9 pattern.
2. Toggling open/close rotates the chevron + expands/collapses; keyboard-accessible; reduced-motion honored.
3. Trace lines still render via the existing TraceLine shape (no content regression).
CI gate: install --frozen-lockfile · lint · typecheck · verify:all · **pnpm build** · a11y 0 on /agents +
/procurement (the agent chat); commit + push; Actions green.

## Review gate
Stop after UX.9; show: the agent-chat trace collapsed (summary only) and expanded (trace lines), the chevron toggle,
and verify-ux-9 output.
