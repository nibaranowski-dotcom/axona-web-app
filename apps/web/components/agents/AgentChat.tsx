"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceLine as AgentTraceLine } from "@axona/agents";
import { AgentGlyph } from "@/components/ui";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { streamAgentChat } from "@/lib/agent-chat";
import { ChatThread, type ChatMessage } from "./ChatThread";
import { type AgentSummary, stateTone } from "./AgentCard";

// Live chat with one agent (ART.4). On send, streamAgentChat routes events:
//   trace/proposal → live into the TraceConsole (proposals also as a distinct
//   "awaiting approval" affordance), message → into the ChatThread. Gated
//   actions are surfaced only — approving them is RBAC.4.

function toConsoleLine(l: AgentTraceLine): ConsoleLine {
  return {
    ts: l.ts.slice(11, 19), // HH:MM:SS
    text: `${l.kind.padEnd(12)}· ${l.text}`,
  };
}

export function AgentChat({ agent }: { agent: AgentSummary }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traceLines, setTraceLines] = useState<ConsoleLine[]>([]);
  const [proposals, setProposals] = useState<AgentTraceLine[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  // Abort the in-flight stream on unmount / agent switch (this component is
  // keyed by agent id, so switching remounts it).
  useEffect(() => () => ctrl.current?.abort(), []);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "USER", text }]);
    setSending(true);
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    try {
      for await (const ev of streamAgentChat(
        agent.id,
        text,
        chatId,
        c.signal,
      )) {
        if (ev.type === "trace") {
          setTraceLines((t) => [
            ...t,
            toConsoleLine(ev.data as AgentTraceLine),
          ]);
        } else if (ev.type === "proposal") {
          const line = ev.data as AgentTraceLine;
          setTraceLines((t) => [...t, toConsoleLine(line)]);
          setProposals((p) => [...p, line]);
        } else if (ev.type === "message") {
          const d = ev.data as { chatId: string; text: string };
          setMessages((m) => [...m, { role: "AGENT", text: d.text }]);
          setChatId(d.chatId);
        } else if (ev.type === "error") {
          setError((ev.data as { message: string }).message);
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError((e as Error).message);
      }
    } finally {
      setSending(false);
    }
  }

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
          void onSend();
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
