"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, GitFork, Plus, ShieldAlert, Zap } from "lucide-react";
import type { DetailRun, WorkflowDetail, WorkflowStep } from "@/lib/workflows";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { TraceConsole } from "@/components/shell/TraceConsole";
import {
  RUN_DOT,
  STATUS_BADGE,
  STEP_MARKER,
  fmtDuration,
  runOutcome,
  toConsoleLines,
} from "./format";

export interface WorkflowDetailScreenData {
  detail: WorkflowDetail;
  now: number;
  canDecide?: boolean;
}

// The Workflow detail screen (WFL.2, matching Workflow.dc.html on the v2 shell):
// the step-flow canvas (trigger → agents → gates → output) + the run console that
// REPLAYS the latest persisted run's trace through TraceConsole and re-runs via
// WF.1's RBAC-gated enqueue API. A guardrail gate parks AWAITING_APPROVAL — never
// auto-executed (propose→approve→audit). The global Axona pane stays (Core route).
// /// WF.2: swap the replay-on-refetch for live SSE token streaming.
export function WorkflowDetailView({
  detail,
  now,
  canDecide = false,
}: WorkflowDetailScreenData) {
  const badge = STATUS_BADGE[detail.status];
  const stats = [
    { l: "Steps", v: String(detail.stats.stepCount) },
    { l: "Modules", v: String(detail.stats.moduleCount) },
    { l: "Avg run", v: fmtDuration(detail.stats.avgRunMs) },
    { l: "Runs · 30d", v: String(detail.stats.runs) },
  ];

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <Link
            href="/workflows"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            All workflows
          </Link>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Workflows
          </h1>
        </div>
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          New workflow
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[22px]">
        {/* workflow header */}
        <div className="flex items-center gap-[10px]">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            {detail.name}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.04em] ${badge.cls}`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
            />
            {badge.label}
          </span>
        </div>
        <p className="mt-1.5 max-w-[74ch] text-[13px] leading-[1.45] text-ink-muted">
          {detail.description}
        </p>

        {/* stats */}
        <div className="mt-[14px] flex flex-wrap gap-x-8 gap-y-3">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                {s.l}
              </div>
              <div className="mt-0.5 text-[15px] font-semibold text-ink">
                {s.v}
              </div>
            </div>
          ))}
        </div>

        {/* step-flow canvas + run console */}
        <div className="mt-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-[1.5fr_1fr]">
          <section aria-label="Step flow">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
              Step flow
            </div>
            {detail.steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                last={i === detail.steps.length - 1}
              />
            ))}
          </section>

          <RunConsole detail={detail} now={now} canDecide={canDecide} />
        </div>
      </div>
    </div>
  );
}

function StepMarker({ step }: { step: WorkflowStep }) {
  const m = STEP_MARKER[step.kind];
  const icon =
    step.kind === "agent" ? (
      <AgentGlyph decorative size={16} />
    ) : step.kind === "trigger" ? (
      <Zap className="h-4 w-4" strokeWidth={2} aria-hidden />
    ) : step.kind === "decision" ? (
      <GitFork className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
    ) : step.kind === "guardrail" ? (
      <ShieldAlert className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
    ) : (
      <svg
        viewBox="0 0 24 24"
        className="h-[15px] w-[15px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  return (
    <span
      className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full ${m.ring}`}
    >
      {icon}
    </span>
  );
}

