/**
 * Tailwind theme mapping — every value points at a CSS variable from
 * `styles/tokens.css` (the DS.1 reconciled token set). No hex here.
 *
 * `axonaColors` REPLACES Tailwind's default palette, so only token-backed
 * utilities exist. Shadow tokens are intentionally NOT exposed as utilities —
 * the product app keeps hairlines over shadows (brand invariant).
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
  mono: {
    faint: "var(--mono-faint)",
    ghost: "var(--mono-ghost)",
  },
  line: {
    DEFAULT: "var(--line)",
    soft: "var(--line-soft)",
    panel: "var(--line-panel)",
    strong: "var(--line-strong)",
    dark: "var(--line-dark)",
  },
  accent: {
    DEFAULT: "var(--accent)",
    hover: "var(--accent-hover)",
    ink: "var(--accent-ink)",
  },
  success: { DEFAULT: "var(--success)", tint: "var(--success-tint)" },
  "on-dark": {
    DEFAULT: "var(--on-dark)",
    mut: "var(--on-dark-mut)",
    faint: "var(--on-dark-faint)",
  },
};

/** Font families -> the semantic type tokens. */
export const axonaFontFamily: Record<"sans" | "mono", string[]> = {
  sans: ["var(--font-sans)"],
  mono: ["var(--font-mono)"],
};

/** Radii tokens. */
export const axonaBorderRadius: Record<
  "pill" | "btn" | "card" | "panel" | "sm",
  string
> = {
  pill: "var(--r-pill)",
  btn: "var(--r-btn)",
  card: "var(--r-card)",
  panel: "var(--r-panel)",
  sm: "var(--r-sm)",
};

/** Transition timing tokens (motion). */
export const axonaTransitionTimingFunction: Record<"ease", string> = {
  ease: "var(--ease)",
};
