import type { ReactNode } from "react";

// DS.1 Badge (components/core/Badge.jsx). accent = lime highlight, success =
// green live/approved tint, neutral = grey. Pill, weight 600, no red.

type Tone = "accent" | "success" | "neutral";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent text-accent-ink",
  success: "bg-success-tint text-success",
  neutral: "bg-panel text-ink-muted",
};

export function Badge({
  tone = "accent",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-[9px] py-[3px] font-sans text-[10.5px] font-semibold tracking-[0.04em] ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
