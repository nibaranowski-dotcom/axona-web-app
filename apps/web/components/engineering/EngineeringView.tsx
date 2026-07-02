"use client";

import { Plus } from "lucide-react";
import type { EngineeringData } from "@/lib/engineering";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { EcoTable } from "./EcoTable";
import { CompatMatrix } from "./CompatMatrix";
import { FirmwareReleases } from "./FirmwareReleases";

export interface EngineeringScreenData extends EngineeringData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
  canAdvance: boolean;
}

// The Engineering & PLM screen (ENG.2, matching Engineering.dc.html on the v2
// shell): the change-orders table + the HW↔firmware compat matrix lead
// (signature artifacts), then firmware releases + the agent trace. Read-only from
// ENG.1; release advance is the role-gated server action. Engineering agents come
// in the module-aware pane automatically. "New ECO" routes to the agent
// (proposes; a human releases).
export function EngineeringView({
  data,
  error = false,
}: {
  data: EngineeringScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const inReview = data.ecos.filter((e) => e.stage === "REVIEW").length;
  const totalEcos = data.ecos.length;
  const currentHwRev = data.compatMatrix.hwRevs[0] ?? "—";
  const releasedFw =
    data.firmwareReleases.find((f) => f.state.toUpperCase() === "RELEASED")
      ?.version ?? "—";
  const hasData =
    totalEcos > 0 ||
    data.firmwareReleases.length > 0 ||
    data.compatMatrix.cells.length > 0;

  // Design metrics (real data). "Avg change cycle" needs ECO timestamps we don't
  // model yet (no new columns) → the computable "In review" fills that slot.
  const stats = [
    { v: totalEcos, l: "Open ECOs" },
    { v: inReview, l: "In review" },
    { v: currentHwRev, l: "Current HW rev" },
    { v: releasedFw, l: "Released firmware" },
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
            Robotics · product platform
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Engineering &amp; PLM
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className="h-[7px] w-[7px] rounded-full bg-accent"
            />
            {inReview} ECO{inReview === 1 ? "" : "s"} in review
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Draft an ECO to supersede a part from an open NCR");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New ECO
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load engineering data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No engineering data — run the seed (
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

          <EcoTable ecos={data.ecos} canAdvance={data.canAdvance} />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <CompatMatrix matrix={data.compatMatrix} />
            <FirmwareReleases releases={data.firmwareReleases} />
          </div>

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · eng-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
