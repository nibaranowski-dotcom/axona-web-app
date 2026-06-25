# design.md — Axona Web App tokens (v2, shared with the site)

Authoritative tokens for the product app — the **same v2 system** as the marketing site
(`../Axona-Commercial-Website/design.md`) and the decks, so product, site, and deck are one brand.
Source: build spec §10 (`specs/axona-build-spec.md`). Where a skill (e.g. frontend-design) differs, this wins.

## Principles
Technical-but-warm · one accent (lime, signal only) · light paper field · dotted-grid is the one motif ·
type does the work (Archivo display + JetBrains Mono labels) · soft elevation + hairlines, not heavy
shadows · **no emoji** · functional green for live/approved, **no invented reds** (critical = ink).

## Tokens (paste into `styles/tokens.css`)
```css
:root{
  --font-sans:"Archivo",system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
  --paper:#ffffff; --panel:#f4f3ef; --panel-2:#eceae3; --skeleton:#e6e4dc;
  --ink:#1b1b1f; --ink-strong:#0a0a0a; --ink-muted:#55555f; --ink-faint:#8a8a93;
  --line:#e7e5df; --line-strong:#cfccc3; --line-panel:#d8d5cc;
  --accent:#c6f24f; --accent-ink:#1b2a00; --success:#1f9e6f; --success-tint:#e3f3ec;
  --on-dark-mut:#b9b9c0; --on-dark-faint:#6a6a73;
  --r-pill:999px; --r-btn:8px; --r-card:14px;
}
```
Self-host Archivo + JetBrains Mono via `next/font` (`display: swap`). Tokens drive Tailwind via CSS vars.

## App-specific notes
- **AgentGlyph:** static 12-dot ring (never animated); status dot color = agent state.
- **TraceConsole:** dark block rendering SSE trace lines (scan → correlate → draft → policy-check → result).
- Lime appears as the single signal (primary action / active step / "THE MOAT"/"MVP" tags / genealogy chart),
  never as fill paint. If a screen reads "all lime," pull back.
