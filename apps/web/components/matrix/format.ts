import type { MatrixCell } from "@/lib/matrix";

// MTX.2 display helpers. A cell is an agent-drafted PROPOSAL — value + citation +
// calibrated confidence. Low confidence is the "flag for human review" state,
// rendered in INK (never red). Brand palette only.

export const REVIEW_THRESHOLD = 0.4;

export function isLowConfidence(cell: MatrixCell | undefined): boolean {
  return !!cell && cell.confidence < REVIEW_THRESHOLD;
}

// Confidence dot tone: high = green (grounded), mid = neutral, low = ink (review).
export function confidenceDot(confidence: number): string {
  if (confidence >= 0.7) return "bg-success";
  if (confidence < REVIEW_THRESHOLD) return "bg-ink-strong";
  return "bg-line-strong";
}

export function fmtConfidence(confidence: number): string {
  return confidence.toFixed(2);
}

const EXT_ICON: Record<string, string> = {};
export function fmtExt(ext: string): string {
  return (EXT_ICON[ext.toLowerCase()] ?? ext).toUpperCase();
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
