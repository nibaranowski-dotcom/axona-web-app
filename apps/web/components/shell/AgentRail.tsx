"use client";

import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { RAIL_WIDTH, useUi } from "@/lib/ui-store";

// The 52px collapsed state of the agent pane. Click to expand.
export function AgentRail() {
  const toggleAgentPane = useUi((s) => s.toggleAgentPane);
  return (
    <div
      style={{ width: RAIL_WIDTH }}
      className="flex h-dvh flex-col items-center gap-3 border-l border-line bg-panel py-3"
    >
      <button
        type="button"
        onClick={toggleAgentPane}
        aria-label="Expand agent pane"
        className="flex flex-col items-center gap-2 rounded-btn p-2 text-ink-muted hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <AgentGlyph tone="live" size={22} />
        <span aria-hidden className="font-mono text-[10px] text-ink-faint">
          ‹
        </span>
      </button>
    </div>
  );
}
