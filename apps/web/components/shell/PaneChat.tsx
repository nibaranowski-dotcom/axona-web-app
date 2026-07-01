"use client";

import { useEffect, useState } from "react";
import { ChatThread } from "@/components/agents/ChatThread";
import { useAgentChat } from "@/components/agents/use-agent-chat";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { TraceConsole } from "./TraceConsole";

// The agent-pane chat body (ART.4 stream via useAgentChat). Rendered keyed by
// agentId so switching the active agent (or route) starts a fresh thread. Any
// CMD.2/PROC.2 copilot seed prefills the composer. Gated tool calls surface as a
// proposal / awaiting-approval affordance — a human must approve before they run.
export function PaneChat({
  agentId,
  intro,
  placeholder,
}: {
  agentId?: string;
  intro: string;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const { messages, traceLines, proposals, sending, error, send } =
    useAgentChat(agentId);

  const seed = useCopilotSeed((s) => s.seed);
  const setSeed = useCopilotSeed((s) => s.setSeed);
  useEffect(() => {
    if (seed) {
      setInput(seed);
      setSeed(null);
    }
  }, [seed, setSeed]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-[18px]">
        {messages.length === 0 && (
          <p className="text-[13px] leading-[1.5] text-ink-muted">{intro}</p>
        )}
        <ChatThread messages={messages} />
        {proposals.length > 0 && (
          <p
            role="status"
            className="rounded-btn border border-accent bg-paper px-3 py-2 text-[12.5px] text-ink"
          >
            {proposals.length} action{proposals.length === 1 ? "" : "s"}{" "}
            awaiting approval — a human must approve before it runs.
          </p>
        )}
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
        className="border-t border-line px-[18px] py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
          setInput("");
        }}
      >
        <label htmlFor="pane-composer" className="sr-only">
          {placeholder}
        </label>
        <div className="flex items-stretch overflow-hidden rounded-[10px] border border-line-strong bg-paper focus-within:ring-2 focus-within:ring-accent">
          <input
            id="pane-composer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!agentId}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent px-[14px] py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || !agentId}
            className="bg-accent px-4 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong disabled:opacity-40"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </>
  );
}
