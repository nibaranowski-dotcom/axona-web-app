// Legal display helpers (LEGAL.2). Status/state tones — attention = ink, in-flight
// = lime, cleared/met = neutral-green (dot + ink, AA-safe). Brand palette only.

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Obligation state → pill classes (AA-safe: ink text on the tints).
export function obligationBadge(state: string): string {
  const s = state.toUpperCase();
  if (s.includes("RISK")) return "bg-ink-strong text-on-dark";
  if (s === "REVIEW") return "bg-accent text-accent-ink";
  return "bg-success-tint text-ink";
}

// Export state → dot color (attention/pending = ink, cleared = green).
export function exportDot(state: string): string {
  const s = state.toUpperCase();
  return s === "CLEAR" || s === "CLEARED" || s === "EXEMPT"
    ? "bg-success"
    : "bg-ink-strong";
}

// Matter status → pill classes.
export function matterBadge(status: string): string {
  const s = status.toUpperCase();
  if (s === "MONITORING" || s === "OPEN") return "bg-ink-strong text-on-dark";
  if (s === "IN_PROGRESS" || s === "EXECUTING" || s === "FILING")
    return "bg-accent text-accent-ink";
  if (s === "FILED" || s === "DONE" || s === "CLOSED")
    return "bg-success-tint text-ink";
  return "bg-panel text-ink-muted";
}
