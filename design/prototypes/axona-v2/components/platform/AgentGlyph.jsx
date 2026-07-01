import React from "react";

/**
 * The Axona agent identity mark — a static 12-dot ring. Used as the avatar
 * for every agent across the platform (chat header, avatar switcher, message
 * rows, collapsed rail). Deliberately NOT animated — it reads as an identity
 * glyph, not a loading spinner. Optionally carries a small status dot.
 */
export function AgentGlyph({ size = 24, fill = "#1b1b1f", status, ring, style, ...rest }) {
  const dots = [
    [12, 4.6], [15.7, 5.6], [18.4, 8.3], [19.4, 12], [18.4, 15.7], [15.7, 18.4],
    [12, 19.4], [8.3, 18.4], [5.6, 15.7], [4.6, 12], [5.6, 8.3], [8.3, 5.6],
  ];
  const ringStyle = ring
    ? { boxShadow: `0 0 0 ${ring === "active" ? 2 : 1}px ${ring === "active" ? "var(--ink-strong)" : "var(--line-strong)"}` }
    : null;
  return (
    <span
      style={{ position: "relative", display: "inline-flex", borderRadius: "50%", padding: ring ? 2 : 0, ...ringStyle, ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.55} />
        ))}
      </svg>
      {status && (
        <span
          style={{
            position: "absolute", right: 0, bottom: 0, width: "28%", height: "28%",
            minWidth: 6, minHeight: 6, borderRadius: "50%",
            background: status, border: "1.5px solid var(--panel)",
          }}
        />
      )}
    </span>
  );
}
