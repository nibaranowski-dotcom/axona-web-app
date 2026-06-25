/**
 * Tailwind theme mapping — every value points at a CSS variable from
 * `styles/tokens.css`. No hex here; tokens.css is the only place colors live.
 *
 * `axonaColors` REPLACES Tailwind's default palette (used as `theme.colors`),
 * so only token-backed utilities exist — `bg-red-500` and friends don't compile.
 * Consumed by apps/web/tailwind.config.ts.
 */

/** Semantic color palette (replaces the default Tailwind palette). */
export const axonaColors = {
  transparent: "transparent",
  current: "currentColor",
  inherit: "inherit",

  paper: "var(--paper)",
  panel: { DEFAULT: "var(--panel)", 2: "var(--panel-2)" },
  skeleton: "var(--skeleton)",

  ink: {
    DEFAULT: "var(--ink)",
    strong: "var(--ink-strong)",
    muted: "var(--ink-muted)",
    faint: "var(--ink-faint)",
  },
  line: {
    DEFAULT: "var(--line)",
    strong: "var(--line-strong)",
    panel: "var(--line-panel)",
  },
  accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)" },
  success: { DEFAULT: "var(--success)", tint: "var(--success-tint)" },
  "on-dark": { mut: "var(--on-dark-mut)", faint: "var(--on-dark-faint)" },
};

/** Font families -> the semantic type tokens. */
export const axonaFontFamily: Record<"sans" | "mono", string[]> = {
  sans: ["var(--font-sans)"],
  mono: ["var(--font-mono)"],
};

/** Radii tokens. */
export const axonaBorderRadius: Record<"pill" | "btn" | "card", string> = {
  pill: "var(--r-pill)",
  btn: "var(--r-btn)",
  card: "var(--r-card)",
};
