# Platform UI kit — Axona app (proposal)

> ⚠️ **Net-new, not a recreation.** Axona's product app has no existing screens yet. This kit *proposes* how the website's visual language carries into the product, so the design system covers both surfaces. Treat these as design proposals to validate with product/eng — not a spec of a built app.

Built from the design-system tokens (`../../styles.css`) and components (`Button`, `Badge`, `StatChip`, `Chip`). The app adapts the marketing aesthetic to a denser, working tool: same warm-grey panels, near-black ink, lime accent, mono data labels — but tighter spacing, a persistent sidebar, and data tables.

## Screens (click the sidebar to switch)
- **Overview** — ops KPIs, production-throughput chart, live agent-activity feed.
- **Procurement** — PO table with status badges + an agent recommendation/approve flow (the wedge).
- **Build genealogy** — per-unit part tree, build-progress, and test results (the traceability differentiator).
- Inventory / Quality / Field service — labeled placeholders.

## App-specific conventions introduced here
- **Sidebar nav** at 232px, paper surface, lime avatar.
- **Topbar** with screen title + a live status badge + primary action.
- **Data tables**: mono column headers, zebra rows (`--panel-2`), status via `Badge`.
- **Charts**: bar columns using `--accent` for recent/active, `--skeleton` for historical.
Densitiy is higher than the website; section rhythm drops from ~88px to ~16–28px gaps.
