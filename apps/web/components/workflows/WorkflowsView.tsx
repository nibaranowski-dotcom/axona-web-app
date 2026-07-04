"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { WorkflowRow, WorkflowsData } from "@/lib/workflows";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { StatStrip } from "@/components/shell/StatStrip";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { STATUS_BADGE, lastRunLabel } from "./format";

export interface WorkflowsScreenData extends WorkflowsData {
  now: number;
}

const COLS = "grid grid-cols-[2.6fr_1.2fr_1.1fr_0.9fr] items-center gap-[14px]";
const CHAIN_CAP = 4;

// The Workflows screen (WFL.1, matching Workflows.dc.html on the v2 shell): agent
// orchestration grouped module-separated, each row's agent-chain glyph preview +
// step count, the modules it touches, status, and last run. Read-only browse+open
// — running a workflow (Run + live console) is WFL.2; a trigger stays agent/RBAC-
// gated (WF.1 enqueue API · RBAC.4). Rows open the Axona agent to summarize.
export function WorkflowsView({
  data,
  error = false,
}: {
  data: WorkflowsScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const propose = (prompt: string) => {
    setSeed(prompt);
    setCollapsed(false);
  };

  const r = data.rollup;
  const hasData = r.total > 0;
  const stats = [
    { v: r.total, l: "Workflows" },
    { v: r.active, l: "Active" },
    { v: r.runs, l: "Runs · 30d" },
    { v: r.agentsOrchestrated, l: "Agents orchestrated" },
  ];

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Core · agent orchestration by module
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Workflows
          </h1>
        </div>
        <button
          type="button"
          onClick={() =>
            propose("Draft a new workflow — lay out its steps and trigger")
          }
          className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          New workflow
        </button>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load workflows. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No workflows — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <>
          <StatStrip stats={stats} variant="inline" />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
            {data.groups.map((g) => (
              <div key={g.moduleKey}>
                <div className="mb-2 mt-[18px] flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] flex-none rounded-[2px] bg-ink-strong"
                  />
                  <span className="text-[13px] font-semibold text-ink">
                    {g.module}
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {g.count} {g.count === 1 ? "workflow" : "workflows"}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </div>
                {g.workflows.map((w) => (
                  <WorkflowRowView key={w.id} w={w} now={data.now} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WorkflowRowView({ w, now }: { w: WorkflowRow; now: number }) {
  const badge = STATUS_BADGE[w.status];
  const last = lastRunLabel(w.lastRun, now);
  const shown = w.agentChain.slice(0, CHAIN_CAP);
  const extra = w.agentChain.length - shown.length;

  // WFL.2: a row opens the workflow detail (step-flow + run console).
  return (
    <Link
      href={`/workflows/${w.id}`}
      className={`${COLS} mb-2 w-full rounded-card border border-line bg-paper px-3.5 py-[13px] text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-ink">
          {w.name}
        </div>
        <div className="mt-[3px] truncate text-[12px] text-ink-muted">
          {w.description}
        </div>
      </div>

      {/* agent-chain glyph preview + step count. The glyph row clips if narrow;
          the "N steps" label is reserved (flex-none) so it never collides with
          the modules column. */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-[4px] overflow-hidden">
          {shown.map((code, i) => (
            <span
              key={code + i}
              className="inline-flex flex-none items-center gap-[4px]"
            >
              <AgentGlyph decorative size={13} />
              {i < shown.length - 1 && (
                <span aria-hidden className="text-[10px] text-line-strong">
                  →
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span
              aria-hidden
              className="flex-none font-mono text-[9.5px] text-ink-faint"
            >
              +{extra}
            </span>
          )}
        </div>
        <span className="flex-none whitespace-nowrap font-mono text-[9.5px] text-ink-muted">
          {w.stepCount} steps
        </span>
      </div>

      <div className="min-w-0 truncate font-mono text-[10.5px] text-ink-muted">
        {w.modulesTouched.join(" · ")}
      </div>

      <div className="flex flex-col items-end gap-[5px]">
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10px] font-semibold tracking-[0.03em] ${badge.cls}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
          />
          {badge.label}
        </span>
        <span
          className={`font-mono text-[9.5px] ${last.emphasis ? "text-ink" : "text-ink-muted"}`}
        >
          {last.text}
        </span>
      </div>
    </Link>
  );
}
