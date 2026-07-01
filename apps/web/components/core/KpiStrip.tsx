import type { Kpi } from "@/lib/core-summary";

// Company header KPIs (v2 platform KpiStrip) — equal cells with a big tight
// number over a mono uppercase label. A responsive grid (hairline gaps) that
// fits all 5 across when the column is wide and wraps to 2–3 when narrow, so a
// value is never truncated. Severity dot: critical→ink, warn→lime.
export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((k) => (
        <div key={k.key} className="bg-paper px-4 py-[15px]">
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-bold leading-none tracking-[-0.03em] text-ink">
              {k.value}
            </span>
            {k.severity && k.severity !== "ok" && (
              <span
                aria-hidden
                className={`h-[6px] w-[6px] flex-none rounded-pill ${
                  k.severity === "critical" ? "bg-ink-strong" : "bg-accent"
                }`}
              />
            )}
          </div>
          <div className="mt-[5px] font-mono text-[9px] uppercase leading-[1.3] tracking-[0.05em] text-ink-muted">
            {k.label}
          </div>
        </div>
      ))}
    </div>
  );
}
