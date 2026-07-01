"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { POStatus } from "@axona/db";
import type { QueuePO, ReorderCandidate } from "@/lib/procurement";
import { Pill } from "@/components/ui";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { PoQueue } from "./PoQueue";
import { ReorderBanner } from "./ReorderBanner";

export interface ProcurementData {
  pos: QueuePO[];
  reorderCandidates: ReorderCandidate[];
  agentCount: number;
  canApprove: boolean;
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

type Filter = "ALL" | POStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFTED", label: "Drafted" },
  { key: "AWAITING_APPROVAL", label: "Awaiting approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "SENT", label: "Sent" },
  { key: "RECEIVED", label: "Received" },
];

// The Procurement module screen (PROC.2, matching Procurement.dc.html on the v2
// shell): topbar, the sourcing agent's reorder banner, status/agent filters, and
// the PO-queue signature artifact. Data from PROC.1; approve is the role-gated
// server action. The copilot is the global Axona pane (seed + open) — "New order"
// and "Draft PO" route to it (the agent proposes; a human approves).
export function ProcurementView({
  data,
  error = false,
}: {
  data: ProcurementData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [agentOnly, setAgentOnly] = useState(false);

  const seed = (q: string) => {
    setSeed(q);
    setCollapsed(false); // open the Axona pane
  };

  const pos = data.pos.filter(
    (p) =>
      (filter === "ALL" || p.status === filter) &&
      (!agentOnly || p.agentDrafted),
  );
  const agentCount = data.pos.filter((p) => p.agentDrafted).length;
  const countFor = (f: Filter) =>
    f === "ALL"
      ? data.pos.length
      : data.pos.filter((p) => p.status === f).length;

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
            Value chain · {data.pos.length} POs
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Procurement
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            <span
              aria-hidden
              className="h-[7px] w-[7px] rounded-full bg-accent"
            />
            {data.agentCount} agents on shift
          </span>
          <button
            type="button"
            onClick={() =>
              seed("Draft a new purchase order for a part below reorder point")
            }
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New order
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load procurement. Check the database and refresh.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
          <ReorderBanner
            candidates={data.reorderCandidates}
            onDraft={() =>
              seed(
                `Draft a purchase order for ${data.reorderCandidates[0]?.sku ?? "the part below reorder point"}`,
              )
            }
          />

          <div>
            <div className="mb-[14px] flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Pill
                  key={f.key}
                  active={filter === f.key && !agentOnly}
                  onClick={() => {
                    setFilter(f.key);
                    setAgentOnly(false);
                  }}
                >
                  {f.label}
                  <span className="ml-2 font-mono text-[10.5px] opacity-70">
                    {countFor(f.key)}
                  </span>
                </Pill>
              ))}
              <Pill active={agentOnly} onClick={() => setAgentOnly((v) => !v)}>
                Agent-drafted
                <span className="ml-2 font-mono text-[10.5px] opacity-70">
                  {agentCount}
                </span>
              </Pill>
            </div>

            <PoQueue pos={pos} canApprove={data.canApprove} />
          </div>

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · proc-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
