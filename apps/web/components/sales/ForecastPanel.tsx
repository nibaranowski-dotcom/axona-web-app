import type { SalesDeal } from "@/lib/sales";
import { fmtMoney } from "./format";

// Q3 forecast (Sales & CRM.dc.html) — the weighted commit vs the un-weighted best
// case, with the swing deal (the largest at-risk deal) called out. Brand palette
// only.
//
// Note: the design's fixed quota/target marker needs a forecast/quota model the
// schema lacks → the bar shows weighted coverage of the best case instead (see
// SALES.2 notes).
export function ForecastPanel({
  weightedForecast,
  pipelineValue,
  swing,
}: {
  weightedForecast: number;
  pipelineValue: number;
  swing: SalesDeal | null;
}) {
  const pct = pipelineValue
    ? Math.min(100, Math.round((weightedForecast / pipelineValue) * 100))
    : 0;
  return (
    <div className="flex flex-col rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Q3 forecast</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Weighted
        </span>
      </div>
      <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">
        {fmtMoney(weightedForecast)}
        <span className="text-[14px] font-medium text-ink-muted"> commit</span>
      </div>

      <div className="relative mt-5 h-2.5 overflow-hidden rounded-pill bg-skeleton">
        <span
          className="absolute left-0 top-0 h-2.5 rounded-pill bg-ink-strong"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-[14px] flex items-center justify-between text-[12px]">
        <span className="text-ink-muted">Best case</span>
        <span className="font-mono font-semibold text-ink">
          {fmtMoney(pipelineValue)}
        </span>
      </div>

      {swing && (
        <div className="mt-auto flex items-start gap-2 border-t border-line pt-[14px]">
          <span
            aria-hidden
            className="mt-[5px] h-1.5 w-1.5 flex-none rounded-pill bg-accent"
          />
          <span className="text-[12px] leading-[1.4] text-ink-muted">
            {swing.account} ({fmtMoney(swing.value)}) is the swing — its
            deliverability is at risk
            {swing.deliverabilityReason
              ? ` (${swing.deliverabilityReason})`
              : ""}
            .
          </span>
        </div>
      )}
    </div>
  );
}
