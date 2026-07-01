import type { Kpi, Severity } from "@/lib/core-summary";

// DS.1 KPI tile — mono value + label + optional severity dot. Severity maps to
// brand tokens only: critical→ink, warn→lime, ok→success green.
const sevDot: Record<Severity, string> = {
  critical: "bg-ink-strong",
  warn: "bg-accent",
  ok: "bg-success",
};
const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  warn: "Warning",
  ok: "OK",
};

export function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <div className="rounded-card border border-line-panel bg-panel px-4 py-3">
      <div className="flex items-center gap-2">
        {kpi.severity && (
          <span
            role="img"
            aria-label={sevLabel[kpi.severity]}
            className={`h-2 w-2 flex-none rounded-pill ${sevDot[kpi.severity]}`}
          />
        )}
        <span className="font-mono text-lg font-medium text-ink-strong">
          {kpi.value}
        </span>
      </div>
      <div className="mt-1 text-[12px] leading-snug text-ink-muted">
        {kpi.label}
      </div>
      {kpi.hint && (
        <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
          {kpi.hint}
        </div>
      )}
    </div>
  );
}
