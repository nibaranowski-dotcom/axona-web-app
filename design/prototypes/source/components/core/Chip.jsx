import React from "react";

/**
 * Selectable pill chip used for domain/vertical tab rows and filters.
 * Active state is solid near-black; inactive is outlined on paper.
 */
export function Chip({ active = false, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: "var(--fw-medium)",
        padding: "8px 15px",
        borderRadius: "var(--r-pill)",
        cursor: "pointer",
        transition: "border-color var(--dur) var(--ease)",
        background: active ? "var(--ink-strong)" : "var(--paper)",
        color: active ? "var(--on-dark)" : "var(--ink-muted)",
        border: `1px solid ${active ? "var(--ink-strong)" : hover ? "var(--ink-strong)" : "var(--line-strong)"}`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
