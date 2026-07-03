"use client";

import { Plus } from "lucide-react";
import type { SalesData } from "@/lib/sales";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { PipelineFunnel } from "./PipelineFunnel";
import { ForecastPanel } from "./ForecastPanel";
import { DealsTable } from "./DealsTable";
import { fmtMoney } from "./format";

export interface SalesScreenData extends SalesData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Sales & CRM screen (SALES.2, matching Sales & CRM.dc.html on the v2 shell):
// the pipeline funnel + Q3 forecast, then the top-deals table with the agent-
// checked deliverability badge (signature artifact), then the agent trace. Read-
// only from SALES.1; the Sales agents come in the module-aware pane automatically.
// "+ New deal" routes to the agent (proposes; CPQ config / quote / contract are
// agent-drafted, gated writes — deferred, see notes).
export function SalesView({
  data,
  error = false,
}: {
  data: SalesScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const r = data.rollup;
  const swing =
    [...data.deals]
      .filter((d) => d.deliverability === "AT_RISK")
      .sort((a, b) => b.value - a.value)[0] ?? null;
  const hasData = data.deals.length > 0;

  // The design's "win rate / avg cycle / % to target" need a won-lost / cycle-
  // time / quota model the schema lacks → Deals + At-risk fill those slots (see
  // notes).
  const stats = [
    { v: fmtMoney(r.pipelineValue), l: "Pipeline" },
    { v: fmtMoney(r.weightedForecast), l: "Weighted" },
    { v: data.deals.length, l: "Deals" },
    { v: r.atRisk, l: "At risk" },
  ];

  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? l.ts.slice(11, 19) : undefined,
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Value chain · Q3 pipeline
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Sales &amp; CRM
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${r.atRisk > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {r.atRisk} deal{r.atRisk === 1 ? "" : "s"} at risk
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Configure a new deal (CPQ) and feasibility-check it");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New deal
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load sales data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No deals — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
          {/* summary strip */}
          <div className="flex overflow-hidden rounded-card border border-line bg-paper">
            {stats.map((s, i) => (
              <div
                key={s.l}
                className={`flex-1 px-[18px] py-[15px] ${i ? "border-l border-line" : ""}`}
              >
                <div className="text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {s.v}
                </div>
                <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.35fr_1fr]">
            <PipelineFunnel
              funnel={r.funnel}
              deals={data.deals.length}
              pipelineValue={r.pipelineValue}
            />
            <ForecastPanel
              weightedForecast={r.weightedForecast}
              pipelineValue={r.pipelineValue}
              swing={swing}
            />
          </div>

          <DealsTable deals={data.deals} />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · crm-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
