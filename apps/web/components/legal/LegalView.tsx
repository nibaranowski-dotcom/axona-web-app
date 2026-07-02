"use client";

import { Plus } from "lucide-react";
import type { LegalData } from "@/lib/legal";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { ObligationsPanel } from "./ObligationsPanel";
import { ExportControl } from "./ExportControl";
import { MattersTable } from "./MattersTable";

export interface LegalScreenData extends LegalData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Legal & Compliance screen (LEGAL.2, matching Legal.dc.html on the v2
// shell): contract obligations vs live ops + export control, then matters &
// compliance (linked to source modules), then the agent trace. Read-only from
// LEGAL.1; the Legal agents come in the module-aware pane automatically. "New
// matter" routes to the agent (proposes; creating a matter is a gated write —
// deferred, see notes).
export function LegalView({
  data,
  error = false,
}: {
  data: LegalScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const atRisk = data.rollup.obligationsAtRisk;
  const hasData =
    data.obligations.length > 0 ||
    data.legalMatters.length > 0 ||
    data.exportLicenses.length > 0;

  // Design metrics — real where derivable. "Active contracts" needs a Contract
  // model the schema doesn't carry → "Obligations tracked" fills that slot.
  const stats = [
    { v: data.obligations.length, l: "Obligations tracked" },
    { v: atRisk, l: "Obligations at risk" },
    { v: data.exportLicenses.length, l: "Export licenses" },
    { v: data.rollup.openMatters, l: "Open matters" },
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
            Back office · contracts · compliance · risk
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Legal &amp; Compliance
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${atRisk > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {atRisk} SLA obligation{atRisk === 1 ? "" : "s"} at risk
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Open a new legal matter and link it to its source");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New matter
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load legal data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No legal data — run the seed (
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
            <ObligationsPanel obligations={data.obligations} />
            <ExportControl licenses={data.exportLicenses} />
          </div>

          <MattersTable matters={data.legalMatters} />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · legal-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
