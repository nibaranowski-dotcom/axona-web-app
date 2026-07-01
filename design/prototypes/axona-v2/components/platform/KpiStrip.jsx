import React from "react";

/**
 * Horizontal KPI strip — the summary row at the top of every platform module.
 * A flat warm-grey panel of equal cells separated by hairlines: a big tight
 * number over a mono uppercase label. No borders between, no shadow.
 */
export function KpiStrip({ stats = [], style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {stats.map((s, i) => (
        <div key={i} style={{ flex: 1, padding: "15px 18px", borderLeft: i ? "1px solid var(--line)" : "none" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: "var(--fw-bold)", letterSpacing: "-.03em", color: "var(--ink)" }}>
            {s.value}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".05em", color: "var(--ink-faint)", textTransform: "uppercase", marginTop: 3 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
