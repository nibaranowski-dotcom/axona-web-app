import type { Severity } from "@axona/db";
import type { SafetyIncident } from "@/lib/autonomy";

// Safety-incident log (Autonomy.dc.html) — incident · type · unit·site ·
// severity · status. Severity by a pill (critical = ink, major = lime, minor =
// neutral). Brand palette only.
const SEV_BADGE: Record<Severity, string> = {
  CRITICAL: "bg-ink-strong text-on-dark",
  MAJOR: "bg-accent text-accent-ink",
  MINOR: "bg-panel text-ink-muted",
};

const COLS =
  "grid grid-cols-[0.9fr_1.8fr_1.5fr_1fr_1fr] items-center gap-3 px-5";

export function SafetyIncidents({
  incidents,
}: {
  incidents: SafetyIncident[];
}) {
  return (
    <section
      aria-label="Safety incidents"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Safety incidents</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {incidents.length} logged
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Incident</span>
        <span>Type</span>
        <span>Unit · Site</span>
        <span>Severity</span>
        <span>Status</span>
      </div>
      {incidents.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No safety incidents.
        </p>
      ) : (
        incidents.map((n) => (
          <div
            key={n.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <span className="font-mono text-[12px] text-ink">{n.code}</span>
            <span className="truncate text-[13px] text-ink">{n.type}</span>
            <span className="truncate font-mono text-[11px] text-ink-muted">
              {n.robotSerial} · {n.site}
            </span>
            <span>
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${SEV_BADGE[n.severity]}`}
              >
                {n.severity.charAt(0) + n.severity.slice(1).toLowerCase()}
              </span>
            </span>
            <span className="text-[12.5px] capitalize text-ink-muted">
              {n.status.toLowerCase()}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
