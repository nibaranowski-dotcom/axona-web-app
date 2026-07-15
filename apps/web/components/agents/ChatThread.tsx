import Link from "next/link";
import type { Citation } from "@/lib/agent-chat";
import { AgentGlyph } from "./AgentGlyph";
import { Markdown } from "./Markdown";

// DS.1 chat thread — user/agent message bubbles (Axona v2). Agent rows lead with
// the static 12-dot AgentGlyph; user rows right-align. Lime is reserved as the
// single signal, so bubbles use warm-grey / ink surfaces. Agent messages render
// their citations (GA.1) as DS chips linking to the object.
//
// UX.12: the ASSISTANT body is markdown (the model emits **bold** section headers,
// bullet/numbered lists, --- rules, and pipe tables — e.g. the NCR-118 blast-radius
// answer) so it renders through the sanitized <Markdown> renderer. The USER message
// stays plain text (whitespace-pre-wrap) — users don't write markdown.

export interface ChatMessage {
  role: "USER" | "AGENT";
  text: string;
  citations?: Citation[];
}

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-ink-muted">
        Ask this agent anything to start.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-[14px]">
      {messages.map((m, i) => {
        const user = m.role === "USER";
        return (
          <li
            key={i}
            className={`flex items-start gap-[9px] ${
              user ? "justify-end" : "justify-start"
            }`}
          >
            {!user && (
              <AgentGlyph
                decorative
                tone="ink"
                size={22}
                className="mt-0.5 flex-none"
              />
            )}
            <div className="max-w-[80%]">
              <span className="sr-only">{user ? "You:" : "Agent:"}</span>
              <div
                className={`min-w-0 overflow-hidden rounded-[13px] px-[13px] py-[11px] text-[13px] leading-[1.5] ${
                  user
                    ? "whitespace-pre-wrap bg-ink-strong text-on-dark"
                    : "border border-line-panel bg-panel text-ink"
                }`}
              >
                {user ? m.text : <Markdown>{m.text}</Markdown>}
              </div>
              {!user && m.citations && m.citations.length > 0 && (
                <ul
                  className="mt-1.5 flex flex-wrap gap-1.5"
                  aria-label="Sources"
                >
                  {m.citations.map((c, j) => (
                    <li key={j}>
                      <Link
                        href={c.url}
                        className="inline-flex items-center rounded-[5px] border border-line-strong bg-paper px-[7px] py-[2px] font-mono text-[11px] text-ink-muted hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
