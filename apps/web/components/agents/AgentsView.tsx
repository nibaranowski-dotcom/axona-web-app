"use client";

import { useState } from "react";
import { Pill } from "@/components/ui";
import { AgentCard, type AgentSummary } from "./AgentCard";
import { AgentChat } from "./AgentChat";

// /agents — module-grouped roster (left) + a live chat for the selected agent
// (right). "Needs attention" narrows to CRITICAL-state agents.

export interface AgentGroup {
  key: string;
  name: string;
  group: string;
  agents: AgentSummary[];
}

export function AgentsView({ groups }: { groups: AgentGroup[] }) {
  const [needsAttention, setNeedsAttention] = useState(false);
  const [selected, setSelected] = useState<AgentSummary | null>(null);

  const total = groups.reduce((n, g) => n + g.agents.length, 0);
  const critical = groups.reduce(
    (n, g) => n + g.agents.filter((a) => a.state === "CRITICAL").length,
    0,
  );

  const filtered = needsAttention
    ? groups
        .map((g) => ({
          ...g,
          agents: g.agents.filter((a) => a.state === "CRITICAL"),
        }))
        .filter((g) => g.agents.length > 0)
    : groups;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section
        aria-label="Agents roster"
        className="min-w-0 overflow-y-auto border-r border-line px-6 py-6"
      >
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-sans text-xl font-semibold tracking-tight text-ink-strong">
              Agents
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {total} agents across {groups.length} modules
            </p>
          </div>
          <Pill
            active={needsAttention}
            onClick={() => setNeedsAttention((v) => !v)}
          >
            Needs attention
            <span className="ml-2 font-mono text-[11px] opacity-80">
              {critical}
            </span>
          </Pill>
        </header>

        {total === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No agents — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No agents need attention.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            {filtered.map((g) => (
              <section key={g.key} aria-label={g.name}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-muted">
                    {g.name}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] text-ink-muted">
                    {g.agents.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                  {g.agents.map((a) => (
                    <AgentCard
                      key={a.id}
                      agent={a}
                      selected={selected?.id === a.id}
                      onSelect={() => setSelected(a)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Agent chat" className="min-w-0 overflow-hidden">
        {selected ? (
          <AgentChat key={selected.id} agent={selected} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-[34ch] text-sm text-ink-muted">
              Select an agent to open a live chat — watch its reasoning stream
              as it works.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
