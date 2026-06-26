# Design prototypes — imported source of truth (DS.1)

Imported from the Claude Design project **Axona v2** via the `claude_design` MCP.

- Project: https://claude.ai/design/p/30c1e297-a90b-462c-9dac-331a257053f0
- Design-system project (structured): **Axona Design System** (`4752cfb4-…`)
- Imported: 2026-06-26

## What's here

- `source/tokens/*.css` — the authoritative token set (color, typography, spacing, radii/shadow/motifs, fonts). **These supersede the FND.2 starter tokens.** They are reconciled into `packages/config/styles/tokens.css` (the app's single source of truth) and mapped into Tailwind via `packages/config/src/tailwind.ts`.
- `source/components/**/*.jsx` — the design system's reference primitive implementations (Button, Badge, Chip, StatChip, Input, Card, LayerRow, AgentGlyph). Reproduced as token-driven React/Tailwind components in `apps/web/components/ui` (DS.1).
- `Mission Control.dc.html` — rendered reference for the launcher (full-screen dark launchpad). The other 23 screen mockups (`Quality.dc.html`, `Fleet.dc.html`, …) live in the linked project and are pulled per-screen when each module screen is built.

## Brand reconciliation (CLAUDE.md invariants win)

- Fonts: the prototype loads Archivo + JetBrains Mono from the Google CDN; the **product self-hosts** them via `next/font` (FND.2). Token `--font-sans` / `--font-mono` point at the next/font CSS variables.
- Shadows: the imported `radii-shadow.css` defines `--shadow-float/-hero/-pop`. These are **marketing/website** surfaces. The **product app keeps hairlines over shadows** — the Tailwind theme intentionally does NOT expose shadow utilities.
- No invented reds (status = green/ink), single lime signal, dotted-grid motif — all preserved.

## Fidelity rule

Every product screen from DS.1 onward must match its prototype 1:1. Compare the running app (`http://localhost:3001`) against the relevant `*.dc.html` here (or in the linked project).
