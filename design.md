# design.md — Axona Web App tokens (DS.1, imported design system)

Authoritative tokens for the product app, **reconciled to the imported Claude Design
system** (DS.1 — project "Axona v2" / "Axona Design System"). This **supersedes the
FND.2 starter tokens**. Verbatim import lives in `design/prototypes/source/`. The app's
single source of truth is `packages/config/styles/tokens.css`; Tailwind maps it via
`packages/config/src/tailwind.ts`. Where this conflicts with a brand invariant in
`../CLAUDE.md`, the invariant wins.

## Principles
Technical-but-warm · near-white paper, warm-grey product panels, near-black ink · one
accent (lime, signal only) · functional green for live/approved · **no invented reds
(critical = ink)** · hairlines over shadows (product) · dotted-grid is the one motif ·
type does the work (Archivo display + JetBrains Mono labels) · **no emoji**.

## Tokens (source: `packages/config/styles/tokens.css`)
```css
:root{
  /* Type — self-hosted via next/font (--font-archivo / --font-jetbrains-mono) */
  --font-sans:var(--font-archivo,"Archivo"),system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:var(--font-jetbrains-mono,"JetBrains Mono"),ui-monospace,"SF Mono",Menlo,monospace;
  --fw-regular:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;
  /* display scale */ --fs-hero:108px; --fs-h2:52px; --fs-h3:24px; --fs-h4:19px;
  --fs-lead:21px; --fs-body:16px; --fs-body-sm:14px; --fs-meta:13px; --fs-mono:11px; --fs-mono-sm:10px;
  --track-hero:-.045em; --track-head:-.035em; --track-tight:-.02em; --track-mono:.06em;
  --lh-hero:.92; --lh-head:1.02; --lh-body:1.5;

  /* Surfaces / ink (warm grey ramp) */
  --paper:#ffffff; --panel:#f4f3ef; --panel-2:#f7f2eb;
  --ink:#111111; --ink-strong:#0a0a0a; --ink-muted:#6b6b63; --ink-faint:#9a9a90;
  --mono-faint:#8a8a82; --mono-ghost:#a7a79d;
  --on-dark:#ffffff; --on-dark-mut:rgba(255,255,255,.70); --on-dark-faint:rgba(255,255,255,.40);

  /* Hairlines */
  --line:#ededed; --line-soft:#eeeeee; --line-panel:#e7e7e1; --line-strong:#e2e2e2; --line-dark:#1d1d1d;

  /* Accent (lime) + status */
  --accent:#c6f24f; --accent-hover:#bce83f; --accent-ink:#0a0a0a;
  --success:#1f9e6f; --success-tint:#e9f7f0;
  --skeleton:#f0f0ec; --selection-bg:var(--accent);

  /* Spacing (4px base) */ --space-1..--space-22 (4,8,12,16,20,24,32,40,48,64,72,88)
  /* Radii */ --r-pill:999px; --r-btn:8px; --r-card:14px; --r-panel:16px; --r-sm:7px;
  /* Shadows — MARKETING ONLY (product keeps hairlines) */ --shadow-float/-hero/-pop
  /* Motif */ --dotgrid:radial-gradient(#d9d8d2 1.1px,transparent 1.1px); --dotgrid-size:18px 18px;
  /* Motion */ --ease:cubic-bezier(.2,.6,.2,1); --dur-fast:.12s; --dur:.2s;

  /* Mission Control launchpad (dark surface; from Mission Control.dc.html) */
  --md-bg:#101013; --md-grad-top:#1a1a1e; --md-grad-mid:#101013; --md-grad-bot:#0c0c0e;
  --md-glow / --md-tile / --md-tile-hover / --md-line / --md-line-hover /
  --md-glass / --md-glass-line / --md-dot / --md-rule (rgba whites + lime glow)
}
```

## Reconciliation notes (DS.1)
- **Changed vs FND.2 starter:** `--ink` #1b1b1f→#111111, `--ink-muted` #55555f→#6b6b63,
  `--ink-faint` #8a8a93→#9a9a90, `--panel-2` #eceae3→#f7f2eb, `--line*` warmer/lighter,
  `--accent-ink` #1b2a00→#0a0a0a, `--success-tint` #e3f3ec→#e9f7f0, `--skeleton`
  #e6e4dc→#f0f0ec. **Added:** mono-faint/ghost, on-dark, line-soft/dark, accent-hover,
  full type/spacing/radii/motion scales, dotgrid tokens, the dark launchpad tokens.
- **Fonts:** product self-hosts Archivo + JetBrains Mono via next/font (FND.2); the
  prototype's Google-CDN `@import` is not used in-app.
- **Shadows:** imported but **marketing-only**; the Tailwind theme exposes no shadow
  utilities, so product surfaces stay on hairlines (brand invariant).

## App-specific notes
- **AgentGlyph:** static 12-dot ring (never animated), exact DS coordinates; status dot
  color = agent state. **TraceConsole:** dark block, JetBrains Mono trace lines.
- Lime is the single signal (primary action / active nav / count badge / "live" dot),
  never as fill paint. If a screen reads "all lime," pull back.
- Primitive library: `apps/web/components/ui` (Button, Badge, Pill, MonoChip, Card,
  AgentGlyph) — FND.14/FND.15 extend these.
```
