"use client";

import { ChevronsLeft } from "lucide-react";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { RAIL_WIDTH, useUi } from "@/lib/ui-store";

// The collapsed state of the agent pane (Axona v2 rail) — a reopen button, the
// static agent glyph, and a vertical "Agents" label. Click to expand.
export function AgentRail() {
  const toggleAgentPane = useUi((s) => s.toggleAgentPane);
  return (
    <div
      style={{ width: RAIL_WIDTH }}
      className="flex h-dvh flex-col items-center gap-[14px] border-l border-line bg-paper py-[14px]"
    >
      <button
        type="button"
        onClick={toggleAgentPane}
        aria-label="Expand agent pane"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronsLeft className="h-4 w-4" strokeWidth={1.7} aria-hidden />
      </button>
      <AgentGlyph decorative tone="ink" size={24} />
      <span
        aria-hidden
        className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted"
        style={{ writingMode: "vertical-rl" }}
      >
        Agents
      </span>
    </div>
  );
}
