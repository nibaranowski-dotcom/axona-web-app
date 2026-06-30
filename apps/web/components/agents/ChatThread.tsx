import Link from "next/link";
import type { Citation } from "@/lib/agent-chat";

// DS.1 chat thread — user/agent message bubbles. Composed from DS surfaces
// (no off-system styling); lime is reserved as the single signal, so bubbles
// use the warm-grey / ink surfaces, distinguished by side + a mono role label.
// Agent messages render their citations (GA.1) as DS chips linking to the object.

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
    <ol className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const user = m.role === "USER";
        return (
          <li
            key={i}
            className={`max-w-[85%] ${user ? "self-end" : "self-start"}`}
          >
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              {user ? "You" : "Agent"}
            </span>
            <div
              className={`whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-[14px] leading-snug ${
                user
                  ? "bg-ink-strong text-on-dark"
                  : "border border-line-panel bg-panel text-ink"
              }`}
            >
              {m.text}
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
          </li>
        );
      })}
    </ol>
  );
}
