import type { Severity } from "@axona/db";
import type { QualityNcr } from "@/lib/quality";

// The NCR tracker (Quality.dc.html) — open non-conformances, CRITICAL first.
// Severity carried by a dot (ink = critical · lime = major · green = minor) with
// ink text — AA-safe; criticals are ink, never a warning hue.
const SEV: Record<Severity, { dot: string; label: string }> = {
  CRITICAL: { dot: "bg-ink-strong", label: "Critical" },
  MAJOR: { dot: "bg-accent", label: "Major" },
  MINOR: { dot: "bg-success", label: "Minor" },
};

const COLS =
  "grid grid-cols-[0.9fr_2fr_1.7fr_1fr_0.8fr] items-center gap-3 px-5";

export function NcrTable({ ncrs }: { ncrs: QualityNcr[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">
          Open non-conformances
        </h2>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
          {ncrs.length} open
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>NCR</span>
        <span>Defect</span>
        <span>Linked to</span>
        <span>Severity</span>
        <span>Status</span>
      </div>
      {ncrs.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No open non-conformances.
        </p>
      ) : (
        ncrs.map((n) => {
          const sev = SEV[n.severity];
          return (
            <div
              key={n.id}
              className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
            >
              <span className="font-mono text-[12.5px] text-ink">{n.code}</span>
              <span className="truncate text-[13px] text-ink">{n.defect}</span>
              <span className="truncate font-mono text-[11px] text-ink-muted">
                {n.linkedTo}
              </span>
              <span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-panel px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] text-ink">
                  <span
                    aria-hidden
                    className={`h-[6px] w-[6px] rounded-pill ${sev.dot}`}
                  />
                  {sev.label}
                </span>
              </span>
              <span className="text-[12.5px] capitalize text-ink-muted">
                {n.status.toLowerCase()}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
