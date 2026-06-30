"use client";

import { useState } from "react";
import { AgentGlyph } from "@/components/ui";
import { TraceConsole } from "@/components/shell/TraceConsole";
import { ChatThread } from "./ChatThread";
import { type AgentSummary, stateTone } from "./AgentCard";
import { useAgentChat } from "./use-agent-chat";

// Live chat with one agent (ART.4 / AGT.1). Trace lines stream into the console,
// the answer (with citations) into the thread, gated actions as a distinct
// "awaiting approval" affordance.

export function AgentChat({ agent }: { agent: AgentSummary }) {
  const [input, setInput] = useState("");
  const { messages, traceLines, proposals, sending, error, send } =
    useAgentChat(agent.id);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-6 py-4">
        <AgentGlyph tone="ink" status={stateTone(agent.state)} size={28} />
        <div className="min-w-0">
          <h2 className="truncate font-sans text-sm font-semibold text-ink-strong">
            {agent.name}
          </h2>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-ink-muted">
            {agent.role} · {agent.code}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {proposals.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Proposed actions">
            {proposals.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-card border border-line-strong bg-panel px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-2 w-2 flex-none rounded-pill bg-accent"
                />
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted">
                    Awaiting approval
                  </span>
                  <span className="block text-[13px] leading-snug text-ink">
                    {p.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ChatThread messages={messages} />

        {error && (
          <p
            role="status"
            className="rounded-btn border border-line-strong bg-panel px-3 py-2 text-[13px] text-ink-muted"
          >
            {error}
          </p>
        )}

        {traceLines.length > 0 && <TraceConsole lines={traceLines} />}
      </div>

      <form
        className="flex items-center gap-2 border-t border-line px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
          setInput("");
        }}
      >
        <label htmlFor="agent-composer" className="sr-only">
          Message {agent.name}
        </label>
        <input
          id="agent-composer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message this agent…"
          className="min-w-0 flex-1 rounded-btn border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors duration-200 ease-ease hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
