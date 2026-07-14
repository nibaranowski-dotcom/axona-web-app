"use client";

import { useEffect, useState } from "react";
import { ChatThread } from "@/components/agents/ChatThread";
import { ChatSuggestions } from "@/components/agents/ChatSuggestions";
import { useAgentChat } from "@/components/agents/use-agent-chat";
import { useStickToBottom } from "@/components/agents/use-stick-to-bottom";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { TracePane } from "./TracePane";

// The agent-pane chat body (ART.4 stream via useAgentChat). Rendered keyed by
// agentId so switching the active agent (or route) starts a fresh thread. Any
// CMD.2/PROC.2 copilot seed prefills the composer. Gated tool calls surface as a
// proposal / awaiting-approval affordance — a human must approve before they run.
export function PaneChat({
  agentId,
  intro,
  placeholder,
  suggestions = [],
}: {
  agentId?: string;
  intro: string;
  placeholder: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const { messages, traceLines, proposals, sending, error, send } =
    useAgentChat(agentId);
  const scrollRef = useStickToBottom<HTMLDivElement>(messages.length);

  const seed = useCopilotSeed((s) => s.seed);
  const autoSend = useCopilotSeed((s) => s.autoSend);
  const setSeed = useCopilotSeed((s) => s.setSeed);
  useEffect(() => {
    if (!seed) return;
    // UX.11: autoSend (Ask Axona) submits the prompt straight through so the
    // trace starts; otherwise it just prefills the composer (legacy CMD.2).
    if (autoSend && agentId) {
      // Defer the send by a tick so it fires on the STABLE mount: when the pane
      // expands from collapsed, React (StrictMode/dev) mounts→unmounts→remounts
      // this component; a synchronous send would be aborted by useAgentChat's
      // unmount cleanup. The transient mount clears its timer (and leaves the
      // seed intact); the stable mount actually sends + clears the seed.
      const id = setTimeout(() => {
        void send(seed);
        setSeed(null);
      }, 0);
      return () => clearTimeout(id);
    }
    setInput(seed);
    setSeed(null);
  }, [seed, autoSend, agentId, send, setSeed]);

  return (
    <>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-[18px]"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] leading-[1.5] text-ink-muted">{intro}</p>
            <ChatSuggestions
              suggestions={suggestions}
              onPick={(s) => void send(s)}
              disabled={sending}
            />
          </div>
        ) : (
          <ChatThread messages={messages} />
        )}
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
      </div>

      {/* UX.9 — collapsible trace sub-pane, pinned below the messages */}
      {traceLines.length > 0 && <TracePane lines={traceLines} />}

      <form
        className="flex-none border-t border-line px-[18px] py-3"
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
