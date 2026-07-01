import React from "react";

/**
 * Warm-grey feature/product card. Title + body, with an optional
 * skeleton "mock UI" footer panel (the signature Axona card shape).
 */
export function Card({ title, body, caption, children, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        borderRadius: "var(--r-card)",
        padding: "26px 26px 0",
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
      {...rest}
    >
      {title && (
        <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: "var(--fw-semibold)", letterSpacing: "var(--track-tight)", color: "var(--ink)" }}>
          {title}
        </h3>
      )}
      {body && (
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--ink-muted)", lineHeight: 1.45, maxWidth: "42ch" }}>
          {body}
        </p>
      )}
      <div style={{ marginTop: "auto", paddingTop: 22 }}>
        {children || (
          <div style={{ background: "var(--paper)", border: "1px solid var(--line-panel)", borderRadius: "10px 10px 0 0", borderBottom: "none", height: 150, padding: 16, overflow: "hidden" }}>
            {caption && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".06em", color: "var(--mono-ghost)" }}>{caption}</div>
            )}
            {[100, 78, 88, 64].map((w, i) => (
              <div key={i} style={{ height: 8, background: "var(--skeleton)", borderRadius: 4, marginTop: i === 0 ? 14 : 9, width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
