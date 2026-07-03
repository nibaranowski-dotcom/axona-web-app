"use client";

import { Plus } from "lucide-react";
import type { PeopleData } from "@/lib/people";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { CertMatrix } from "./CertMatrix";
import { FieldTeamGrowth } from "./FieldTeamGrowth";
import { HeadcountPanel } from "./HeadcountPanel";
import { certCompliance } from "./format";

export interface PeopleScreenData extends PeopleData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The People & Workforce screen (PPL.2, matching People.dc.html on the v2 shell):
// the certification matrix (signature artifact) that gates field dispatch, then
// field-team-growth + headcount, then the agent trace. Read-only from PPL.1; the
// People agents come in the module-aware pane automatically. "Open requisition"
// routes to the agent (proposes; opening a req is a gated write — deferred).
export function PeopleView({
  data,
  error = false,
}: {
  data: PeopleScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const r = data.rollup;
  const sites = new Set(data.fieldTeam.map((t) => t.site)).size;
  const openPositions = data.requisitions.reduce((n, q) => n + q.open, 0);
  const compliance = certCompliance(data.certMatrix.technicians);
  const hasData =
    data.certMatrix.technicians.length > 0 || data.requisitions.length > 0;

  // Design metrics — real where derivable. "Headcount" (org-wide) is approximated
  // by the requisition fill; a first-class people/org model isn't in the schema.
  const stats = [
    { v: r.headcountFilled, l: "Headcount" },
    { v: r.fieldTeamSize, l: "Field techs" },
    { v: openPositions, l: "Open positions" },
    { v: `${compliance}%`, l: "Cert compliance" },
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
            Back office · {r.headcountFilled} people · {sites} sites
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            People &amp; Workforce
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-[7px] w-[7px] rounded-full ${r.certsExpiring > 0 ? "bg-ink-strong" : "bg-success"}`}
            />
            {r.certsExpiring} cert{r.certsExpiring === 1 ? "" : "s"} expiring
          </span>
          <button
            type="button"
            onClick={() => {
              setSeed("Open a requisition for the field team");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Open requisition
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load people data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No people data — run the seed (
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

          <CertMatrix matrix={data.certMatrix} />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.3fr_1fr]">
            <FieldTeamGrowth requisitions={data.requisitions} />
            <HeadcountPanel
              requisitions={data.requisitions}
              total={data.rollup.headcountFilled}
            />
          </div>

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · ppl-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
