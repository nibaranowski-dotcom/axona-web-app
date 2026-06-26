"use client";

import { useState } from "react";

// Dark agent-trace console. Renders trace lines (scan → correlate → draft →
// policy-check → result) in JetBrains Mono on an ink surface. Collapsible.
// Static placeholder lines now; the SSE stream attaches in ART.5.

export interface TraceLine {
  ts?: string;
  text: string;
}

const PLACEHOLDER: TraceLine[] = [
  { ts: "00:00", text: "scan        · NCR-118 torque breach on SERVO-204" },
  { ts: "00:01", text: "correlate   · lot 88421 → ECO-318 → BMW DLV-3312" },
  { ts: "00:02", text: "draft       · re-source PO for SERVO-205 (×24)" },
  {
    ts: "00:03",
    text: "policy-check· spend < $100k → human approval required",
  },
  { ts: "00:04", text: "result      · PO drafted, AWAITING_APPROVAL" },
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

  return (
    <section className="overflow-hidden rounded-card border border-line-strong bg-ink-strong">
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
