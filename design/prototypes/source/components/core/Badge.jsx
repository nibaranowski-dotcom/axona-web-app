import React from "react";

/**
 * Small status/label badge. `accent` = lime "Coming soon"/highlight,
 * `success` = green live/approved tint, `neutral` = grey.
 */
export function Badge({ tone = "accent", children, style, ...rest }) {
  const tones = {
    accent:  { background: "var(--accent)", color: "var(--accent-ink)" },
    success: { background: "var(--success-tint)", color: "var(--success)" },
    neutral: { background: "var(--panel)", color: "var(--ink-muted)" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-sans)",
        fontSize: 10.5,
        fontWeight: "var(--fw-semibold)",
        letterSpacing: ".04em",
        padding: "3px 9px",
        borderRadius: "var(--r-pill)",
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
