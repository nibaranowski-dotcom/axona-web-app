"use client";

import { Plus } from "lucide-react";
import type { GenealogyStep, ManufacturingData } from "@/lib/manufacturing";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { LineFlowBoard } from "./LineFlowBoard";
import { BuildGenealogy } from "./BuildGenealogy";
import { ThroughputPanel } from "./ThroughputPanel";
import { StatStrip } from "@/components/shell/StatStrip";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

export interface MfgScreenData extends ManufacturingData {
  genealogySerial: string;
  genealogySteps: GenealogyStep[];
  heldSerial: string | null;
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Manufacturing (MES) screen (MFG.2, matching Manufacturing.dc.html on the v2
// shell): the scheduler-agent flag (when a unit is held), production summary, the
// line-flow station board (signature artifact), the per-serial build genealogy +
// throughput, then the agent trace. Read-only from MFG.1; the Manufacturing
// agents come in the module-aware pane automatically. "+ Work order" / "Apply"
// route to the agent (propose; the real re-sequence is a gated write — deferred).
export function MfgView({
  data,
  error = false,
}: {
  data: MfgScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const propose = (prompt: string) => {
    setSeed(prompt);
    setCollapsed(false);
  };

  const t = data.throughput;
  const stations = data.lineFlow.length;
  const hasData = t.total > 0;

  // Real throughput counts. The design's "on-time build / first-pass yield /
  // units-day / takt" need an OEE feed the MES model doesn't carry (see notes).
  const stats = [
    { v: t.total, l: "In build" },
    { v: t.inProgress, l: "In progress" },
    { v: t.built, l: "Built" },
    { v: t.onHold, l: "On hold" },
  ];

  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? l.ts.slice(11, 19) : undefined,
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));

  return (
    <ScreenShell
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Value chain · {stations} stations · {t.total} in build
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Manufacturing
            </h1>
          </div>
          <div className="flex items-center gap-[14px]">
            <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className={`h-[7px] w-[7px] rounded-full ${t.onHold > 0 ? "bg-ink-strong" : "bg-success"}`}
              />
              {t.onHold > 0 ? `${t.onHold} on hold` : "Lines running"}
            </span>
            <button
              type="button"
              onClick={() => propose("Open a new manufacturing work order")}
              className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Work order
            </button>
          </div>
        </>
      }
    >
      {error ? (
        <ScreenMessage>
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load manufacturing data. Check the database and refresh.
          </p>
        </ScreenMessage>
      ) : !hasData ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No units in build — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </ScreenMessage>
      ) : (
        <>
          {/* scheduler-agent flag (when a unit is held) */}
          {data.heldSerial && (
            <div className="flex flex-wrap items-center justify-between gap-[14px] rounded-card border border-accent bg-paper px-[18px] py-4">
              <div className="flex min-w-0 items-start gap-[13px]">
                <span
                  aria-hidden
                  className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent"
                />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">
                    Scheduler agent re-sequenced the line
                  </div>
                  <div className="mt-1 max-w-[66ch] text-[13px] leading-[1.45] text-ink-muted">
                    The{" "}
                    <span className="font-mono text-[12px]">
                      {data.heldSerial}
                    </span>{" "}
                    payload test failed and holds a station. I moved the next
                    work orders to keep the on-time date — review before
                    applying.
                  </div>
                </div>
              </div>
              <div className="flex flex-none gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    propose(`Show the re-sequence diff for ${data.heldSerial}`)
                  }
                  className="rounded-btn border border-line-strong bg-paper px-[15px] py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  View diff
                </button>
                <button
                  type="button"
                  onClick={() =>
                    propose(
                      `Apply the scheduler re-sequence for ${data.heldSerial}`,
                    )
                  }
                  className="rounded-btn bg-accent px-[15px] py-2 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* production summary */}
          <StatStrip stats={stats} />

          <LineFlowBoard lineFlow={data.lineFlow} />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.45fr_1fr]">
            <BuildGenealogy
              serial={data.genealogySerial}
              steps={data.genealogySteps}
            />
            <ThroughputPanel
              throughput={data.throughput}
              bottlenecks={data.bottlenecks}
            />
          </div>

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · mfg-orchestrator"
            />
          )}
        </>
      )}
    </ScreenShell>
  );
}
