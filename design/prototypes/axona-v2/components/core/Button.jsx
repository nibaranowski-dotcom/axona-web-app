import React from "react";

/**
 * Axona primary action. Lime by default; dark and ghost variants for
 * secondary placement. Pill-ish radius, weight 600, no shadow.
 */
export function Button({
  variant = "primary",
  size = "md",
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: { padding: "8px 16px", fontSize: 13.5 },
    md: { padding: "11px 20px", fontSize: 14.5 },
    lg: { padding: "14px 26px", fontSize: 15.5 },
  };
  const variants = {
    primary: { background: "var(--accent)", color: "var(--accent-ink)", border: "1px solid var(--accent)" },
    dark:    { background: "var(--ink-strong)", color: "var(--on-dark)", border: "1px solid var(--ink-strong)" },
    ghost:   { background: "transparent", color: "var(--ink)", border: "1px solid var(--line-strong)" },
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = hover
    ? variant === "primary"
      ? { background: "var(--accent-hover)", borderColor: "var(--accent-hover)" }
      : variant === "dark"
        ? { background: "#000" }
        : { borderColor: "var(--ink-strong)" }
    : null;
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--fw-semibold)",
        borderRadius: "var(--r-btn)",
        cursor: "pointer",
        lineHeight: 1,
        transition: "background var(--dur) var(--ease), border-color var(--dur) var(--ease)",
        ...sizes[size],
        ...variants[variant],
        ...hoverStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
