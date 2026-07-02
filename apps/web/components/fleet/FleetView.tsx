"use client";

import { Plus } from "lucide-react";
import type { FleetData } from "@/lib/fleet";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { FleetHealth } from "./FleetHealth";
import { DeploymentMap } from "./DeploymentMap";
import { FirmwarePanel } from "./FirmwarePanel";
import { LiveUnits } from "./LiveUnits";

export interface FleetScreenData extends FleetData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

const DOWN = new Set(["FAULT", "OFFLINE"]);

// The Fleet & Deployment screen (FLEET.2, matching Fleet.dc.html on the v2
// shell): the fleet-health distribution, then the deployment map (signature
// artifact) + the OTA firmware panel, then the live-units table, then the agent
// trace. Read-only from FLEET.1 (predictive alerts hand off to Field Service);
// the Fleet agents come in the module-aware pane automatically. "Schedule
// rollout" routes to the OTA agent (proposes; a real rollout is a gated write —
// deferred, see notes).
export function FleetView({
  data,
  error = false,
}: {
  data: FleetScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const total = data.rollup.total;
  const sites = new Set(data.robots.map((r) => r.site)).size;
  const down = data.robots.filter((r) =>
    DOWN.has(r.status.toUpperCase()),
  ).length;
  const latestFw = data.rollup.firmware[0]?.version ?? "—";
  const onLatest = data.rollup.firmware[0]?.count ?? 0;
  const onLatestPct = total ? Math.round((onLatest / total) * 100) : 0;
  const hasData = total > 0;

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
            Robotics · {total} units · {sites} sites
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Fleet &amp; Deployment
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${down > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {down} unit{down === 1 ? "" : "s"} down
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed(
                "Schedule the v4.2.1 OTA rollout to the units still behind",
              );
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Schedule rollout
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load fleet data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No fleet units — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
          <FleetHealth
            rollup={data.rollup}
            onLatestPct={onLatestPct}
            latestFw={latestFw}
          />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <DeploymentMap robots={data.robots} />
            <FirmwarePanel rollup={data.rollup} />
          </div>

          <LiveUnits
            robots={data.robots}
            telemetry={data.telemetry}
            latestFw={latestFw}
          />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · flt-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
