"use client";

import type { CoreSummary } from "@/lib/core-summary";
import { AgentGlyph } from "@/components/ui";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { KpiStrip } from "./KpiStrip";
import { ExceptionFeed } from "./ExceptionFeed";
import { ModuleKpiGrid } from "./ModuleKpiGrid";

// The Command Center (/core) — the one horizontal screen: company KPI strip, the
// cross-module exception feed (given prominence — it's the platform thesis), and
// the per-module KPI grid. The copilot is the existing GA.1 pane (reused, not
// rebuilt): the "ask" entries seed a question and open the pane.

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
  const collapsed = useUi((s) => s.agentPaneCollapsed);
  const toggle = useUi((s) => s.toggleAgentPane);
  const setSeed = useCopilotSeed((s) => s.setSeed);

  const ask = (q: string) => {
    setSeed(q); // the global Axona pane (GA.1) prefills this
    if (collapsed) toggle(); // ensure the pane is open
  };

  const hasData = summary.company.length > 0 || summary.kpisByModule.length > 0;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-6">
      <header>
        <h1 className="font-sans text-xl font-semibold tracking-tight text-ink-strong">
          Command Center
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          One live signal across every module.
        </p>
      </header>

      {error ? (
        <p
          role="status"
          className="rounded-card border border-line-strong bg-panel px-4 py-8 text-center text-sm text-ink-muted"
        >
          Couldn’t load the rollup. Check the database and refresh.
        </p>
      ) : !hasData ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          No data — run the seed (
          <span className="font-mono">pnpm db:seed</span>).
        </p>
      ) : (
        <>
          <KpiStrip kpis={summary.company} />

          <ExceptionFeed exceptions={summary.exceptions} />

          <section aria-label="Modules">
            <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-muted">
              Modules
            </h2>
            <ModuleKpiGrid modules={summary.kpisByModule} />
          </section>

          <section
            aria-label="Ask the Axona agent"
            className="rounded-card border border-line-panel bg-panel-2 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <AgentGlyph tone="ink" status="live" size={22} />
                <div>
                  <div className="text-sm font-semibold text-ink-strong">
                    Ask the Axona agent across modules
                  </div>
                  <div className="text-[12px] text-ink-muted">
                    It reads every module, cites sources, and routes actions.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-pill border border-line-strong bg-paper px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
