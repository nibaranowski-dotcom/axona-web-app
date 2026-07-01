import React from "react";

/**
 * Full-width architecture "layer" row — mono tag on the left, title +
 * body on the right. Used for the L1–L4 platform stack.
 */
export function LayerRow({ tag, title, body, style, ...rest }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--r-card)",
        background: "var(--panel)",
        color: "var(--ink)",
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        gap: 28,
        flexWrap: "wrap",
        border: "1px solid var(--line)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", color: "var(--mono-faint)", minWidth: 230 }}>
        {tag}
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: "var(--fw-semibold)", letterSpacing: "var(--track-tight)" }}>
          {title}
        </h3>
        <p style={{ margin: "6px 0 0", fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.45, color: "var(--ink-muted)", maxWidth: "74ch" }}>
          {body}
        </p>
      </div>
    </div>
  );
}
