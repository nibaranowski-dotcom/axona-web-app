"use client";

import { PanelRightOpen } from "lucide-react";
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
        <AgentGlyph tone="ink" status="live" size={22} />
        <PanelRightOpen className="h-4 w-4" strokeWidth={1.7} aria-hidden />
      </button>
    </div>
  );
}
