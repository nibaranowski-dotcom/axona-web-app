import type { RevenuePeriod } from "@/lib/finance";
import { fmtMoney, periodLabel } from "./format";

// Recognized-revenue chart — the two revenue engines (Finance.dc.html). Stacked
// bars per period: hardware (ink, lumpy — recognized at commissioning) at the
// base, RaaS (lime, ratable) on top. Brand palette only.
export function RevenueChart({ periods }: { periods: RevenuePeriod[] }) {
  const max = Math.max(1, ...periods.map((p) => p.total));
  const latest = periods[periods.length - 1];

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          Recognized revenue
        </h2>
        <span className="font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
          {periods.length} periods · $M
        </span>
      </div>
      <div className="text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
        {latest ? fmtMoney(latest.total) : "—"}
        <span className="text-[13px] font-medium text-ink-muted">
          {latest ? ` ${periodLabel(latest.period)} · hardware + RaaS` : ""}
        </span>
      </div>
      <div
        className="mt-4 flex h-[128px] items-end gap-[9px]"
        role="img"
        aria-label={`Recognized revenue over ${periods.length} periods, hardware plus RaaS${latest ? `, latest ${fmtMoney(latest.total)}` : ""}`}
      >
        {periods.map((p) => (
          <div
            key={p.period}
            className="flex h-full flex-1 flex-col justify-end gap-0.5"
            title={`${periodLabel(p.period)} · hw ${fmtMoney(p.hardware)} · RaaS ${fmtMoney(p.raas)}`}
          >
            <span
              className="rounded-t-[3px] bg-accent"
              style={{ height: `${(p.raas / max) * 100}%` }}
            />
            <span
              className="rounded-b-[3px] bg-ink-strong"
              style={{ height: `${(p.hardware / max) * 100}%` }}
            />
            <span className="mt-[3px] text-center font-mono text-[8.5px] text-ink-muted">
              {periodLabel(p.period)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t border-line pt-3">
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-[3px] bg-ink-strong"
          />
          Hardware · recognized at commissioning
        </span>
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
          RaaS · ratable
        </span>
      </div>
    </div>
  );
}
