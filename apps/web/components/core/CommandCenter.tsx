"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { CoreSummary } from "@/lib/core-summary";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { KpiStrip } from "./KpiStrip";
import { HealthGrid } from "./HealthGrid";
import { ExceptionFeed } from "./ExceptionFeed";

// The Command Center (/core) — the one horizontal screen (Axona v2). A 60px
// topbar, then a two-column body: LEFT the company KPI strip + the "System
// health" per-module KPI grid; RIGHT the "Ask Axona" copilot card + the
// cross-module exception feed (the platform thesis). All live from CMD.1; the
// copilot reuses the GA.1 pane (seed + open — no second chat).

const SUGGESTIONS = [
  "What is blocking the BMW order?",
  "Which exceptions ripple the widest?",
  "What is at risk this week?",
];

export function CommandCenter({
  summary,
  error = false,
}: {
  summary: CoreSummary;
  error?: boolean;
}) {
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const [ask, setAsk] = useState("");

  // /core is the one full-bleed two-column screen (matching the mock): collapse
  // the global Axona pane to its rail while here, and restore the user's prior
  // state on leave. The in-content "Ask Axona" card re-expands it (send()).
  useEffect(() => {
    const prev = useUi.getState().agentPaneCollapsed;
    setCollapsed(true);
    return () => setCollapsed(prev);
  }, [setCollapsed]);

  const send = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setSeed(t); // the global Axona pane (GA.1) prefills this
    setCollapsed(false); // expand the pane to show the answer
    setAsk("");
  };

  const hasData = summary.company.length > 0 || summary.kpisByModule.length > 0;
  const criticalCount = summary.exceptions.filter(
    (e) => e.severity === "critical",
  ).length;

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-[28px]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Command center · {summary.kpisByModule.length} modules
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Command center
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          {criticalCount === 0 ? (
            <span className="inline-flex items-center gap-[7px] rounded-pill bg-success-tint px-3 py-[5px] text-[12.5px] font-semibold text-success">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-success"
              />
              Systems nominal
            </span>
          ) : (
            <span className="inline-flex items-center gap-[7px] rounded-pill bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-ink-strong"
              />
              {criticalCount} critical
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              Open
            </span>
            <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-[2px] font-mono text-[11.5px] font-medium text-ink">
              {summary.exceptions.length}
            </span>
          </span>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load the rollup. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No data — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden px-6 py-[22px] lg:grid-cols-[1.55fr_1fr]">
          {/* LEFT — company KPIs + system health */}
          <div className="flex min-w-0 flex-col gap-[18px] overflow-y-auto pr-1">
            <KpiStrip kpis={summary.company} />
            <div>
              <div className="mb-[13px] flex items-center gap-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
                  System health
                </span>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[10px] text-ink-muted">
                  Last 24h
                </span>
              </div>
              <HealthGrid modules={summary.kpisByModule} />
            </div>
          </div>

          {/* RIGHT — copilot + needs attention */}
          <div className="flex min-w-0 flex-col gap-[18px] overflow-y-auto pr-1">
            <div className="copilot-surface rounded-card px-[18px] pb-4 pt-[18px]">
              <div className="mb-[13px] flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-[7px] w-[7px] rounded-full bg-accent"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-accent">
                  Ask Axona
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(ask);
                }}
                className="flex items-stretch overflow-hidden rounded-[9px] bg-paper"
              >
                <label htmlFor="cc-ask" className="sr-only">
                  Ask the Axona agent across modules
                </label>
                <input
                  id="cc-ask"
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="Ask anything…"
                  className="min-w-0 flex-1 bg-transparent px-[13px] py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
                />
                <button
                  type="submit"
                  className="bg-accent px-4 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong"
                >
                  Ask
                </button>
              </form>
              <div className="mt-3 flex flex-col">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="flex items-center justify-between gap-[10px] border-t border-line-dark py-[9px] text-left text-[12.5px] text-on-dark-mut transition-colors hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span>{q}</span>
                    <ArrowUpRight
                      className="h-[13px] w-[13px] flex-none text-accent"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </div>

            <ExceptionFeed exceptions={summary.exceptions} />
          </div>
        </div>
      )}
    </div>
  );
}
