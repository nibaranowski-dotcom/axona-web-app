"use client";

import { Plus } from "lucide-react";
import type { AutonomyData } from "@/lib/autonomy";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { AutonomyTrend } from "./AutonomyTrend";
import { PolicyPanel } from "./PolicyPanel";
import { SafetyIncidents } from "./SafetyIncidents";

export interface AutonomyScreenData extends AutonomyData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
  canManage: boolean;
}

// The Robotics Ops / Autonomy screen (AUTO.2, matching Autonomy.dc.html on the v2
// shell): the autonomy-rate trend (signature artifact) + the policy panel, then
// the safety-incident log, then the agent trace. Read-only reads from AUTO.1;
// promote/rollback is the role-gated server action. The Autonomy agents come in
// the module-aware pane automatically. "Safety review" routes to the agent.
export function AutonomyView({
  data,
  error = false,
}: {
  data: AutonomyScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const trendSeries =
    data.autonomySeries.find((s) => s.regression) ?? data.autonomySeries[0];
  const sites = data.autonomySeries.length;
  const open = data.rollup.openIncidents;
  const hasData =
    data.autonomySeries.length > 0 || data.policyVersions.length > 0;

  // Design metrics (real data). "Tasks today" / "safety events · 24h" need a task
  // count + a time window the model doesn't carry → Sites monitored + Open
  // incidents fill those slots (see notes).
  const stats = [
    { v: `${data.rollup.avgAutonomyRate}%`, l: "Autonomy rate" },
    { v: data.rollup.avgTakeoversPer1k, l: "Takeovers / 1k" },
    { v: sites, l: "Sites monitored" },
    { v: open, l: "Open incidents" },
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
            Robotics · {sites} sites · live missions
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Robotics Ops / Autonomy
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${open > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {open} safety incident{open === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Open a safety review for the Site-3 p-13 regression");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Safety review
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load autonomy data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No autonomy data — run the seed (
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

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            {trendSeries && (
              <AutonomyTrend
                series={trendSeries}
                fleetRate={data.rollup.avgAutonomyRate}
              />
            )}
            <PolicyPanel
              policies={data.policyVersions}
              canManage={data.canManage}
            />
          </div>

          <SafetyIncidents incidents={data.safetyIncidents} />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · auto-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
