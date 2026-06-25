# Axona Web App

The **Axona product** — the AI-native operating system for robotics companies. Sibling of
`../Axona-Commercial-Website` (the marketing site); both sit under the `axona-cowork` project.

## What's here
```
CLAUDE.md                         product brief, brand invariants, stack, build order, integrity
design.md                         v2 tokens (shared with the site + decks)
specs/axona-build-spec.md         FULL product spec — 24 modules, data model, agents, API, skeleton
specs/screen-export-instruction.md  Addon 3: how to export simplified screen crops for the decks
exports/                          → put screens-export-seed.md + screens-export-sales.md here
```

## Build the product
Open it in Claude Code in this folder. Source of truth = `specs/axona-build-spec.md`. Build order
(its §9): DB + seed → shell + Mission Control + Search → AgentRuntime + Agents + chat (SSE) → Command
Center → Projects/file-matrix → Workflows + run engine → Machines → value-chain → robotics → back-office
→ RBAC + audit + guardrails. Follow `design.md` tokens; keep the brand invariants in `CLAUDE.md`.

## Produce the deck screens (do this when the decks need visuals)
Run `specs/screen-export-instruction.md` here (this project has the real screens) → write:
- `exports/screens-export-seed.md`  (for the investor deck)
- `exports/screens-export-sales.md` (for the sales deck)
Then hand those to the deck designer alongside the deck content + addons in `../company/deck/`.
**Anonymize** BMW/Kawasaki → "Tier-1 auto OEM"; label every crop "sample data — illustrative." Human-gate.

## Relationship to the rest of the workspace
- Company story / market / competition / moat / people → `../memory/` and `../company/`.
- Decks that consume the screen exports → `../company/deck/`.
- Marketing site (same design system) → `../Axona-Commercial-Website/`.
