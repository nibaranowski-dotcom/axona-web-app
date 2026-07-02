"use client";

import { Plus } from "lucide-react";
import type { FieldServiceData } from "@/lib/field-service";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { DispatchBoard } from "./DispatchBoard";
import { WorkOrderQueue } from "./WorkOrderQueue";

export interface FieldServiceScreenData extends FieldServiceData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Field Service & Maintenance screen (FIELD.2, matching Field Service.dc.html
// on the v2 shell): the technician dispatch board leads (signature artifact),
// then the SLA-tracked work-order queue, then the agent trace. Read-only from
// FIELD.1; the Field Service agents come in the module-aware pane automatically.
// "+ Work order" routes to the agent (proposes; creating a WO is a gated write —
// deferred, see notes).
export function FieldServiceView({
  data,
  error = false,
}: {
  data: FieldServiceScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const sites = new Set(data.technicians.map((t) => t.site)).size;
  const techCount = data.technicians.length;
  const atRisk = data.sla.dueSoon + data.sla.breached;
  const onTimePct =
    data.sla.open === 0
      ? 100
      : Math.round(((data.sla.open - data.sla.breached) / data.sla.open) * 100);
  const hasData = data.workOrders.length > 0 || techCount > 0;

  // Design metrics (real data). "Mean time to repair" / "first-time fix" need
  // opened/closed timestamps + repair outcomes the model doesn't carry → the
  // computable "SLA at risk" + "Techs" fill those slots (see notes).
  const stats = [
    { v: data.sla.open, l: "Open work orders" },
    { v: `${onTimePct}%`, l: "SLA on-time" },
    { v: atRisk, l: "SLA at risk" },
    { v: techCount, l: "Techs" },
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
            Robotics · {sites} sites · {techCount} techs
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Field Service &amp; Maintenance
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${atRisk > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {atRisk} SLA at risk
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Open a work order and dispatch a certified technician");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Work order
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load field-service data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No work orders — run the seed (
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

          <DispatchBoard board={data.board} />

          <WorkOrderQueue
            workOrders={data.workOrders}
            technicians={data.technicians}
          />

          {trace.length > 0 && (
            <TraceConsole lines={trace} title="Agent trace · fs-orchestrator" />
          )}
        </div>
      )}
    </div>
  );
}
