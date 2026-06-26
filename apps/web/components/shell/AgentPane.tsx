"use client";

import { useCallback, useRef } from "react";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { AgentRail } from "./AgentRail";
import { useMounted, useUi } from "@/lib/ui-store";

// Right agent pane: resizable (drag the left handle) and collapsible to a 52px
// rail. Width + collapsed persist via the UI store. The real chat thread + SSE
// are GA.1 / ART.4 / ART.5 — the body is a placeholder here.

export function AgentPane() {
  const mounted = useMounted();
  const width = useUi((s) => s.agentPaneWidth);
  const collapsed = useUi((s) => s.agentPaneCollapsed);
  const setWidth = useUi((s) => s.setAgentPaneWidth);
  const toggle = useUi((s) => s.toggleAgentPane);
  const draggingRef = useRef(false);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      // pane is anchored to the viewport's right edge
      setWidth(window.innerWidth - e.clientX);
    },
    [setWidth],
  );

  const stopDrag = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
    },
    [onPointerMove, stopDrag],
  );

  // First paint = defaults (avoid hydration mismatch); reflect store once mounted.
  if (mounted && collapsed) return <AgentRail />;

  return (
    <aside
      style={{ width: mounted ? width : 340 }}
      aria-label="Axona agent"
      className="relative flex h-dvh flex-col border-l border-line bg-panel"
    >
      {/* drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent pane"
        onPointerDown={startDrag}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-strong"
      />

      <header className="flex items-center justify-between border-b border-line px-3 py-3">
        <span className="flex items-center gap-2">
          <AgentGlyph tone="live" size={20} />
          <span className="text-sm font-medium text-ink-strong">
            Axona agent
          </span>
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse agent pane"
          className="rounded-btn px-2 py-1 font-mono text-xs text-ink-muted hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ›
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm text-ink-muted">
        {/* TODO GA.1 / ART.4: citation-aware chat thread + SSE reply stream */}
        <p>Ask across modules…</p>
        <p className="mt-2 text-ink-muted">
          The cross-module copilot lands in GA.1 (chat + citations).
        </p>
      </div>

      <div className="border-t border-line p-3">
        <div className="rounded-btn border border-line-strong bg-paper px-3 py-2 text-sm text-ink-muted">
          {/* TODO ART.4: message composer */}
          Message the agent…
        </div>
      </div>
    </aside>
  );
}
