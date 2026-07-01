import React from "react";

/**
 * Mono key→value data chip used in stat strips and product captions.
 * Monospace, grey panel fill, hairline border.
 */
export function StatChip({ label, value, style, ...rest }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }} {...rest}>
      {label != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".04em", color: "var(--ink-faint)", textTransform: "uppercase" }}>
          {label}:
        </span>
      )}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: "var(--fw-medium)", background: "var(--panel)", border: "1px solid var(--line-panel)", borderRadius: 5, padding: "2px 7px" }}>
        {value}
      </span>
    </span>
  );
}