function StepCard({ step, last }: { step: WorkflowStep; last: boolean }) {
  return (
    <div className="flex items-stretch gap-[14px]">
      <div className="flex w-[34px] flex-none flex-col items-center">
        <StepMarker step={step} />
        {!last && (
          <span
            aria-hidden
            className="my-[3px] w-0.5 flex-1 bg-line-strong"
            style={{ minHeight: 18 }}
          />
        )}
      </div>
      <div className="mb-1.5 flex-1 rounded-card border border-line bg-paper px-4 py-[13px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-[9px]">
              <span className="text-[13.5px] font-semibold text-ink">
                {step.title}
              </span>
              {step.module && (
                <span className="rounded-[5px] border border-line bg-panel px-1.5 py-0.5 font-mono text-[9px] tracking-[0.03em] text-ink-muted">
                  {step.module}
                </span>
              )}
            </div>
            <div className="mt-1 text-[12.5px] leading-[1.45] text-ink-muted">
              {step.action}
            </div>
            {step.branches && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {step.branches.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 rounded-[7px] border border-line-strong bg-panel px-2.5 py-1 font-mono text-[11.5px] text-ink-muted"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-[1px] bg-line-strong"
                    />
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="flex-none rounded-pill bg-panel px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
            {STEP_MARKER[step.kind].label}
          </span>
        </div>
      </div>
    </div>
  );
}

function RunConsole({
  detail,
  now,
  canDecide,
}: {
  detail: WorkflowDetail;
  now: number;
  canDecide: boolean;
}) {
  const [run, setRun] = useState<DetailRun | null>(detail.latestRun);
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refetch + replay a run's persisted trace (shared by run + decide).
  const refetchRun = async (runId: string): Promise<void> => {
    const r = await fetch(`/api/workflow-runs/${runId}`);
    if (!r.ok) throw new Error(`fetch run failed: ${r.status}`);
    const { run: fresh } = (await r.json()) as {
      run: {
        id: string;
        status: DetailRun["status"];
        trace: DetailRun["trace"];
        startedAt: string;
        endedAt: string | null;
      };
    };
    setRun({
      id: fresh.id,
      status: fresh.status,
      at: new Date(fresh.startedAt),
      endedAt: fresh.endedAt ? new Date(fresh.endedAt) : null,
      trace: fresh.trace ?? [],
    });
  };

  // RBAC.4 — approve/reject a parked run via the approval primitive, then refetch
  // so the console shows the resumed/rejected trace. Enforced server-side too.
  const onDecide = async (decision: "APPROVE" | "REJECT") => {
    if (!run || deciding) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "workflow.gate",
          targetId: run.id,
          decision,
        }),
      });
      if (!res.ok) throw new Error(`decision failed: ${res.status}`);
      await refetchRun(run.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeciding(false);
    }
  };

  const onRun = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      // WF.1 enqueue API (requireRole line 1). Demo trigger value keeps the
      // procurement guardrail on its parked branch. No-Redis → runs in-process,
      // so the run is persisted by the time this resolves; refetch + replay.
      // /// WF.2: replace this refetch with a live SSE trace stream.
      const res = await fetch(`/api/workflows/${detail.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggerPayload: { value: 48000 } }),
      });
      if (!res.ok) throw new Error(`run failed: ${res.status}`);
      const { runId } = (await res.json()) as { runId: string };
      const r = await fetch(`/api/workflow-runs/${runId}`);
      if (!r.ok) throw new Error(`fetch run failed: ${r.status}`);
      const { run: fresh } = (await r.json()) as {
        run: {
          id: string;
          status: DetailRun["status"];
          trace: DetailRun["trace"];
          startedAt: string;
          endedAt: string | null;
        };
      };
      setRun({
        id: fresh.id,
        status: fresh.status,
        at: new Date(fresh.startedAt),
        endedAt: fresh.endedAt ? new Date(fresh.endedAt) : null,
        trace: fresh.trace ?? [],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const lines = run ? toConsoleLines(run.trace) : [];

  return (
    <section aria-label="Run console" className="flex flex-col gap-3">
      {/* trigger + run */}
      <div className="rounded-card border border-line bg-paper p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
          Trigger
        </div>
        <div className="mt-2 flex items-start gap-2 text-[12.5px] leading-[1.45] text-ink">
          <span
            aria-hidden
            className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-ink-strong"
          />
          <span className="font-mono">{detail.triggerEvent}</span>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="mt-3.5 w-full rounded-btn bg-accent py-[11px] text-[13.5px] font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {running ? "Running…" : "Run workflow"}
        </button>
        {error && (
          <p
            role="status"
            className="mt-2 font-mono text-[10px] text-ink-muted"
          >
            Couldn’t run — {error}
          </p>
        )}
        {run?.status === "AWAITING_APPROVAL" && (
          <div className="mt-2">
            <p className="font-mono text-[10px] text-ink">
              Parked — proposed, awaiting human approval (RBAC.4). No action was
              auto-executed.
            </p>
            {canDecide && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onDecide("APPROVE")}
                  disabled={deciding}
                  className="flex-1 rounded-btn bg-ink-strong py-[9px] text-[12.5px] font-semibold text-on-dark transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  {deciding ? "Deciding…" : "Approve & resume"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide("REJECT")}
                  disabled={deciding}
                  className="rounded-btn border border-line-strong bg-paper px-3.5 py-[9px] text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* execution log — replayed persisted trace */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            Execution log
          </span>
          <span className="font-mono text-[9px] text-ink-muted">
            {lines.length} events
          </span>
        </div>
        {run ? (
          <TraceConsole
            lines={lines}
            title={`Run · ${runOutcome(run.status)}`}
          />
        ) : (
          <div className="rounded-card border border-line-strong bg-ink-strong px-3 py-6 text-center font-mono text-[11px] text-on-dark-mut">
            Run the workflow to stream the orchestration trace.
          </div>
        )}
      </div>

      {/* recent runs */}
      {detail.runs.length > 0 && (
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            Recent runs
          </div>
          {detail.runs.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={`h-[7px] w-[7px] flex-none rounded-full ${RUN_DOT[r.status]}`}
                />
                <span className="truncate text-[12px] text-ink">
                  {runOutcome(r.status)}
                </span>
              </span>
              <span className="flex-none font-mono text-[10px] text-ink-muted">
                {relTime(r.at, now)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function relTime(at: Date, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(at).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
