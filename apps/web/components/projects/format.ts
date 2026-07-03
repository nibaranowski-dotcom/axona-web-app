import type { ProjectStatus } from "@axona/db";

// Projects display helpers (PROJ.1). Active = green (live), in-review = lime,
// blocked = ink (brand critical), done = neutral. Brand palette only.

export const STATUS_BADGE: Record<
  ProjectStatus,
  { cls: string; label: string }
> = {
  ACTIVE: { cls: "bg-success-tint text-ink", label: "Active" },
  IN_REVIEW: { cls: "bg-accent text-accent-ink", label: "In review" },
  BLOCKED: { cls: "bg-ink-strong text-on-dark", label: "Blocked" },
  DONE: { cls: "bg-panel text-ink-muted", label: "Done" },
};

/** Relative "2h ago" / "3d ago" from a timestamp. */
export function fmtAgo(date: Date, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
