# PRD — SRCH.4 · Command palette, v10 design (scope tabs + grouped results)

**Story:** SRCH.4 — bring the ⌘K command palette up to the new design of record (`Search.dc.html`): a centered
light card over a dimmed, blurred backdrop with **scope tabs** (All · Agents · Files · Chats · Modules ·
Workflows · Projects) carrying **live per-scope counts**, **grouped results** (one section per type), a
**pre-highlighted first row**, full keyboard nav, and **deep-link routing** to each result's real screen.
Improves the existing palette — does not rebuild the index.
**Screen (1:1 source):** `design/prototypes/axona-v2/Search.dc.html` (v10 export; refresh the committed copy
from the v10 export in the same change if it has drifted — the two differ by ~300 bytes).
**Type:** global overlay component (⌘K from any in-shell screen; `/search` is the full-page fallback) — opens
over the current screen, not a route change. **Pri/size:** P0 · M. **Track:** Search/shell.
**Deps:** SRCH.1 (unified FTS + pgvector index), SRCH.3 (palette mount + global ⌘K binding),
`components/search/CommandPalette.tsx` · `CommandPaletteMount.tsx` · `Results.tsx`, SIDEBAR.2 (the search field
that opens it), and the seven indexed entity types.

## How to read this (CLAUDE.md rule)

Wire-up defers to the design. `Search.dc.html` is the sole truth for the card, the backdrop, the scope-tab row,
the grouped-result rows (icon · title · tag · subtitle · right-aligned mono meta), and the footer. This PRD adds
only **data · behavior · verify · DoD**. Implement 1:1; design wins on conflict (flag it).

## Anatomy (from the design + `axona-nav-and-search-note.md` Part B)
1. **Search field** — magnifier + input + `ESC` chip (closes → returns to the prior screen). **Autofocused** on
   open; seeds from the `#q=` hash.
2. **Scope tabs** — All · Agents · Files · Chats · Modules · Workflows · Projects; each shows a **live result
   count**; the selected tab is ink-filled.
3. **Grouped results** — one section per type (UPPERCASE MONO label); each row = type icon (agents use the
   **12-dot ring glyph**) + title + optional tag + subtitle + right-aligned mono meta. **First row
   pre-highlighted.**
4. **Footer** — `↑↓ navigate · ↵ open · esc close` + a live result count.

## Behavior (implement all, 1:1)
- **Unified index across the spine:** one query matches title/subtitle/keywords across agents, files, chats,
  modules, workflows, projects (SRCH.1's index, extended to cover all seven scopes with a `type` + resolvable
  `href`).
- **Scope filter + free-text compose:** picking a tab narrows to that type; **counts update live per query**
  (a grouped-count query server-side — not a client-side filter over a fetched page).
- **Keyboard:** autofocus on open; `↑↓` moves the active row across groups; `↵` opens the active row's `href`;
  `esc` closes. First result active by default so `↵` works immediately.
- **Row → deep link:** each result routes to its real screen (module screen, `Agents`, `Workflow`,
  `Project Files`, unit/PO/NCR/ECO detail, etc.).
- **Empty state:** `NO MATCHES FOR '…'` in mono when nothing matches.
- **Open/close:** ⌘K (or the SIDEBAR.2 search field) opens; `esc` / the ESC chip / backdrop click closes and
  returns to the prior screen (never a blank route).

## Data (extend the index + a grouped-count query)
- Ensure the SRCH.1 `SearchDoc` covers all seven scopes with `{ type, title, subtitle, keywords, href }`,
  **org-scoped** by `orgId`. Add a **grouped-count** query (counts per scope for the current query) powering the
  tab badges — server-side, one round trip.
- **Search-quality dependency (task #8):** the live agent/search currently ANDs every FTS term, so a
  multi-word query with a non-matching token returns zero. The palette must degrade gracefully — prefer an
  **OR/ranked tsquery** (ranked by match count) or prefix matching so a partial query still returns its best
  hits. Fixing this here also closes the free-form-question gap flagged on the live demo agent.

## Verify + gate
- `verify-srch-4.ts`: (1) each scope returns typed results whose `href` resolves to a real route; (2) the tab
  counts equal the grouped totals for a query; (3) a multi-word query with one non-matching term still returns
  ranked hits (the OR/ranked-tsquery assertion — guards task #8); (4) empty query → empty-state contract;
  (5) results are org-isolated (a second org's docs never surface). Self-cleaning; restore any seeded search
  state. Add a `docs/manual-checks.md` entry (⌘K opens focused, ↑↓/↵/esc, scope narrows + counts update,
  backdrop closes to prior screen).
- **a11y:** the overlay traps focus, is fully keyboard-operable, the field has an accessible label, the active
  row is announced (`aria-activedescendant`), and `esc` restores focus to the opener. Add `/search` to
  `a11y-routes.ts`.

## DoD
⌘K palette matches `Search.dc.html`; unified index across the seven scopes; composable scope + free text with
live counts; full keyboard nav; deep-link routing to real screens; graceful ranked matching (task #8 closed for
the palette path); empty state; org-scoped; a11y AA; `tsc --noEmit` clean; `verify:all` green. Feels like
Linear/Raycast's ⌘K, or it isn't done.
