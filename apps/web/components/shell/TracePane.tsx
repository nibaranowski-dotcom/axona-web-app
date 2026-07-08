import { ChevronDown } from "lucide-react";
import type { TraceLine } from "./TraceConsole";

// UX.9 look / UX.10 containment — the collapsible agent-chat trace sub-pane, 1:1 to
// the v9 Procurement.dc.html `.tracepane`. A native <details> pinned at the bottom of
// the agent chat (right-pane + /agents): a summary bar (accent status dot + TRACE ·
// orchestrator name · chevron) and, when open, the scrolling trace lines.
//
// UX.10 scroll containment: the pane is flex:none (it never grows to push the composer
// out); its CONTENT region (the <ol>) is the bounded scroll box — min-h-0 + max-height
// (~40vh) + overflow-y-auto — so long result lines scroll WITHIN the pane instead of
// clipping or overflowing the chat column. Closed → just the summary bar. The look is
// unchanged (dark surface via bg-ink-strong; only the height behaviour is bounded).
//
// The chevron rotates -90°↔0°; native <details>/<summary> is keyboard-accessible by
// default; the chevron transition is disabled under prefers-reduced-motion. v2 tokens
// only — no literal hex, no emoji.

const TRACEPANE_CSS = `
.tracepane{display:flex;flex-direction:column;flex:none;min-height:0}
.tracepane>summary{list-style:none;cursor:pointer}
.tracepane>summary::-webkit-details-marker{display:none}
.tracepane>summary::marker{content:""}
.tracechev{transform:rotate(-90deg);transition:transform .15s}
.tracepane[open] .tracechev{transform:rotate(0deg)}
@media (prefers-reduced-motion:reduce){.tracechev{transition:none}}
`;

export function TracePane({
  lines,
  orchestrator = "orchestrator",
  defaultOpen = true,
}: {
  lines: TraceLine[];
  orchestrator?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="tracepane border-t border-line bg-ink-strong"
      open={defaultOpen}
    >
      <style>{TRACEPANE_CSS}</style>
      <summary className="flex items-center justify-between px-4 py-[11px] font-mono text-[10.5px] text-on-dark-mut">
        <span className="inline-flex items-center gap-[7px] tracking-[0.06em] text-on-dark-faint">
          <span
            aria-hidden
            className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
          />
          TRACE
        </span>
        <span className="inline-flex items-center gap-[9px]">
          <span className="tracking-[0.06em] text-on-dark-faint">
            {orchestrator}
          </span>
          <ChevronDown
            className="tracechev h-[13px] w-[13px] text-on-dark-faint"
            strokeWidth={2.2}
            aria-hidden
          />
        </span>
      </summary>
      <ol className="max-h-[40vh] min-h-0 overflow-y-auto px-4 pb-3.5 font-mono text-[10.5px] leading-[1.7] text-on-dark-mut">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5">
            {l.ts && (
              <span className="flex-none text-on-dark-faint">{l.ts}</span>
            )}
            <span className="whitespace-pre-wrap">{l.text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
