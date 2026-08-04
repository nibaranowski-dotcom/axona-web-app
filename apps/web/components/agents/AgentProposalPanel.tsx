"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, RefreshCw } from "lucide-react";
import type { AgentProposal } from "@/lib/agent-proposal";

// DEMO.6 — the shared "agent proposed this" panel: the finding, the CONF.1-calibrated
// confidence, the evidence signals that produced it, an Approve/Confirm control, and
// the LOOP.1 writeback once a verdict is recorded.
//
// One component rather than one per beat, for the same reason buildAgentProposal is one
// function: the surfaces must agree on what "the agent is acting" LOOKS like, or the
// demo reads as four teams' work. It also puts the a11y decision in one place — every
// faint/mono micro-label here is `text-mono-faint`, the A11Y.3-safe token. `ink-faint`
// misses WCAG AA by 0.01 on panel-2 and the served axe gate reds it; that is a fact
// about the token, not a preference, so it should not be re-decided per screen.
//
// `onDecide` returns the writeback note (or null when the loop did not record), so the
// panel never claims a writeback it cannot see.
export function AgentProposalPanel({
  title,
  proposal,
  onDecide,
  confirmLabel = "Confirm assessment",
  rejectLabel = "Dismiss",
  className,
}: {
  title: string;
  proposal: AgentProposal;
  onDecide: (
    upheld: boolean,
  ) => Promise<{ recorded: boolean; note: string } | null>;
  confirmLabel?: string;
  rejectLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loop, setLoop] = useState<{ recorded: boolean; note: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();

  const decide = (upheld: boolean) => {
    setError(null);
    start(async () => {
      try {
        const res = await onDecide(upheld);
        setLoop(res);
        if (!upheld) setDismissed(true);
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not record the decision.",
        );
      }
    });
  };

  if (dismissed) return null;

  return (
    <section
      aria-labelledby="agent-proposal-title"
      className={`rounded-card border border-line bg-panel-2 p-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-2.5">
        <Lightbulb
          className="mt-px h-[15px] w-[15px] flex-none text-ink-muted"
          strokeWidth={1.7}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div
            id="agent-proposal-title"
            className="text-[12.5px] font-semibold text-ink"
          >
            {title}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-mono-faint">
            Proposal · confidence {proposal.calibrated.toFixed(2)}
            {proposal.calibratedState === "calibrated"
              ? ` · calibrated from ${proposal.rawConfidence.toFixed(2)}`
              : " · uncalibrated"}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink">
        {proposal.text}
      </p>

      {/* the score is inspectable — each line is a fact that had to be found */}
      <ul className="mt-2 space-y-0.5">
        {proposal.signals.map((s) => (
          <li
            key={s.key}
            className="font-mono text-[10px] leading-[1.4] text-mono-faint"
          >
            {s.detail}{" "}
            <span className="text-ink-muted">+{s.weight.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[11.5px] leading-[1.4] text-ink-muted">
        Proposed: {proposal.action}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={pending}
          className="flex-1 rounded-lg bg-ink-strong px-3 py-2 text-center text-[12px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {pending ? "Saving…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={pending}
          className="rounded-lg border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {rejectLabel}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-ink">
          {error}
        </p>
      )}

      {loop?.recorded && (
        <p
          role="status"
          className="mt-2.5 flex items-start gap-2 border-t border-line pt-2.5 text-[11.5px] leading-[1.4] text-ink"
        >
          <RefreshCw
            className="mt-px h-[13px] w-[13px] flex-none text-ink-muted"
            strokeWidth={1.7}
            aria-hidden
          />
          <span>
            <span className="font-semibold">Learning loop updated.</span>{" "}
            {loop.note}
          </span>
        </p>
      )}
    </section>
  );
}
