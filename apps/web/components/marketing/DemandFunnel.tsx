import type { DemandFunnel as FunnelData } from "@/lib/marketing";
import { fmtMoney, fmtNum } from "./format";

// Demand funnel (Marketing.dc.html) — Leads → MQL → SQL → Pipeline, narrowing
// through the stages, terminal Pipeline in lime. Brand palette only.
//
// Note: Leads are estimated from MQLs (no lead model); SQL + Pipeline are
// reconciled to SALES.1. The enterprise funnel narrows sharply (many MQLs, few
// large deals) so bars carry a min-width for visibility (see MKT.2 notes).
export function DemandFunnel({ funnel }: { funnel: FunnelData }) {
  const top = Math.max(1, funnel.leads);
  const pct = (v: number) => `${Math.max(4, Math.round((v / top) * 100))}%`;
  const conv = (num: number, den: number) =>
    den > 0 ? `${Math.round((num / den) * 100)}%` : "";

  const stages = [
    {
      label: "Leads",
      count: fmtNum(funnel.leads),
      width: pct(funnel.leads),
      conv: "",
      last: false,
    },
    {
      label: "MQL",
      count: fmtNum(funnel.mql),
      width: pct(funnel.mql),
      conv: conv(funnel.mql, funnel.leads),
      last: false,
    },
    {
      label: "SQL",
      count: fmtNum(funnel.sql),
      width: pct(funnel.sql),
      conv: conv(funnel.sql, funnel.mql),
      last: false,
    },
    {
      label: "Pipeline",
      count: fmtMoney(funnel.pipeline),
      width: pct(funnel.sql),
      conv: "",
      last: true,
    },
  ];

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Demand funnel</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Leads → pipeline
        </span>
      </div>
      {stages.map((s) => (
        <div key={s.label} className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="inline-flex items-center gap-2 text-ink">
              {s.label}
              {s.conv && (
                <span className="font-mono text-[10px] text-ink-muted">
                  {s.conv}
                </span>
              )}
            </span>
            <span className="font-mono text-[12px] font-semibold text-ink">
              {s.count}
            </span>
          </div>
          <div className="h-[9px] overflow-hidden rounded-[5px] bg-skeleton">
            <span
              className={`block h-[9px] ${s.last ? "bg-accent" : "bg-ink-faint"}`}
              style={{ width: s.width }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
