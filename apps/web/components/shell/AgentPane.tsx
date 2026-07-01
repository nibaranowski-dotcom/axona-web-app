"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { ChatThread } from "@/components/agents/ChatThread";
import { useAgentChat } from "@/components/agents/use-agent-chat";
import { TraceConsole } from "./TraceConsole";
import { AgentRail } from "./AgentRail";
import { useMounted, useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";

// Right agent pane: resizable (drag the left handle) and collapsible to a 52px
// rail (width + collapsed persist via the UI store — FND.13 behaviour). The body
// is the general Axona agent chat (GA.1): a cross-module, read-only copilot
// streamed via ART.4, resolved server-side (getAxonaAgent) → `axonaAgentId`.

export function AgentPane({ axonaAgentId }: { axonaAgentId?: string }) {
  const mounted = useMounted();
  const width = useUi((s) => s.agentPaneWidth);
  const collapsed = useUi((s) => s.agentPaneCollapsed);
  const setWidth = useUi((s) => s.setAgentPaneWidth);
  const toggle = useUi((s) => s.toggleAgentPane);
  const draggingRef = useRef(false);

  const [input, setInput] = useState("");
  const { messages, traceLines, sending, error, send } =
    useAgentChat(axonaAgentId);

  // A CMD.2 copilot entry can seed a starter question — prefill the composer once.
  const seed = useCopilotSeed((s) => s.seed);
  const setSeed = useCopilotSeed((s) => s.setSeed);
  useEffect(() => {
    if (seed) {
      setInput(seed);
      setSeed(null);
    }
  }, [seed, setSeed]);

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
          <AgentGlyph tone="ink" status="live" size={20} />
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted">
            Ask across modules — I read everything and cite my sources, and
            route actions to the module agents.
          </p>
        )}
        <ChatThread messages={messages} />
        {error && (
          <p
            role="status"
            className="rounded-btn border border-line-strong bg-paper px-3 py-2 text-[13px] text-ink-muted"
          >
            {error}
          </p>
        )}
        {traceLines.length > 0 && (
          <TraceConsole lines={traceLines} title="Trace" />
        )}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
          setInput("");
        }}
      >
        <label htmlFor="axona-composer" className="sr-only">
          Message the Axona agent
        </label>
        <div className="flex items-center gap-2">
          <input
            id="axona-composer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!axonaAgentId}
            placeholder="Message the agent…"
            className="min-w-0 flex-1 rounded-btn border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || !axonaAgentId}
            className="rounded-btn bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition-colors duration-200 ease-ease hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong disabled:opacity-40"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
