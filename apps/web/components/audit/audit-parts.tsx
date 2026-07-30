import type { AuditEntry } from "@/lib/audit-trail";
import { LOW_CONFIDENCE } from "@/lib/audit-trail";

// HIST.1 — the shared AUDIT.1 row-rendering parts. Extracted from AuditView (AUDIT.4)
// so the audit-trail screen AND the per-record <RecordHistory> timeline (HIST.1)
// render an actor + the AUDIT.3 model/CONF.1-calibrated-confidence badge THE SAME
// WAY — one renderer, not a fork. Pure presentational; the data is an AuditEntry
// from the one reader (getAuditTrail / getRecordHistory).

/** Initials for the actor avatar (人 or agent or system). */
export function initials(label: string): string {
  const parts = label
    .trim()
    .split(/[\s·|-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Avatar swatch — AGENT=lime, HUMAN=ink, SYSTEM=neutral (brand invariants). */
export function ActorAvatar({
  actorType,
  actorLabel,
}: {
  actorType: AuditEntry["actorType"];
  actorLabel: string;
}) {
  const cls =
    actorType === "AGENT"
      ? "bg-accent text-accent-ink"
      : actorType === "HUMAN"
        ? "bg-ink-strong text-on-dark"
        : "bg-panel text-ink-muted border border-line-strong";
  return (
    <span
      aria-hidden
      className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full font-mono text-[9px] font-bold ${cls}`}
    >
      {initials(actorLabel)}
    </span>
  );
}

/**
 * The CONF.1 confidence cell for an audit entry: the calibrated value, the
 * uncalibrated (cold-start) marker, the raw-divergence hint, and the low-confidence
 * Review flag (INK, never red). Returns null for human/system entries with no
 * confidence. AUDIT.3 model is shown by the caller alongside where space allows.
 */
export function ConfidenceCell({ e }: { e: AuditEntry }) {
  if (e.confidence === null) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
      <span className="text-ink">
        {(e.calibrated?.value ?? e.confidence).toFixed(2)}
      </span>
      {e.calibrated?.state === "uncalibrated" ? (
        <span
          title={`raw ${e.confidence.toFixed(2)} · not enough decided proposals to calibrate yet`}
          className="rounded-[4px] border border-line px-1 py-px text-[8px] font-medium uppercase tracking-[0.03em] text-ink-muted"
        >
          uncal
        </span>
      ) : e.calibrated &&
        Math.abs(e.calibrated.value - e.confidence) >= 0.05 ? (
        <span
          title={`agent said ${e.confidence.toFixed(2)}; calibrated to the org's observed rate`}
          className="text-[9px] text-ink-faint"
        >
          ·raw {e.confidence.toFixed(2)}
        </span>
      ) : null}
      {e.confidence < LOW_CONFIDENCE && (
        <span className="rounded-pill bg-ink-strong px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.03em] text-on-dark">
          Review
        </span>
      )}
    </span>
  );
}
