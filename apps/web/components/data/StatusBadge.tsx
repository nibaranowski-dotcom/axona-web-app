import type { ReactNode } from "react";

/**
 * StatusBadge — the canonical state pill, rendered purely with semantic tokens.
 *
 * Tone -> token mapping (brand invariants):
 *   live     live/approved -> functional green
 *   active   working/running -> the single lime signal
 *   critical -> INK (never an invented red)
 *   neutral  offline/idle -> muted on panel
 */
export type StatusTone = "live" | "active" | "critical" | "neutral";

const toneClass: Record<StatusTone, string> = {
  live: "bg-success-tint text-success border-transparent",
  active: "bg-accent text-accent-ink border-transparent",
  critical: "bg-ink-strong text-paper border-transparent",
  neutral: "bg-panel text-ink-muted border-line",
};

const dotClass: Record<StatusTone, string> = {
  live: "bg-success",
  active: "bg-accent-ink",
  critical: "bg-paper",
  neutral: "bg-ink-faint",
};

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${toneClass[tone]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-pill ${dotClass[tone]}`}
        aria-hidden
      />
      {children}
    </span>
  );
}
