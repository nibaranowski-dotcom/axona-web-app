"use client";

import { useState } from "react";

// Dark agent-trace console. Renders trace lines (scan → correlate → draft →
// policy-check → result) in JetBrains Mono on an ink surface. Collapsible.
// Static placeholder lines now; the SSE stream attaches in ART.5.

export interface TraceLine {
  ts?: string;
  text: string;
}

// PROSPECT.2 — org-neutral fallback lines (no tenant narrative baked in). Every
// caller passes real per-org `lines`; this default only shows if a caller omits them.
const PLACEHOLDER: TraceLine[] = [
  { ts: "00:00", text: "scan        · reviewing open exceptions" },
  { ts: "00:01", text: "correlate   · linking records across modules" },
  { ts: "00:02", text: "draft       · preparing a proposal" },
  {
    ts: "00:03",
    text: "policy-check· gated action → human approval required",
  },
  { ts: "00:04", text: "result      · drafted, AWAITING_APPROVAL" },
];

export function TraceConsole({
  lines = PLACEHOLDER,
  title = "Agent trace",
}: {
  lines?: TraceLine[];
  title?: string;
}) {
  const [open, setOpen] = useState(true);

  // TODO ART.5: subscribe to the AgentRun/WorkflowRun SSE stream and append lines.

  // shrink-0 (UX.1): the overflow-hidden card would otherwise collapse in the
  // parent flex-col scroll region and clip its trace lines.
  return (
    <section className="shrink-0 overflow-hidden rounded-card border border-line-strong bg-ink-strong">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-on-dark-mut hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span>{title}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ol className="space-y-1 px-3 pb-3 font-mono text-xs leading-relaxed text-on-dark-mut">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-3">
              {l.ts && <span className="text-on-dark-faint">{l.ts}</span>}
              <span className="whitespace-pre">{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
