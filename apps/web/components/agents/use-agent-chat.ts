"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TraceLine as AgentTraceLine } from "@axona/agents";
import type { TraceLine as ConsoleLine } from "@/components/shell/TraceConsole";
import { streamAgentChat, type Citation } from "@/lib/agent-chat";
import type { ChatMessage } from "./ChatThread";

// Shared chat-streaming state for a single agent (ART.4). Used by the per-agent
// chat (AGT.1) and the global Axona pane (GA.1). Routes SSE events: trace/
// proposal → live console lines (proposals also surfaced), message → thread
// (with citations). Aborts the in-flight stream on unmount / agent switch.

function toConsoleLine(l: AgentTraceLine): ConsoleLine {
  return { ts: l.ts.slice(11, 19), text: `${l.kind.padEnd(12)}· ${l.text}` };
}

export function useAgentChat(agentId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traceLines, setTraceLines] = useState<ConsoleLine[]>([]);
  const [proposals, setProposals] = useState<AgentTraceLine[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || sending || !agentId) return;
      setError(null);
      setMessages((m) => [...m, { role: "USER", text: msg }]);
      setSending(true);
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      try {
        for await (const ev of streamAgentChat(
          agentId,
          msg,
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
            const d = ev.data as {
              chatId: string;
              text: string;
              citations?: Citation[];
            };
            setMessages((m) => [
              ...m,
              { role: "AGENT", text: d.text, citations: d.citations },
            ]);
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
    },
    [agentId, chatId, sending],
  );

  return { messages, traceLines, proposals, sending, error, send };
}
