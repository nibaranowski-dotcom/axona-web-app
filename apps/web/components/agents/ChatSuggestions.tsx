import { ArrowUpRight } from "lucide-react";

// Clickable starter-prompt chips shown when an agent chat is empty (Axona v2 —
// the mock's per-agent suggestion chips). Rows echo the /core "Ask Axona" card:
// hairline border, ink-muted text, a thin arrow that lifts on hover. Picking one
// sends it as the first message.
export function ChatSuggestions({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  if (suggestions.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Suggested prompts">
      {suggestions.map((s) => (
        <li key={s}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex w-full items-center justify-between gap-3 rounded-btn border border-line-strong bg-paper px-3 py-2.5 text-left text-[13px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            <span className="min-w-0 truncate">{s}</span>
            <ArrowUpRight
              aria-hidden
              className="h-3.5 w-3.5 flex-none text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
              strokeWidth={1.5}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
