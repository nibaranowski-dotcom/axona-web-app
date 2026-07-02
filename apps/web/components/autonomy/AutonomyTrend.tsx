import type { AutonomySeries } from "@/lib/autonomy";

// Autonomy-rate trend — the Autonomy signature artifact (Autonomy.dc.html). Bars
// = autonomy rate over time (tall = good), normalized to the window so the p-13
// canary dip is visible. The p-13 cohort bars read lime; the worst (lowest) bar
// is ink (the intervention low). Brand palette only.
export function AutonomyTrend({
  series,
  fleetRate,
}: {
  series: AutonomySeries;
  fleetRate: number;
}) {
  const rates = series.points.map((p) => p.autonomyRate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const siteRate = series.points[series.points.length - 1]?.autonomyRate ?? 0;
  const lowIdx = rates.indexOf(min);

  const height = (v: number) =>
    max === min ? 100 : 20 + (80 * (v - min)) / (max - min);

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Autonomy rate</h2>
        <span className="font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
          {series.points.length}d · takeovers / 1k
        </span>
      </div>
      <div className="text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
        {fleetRate}%
        <span className="text-[13px] font-medium text-ink-muted">
          {" "}
          fleet · {siteRate}% {series.site}
        </span>
      </div>
      <div
        className="mt-[14px] flex h-[120px] items-end gap-[5px]"
        role="img"
        aria-label={`Autonomy rate over ${series.points.length} days for ${series.site} — ${series.regression ? "regressing on the p-13 canary" : "stable"} (latest ${siteRate}%)`}
      >
        {series.points.map((p, i) => {
          const canary = p.policyVersion === "p-13";
          const color =
            i === lowIdx
              ? "bg-ink-strong"
              : canary
                ? "bg-accent"
                : "bg-ink-faint";
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-[3px] ${color}`}
              style={{ height: `${height(p.autonomyRate)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-[11px] flex items-center gap-2 border-t border-line pt-[11px]">
        <span
          aria-hidden
          className="h-2.5 w-2.5 flex-none rounded-[3px] bg-accent"
        />
        <span className="text-[12px] text-ink-muted">
          p-13 canary cohort ({series.site}) — intervention rate up
        </span>
      </div>
    </div>
  );
}
