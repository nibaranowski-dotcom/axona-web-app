import type { StageCount } from "@/lib/sales";
import { fmtMoney, titleCase } from "./format";

// Pipeline funnel (Sales & CRM.dc.html) — value per stage as a bar, Commit
// (the closing stage) in lime. Brand palette only.
export function PipelineFunnel({
  funnel,
  deals,
  pipelineValue,
}: {
  funnel: StageCount[];
  deals: number;
  pipelineValue: number;
}) {
  const max = Math.max(1, ...funnel.map((f) => f.value));
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Pipeline</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {deals} deals · {fmtMoney(pipelineValue)}
        </span>
      </div>
      {funnel.map((f, i) => {
        const pct = Math.round((f.value / max) * 100);
        const last = i === funnel.length - 1;
        return (
          <div key={f.stage} className="mb-[13px]">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="inline-flex items-center gap-2 text-ink">
                {titleCase(f.stage)}
                <span className="font-mono text-[10px] text-ink-muted">
                  {f.count}
                </span>
              </span>
              <span className="font-mono text-[12px] font-semibold text-ink">
                {fmtMoney(f.value)}
              </span>
            </div>
            <div className="h-[9px] overflow-hidden rounded-[5px] bg-skeleton">
              <span
                className={`block h-[9px] ${last ? "bg-accent" : "bg-ink-faint"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
