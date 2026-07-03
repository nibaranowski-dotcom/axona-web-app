"use client";

import { Plus } from "lucide-react";
import type { MarketingData } from "@/lib/marketing";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { DemandFunnel } from "./DemandFunnel";
import { ChannelAttribution } from "./ChannelAttribution";
import { CampaignsTable } from "./CampaignsTable";
import { fmtMoney, fmtNum } from "./format";

export interface MarketingScreenData extends MarketingData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Marketing screen (MKT.2, matching Marketing.dc.html on the v2 shell): the
// demand funnel + pipeline-by-channel attribution (signature artifacts), then the
// campaigns table (underperforming paid flagged), then the agent trace. Read-only
// from MKT.1; the Marketing agents come in the module-aware pane automatically.
// "New campaign" routes to the agent (proposes; budget reallocation / SQL hand-off
// / launch are agent-drafted, gated writes — deferred, see notes).
export function MarketingView({
  data,
  error = false,
}: {
  data: MarketingScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const r = data.rollup;
  const hasData = data.campaigns.length > 0;

  // The design's "MQL→SQL rate / cost-per-MQL" need a web-analytics / spend model
  // the schema lacks → MQLs, sourced pipeline, SQLs, and the underperforming count
  // fill the strip (see notes).
  const stats = [
    { v: fmtNum(r.funnel.mql), l: "MQLs" },
    { v: fmtMoney(r.sourcedPipeline), l: "Sourced pipeline" },
    { v: r.funnel.sql, l: "SQLs → Sales" },
    { v: r.underperforming, l: "Underperforming" },
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
            Value chain · demand &amp; pipeline
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Marketing
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className="h-[7px] w-[7px] rounded-full bg-accent"
            />
            {r.attributionCoveragePct}% pipeline sourced
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed(
                "Draft a new campaign and reallocate underperforming spend",
              );
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New campaign
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load marketing data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No campaigns — run the seed (
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

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            <DemandFunnel funnel={r.funnel} />
            <ChannelAttribution channels={r.attribution} />
          </div>

          <CampaignsTable campaigns={data.campaigns} />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · mkt-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
