import type { Severity } from "@axona/db";

// Security display helpers (SEC.2). Critical = ink, attention = lime,
// good/live = functional green. Brand palette only (no warning hue).

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// CVE severity → pill classes (critical renders in ink per brand palette).
export const SEV_BADGE: Record<Severity, string> = {
  CRITICAL: "bg-ink-strong text-on-dark",
  MAJOR: "bg-accent text-accent-ink",
  MINOR: "bg-panel text-ink-muted",
};

// Device-posture bucket → bar colour: hardened = green (good), needs-patch = lime
// (attention), degraded = ink (critical).
export function postureBar(bucket: string): string {
  const b = bucket.toLowerCase();
  if (b.includes("hardened")) return "bg-success";
  if (b.includes("degraded")) return "bg-ink-strong";
  return "bg-accent";
}
