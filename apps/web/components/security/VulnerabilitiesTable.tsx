import type { PatchRollout, SecurityCve } from "@/lib/security";
import { SEV_BADGE, titleCase } from "./format";

// Vulnerabilities — the CVE-triage signature artifact (Security.dc.html). CVE ·
// component · affected · severity · remediation. The deployed-unit CVE's
// remediation carries the signed-firmware patch + Engineering's cert gate
// (CVE-2026-3187 → v4.2.2-rc · in-test). Critical severity renders in ink per the
// brand palette (no warning hue).
//
// Note: the CVE model has no component field → the Component column shows a
// derived scope (deployed fleet vs component library); per-CVE component names
// are a deferred data-shape gap (SEC.2 notes).
const COLS =
  "grid grid-cols-[1.1fr_1.9fr_1fr_0.9fr_1.1fr] items-center gap-3 px-5";

export function VulnerabilitiesTable({
  cves,
  patchRollouts,
}: {
  cves: SecurityCve[];
  patchRollouts: PatchRollout[];
}) {
  const rolloutByCve = new Map(
    patchRollouts.filter((p) => p.forCve).map((p) => [p.forCve, p]),
  );
  const remediation = (cve: SecurityCve): string => {
    const rollout = rolloutByCve.get(cve.code);
    if (rollout) return `${rollout.version} · ${rollout.certGate}`;
    const s = cve.status.toUpperCase();
    if (s === "MITIGATED") return "Mitigated";
    if (s === "PATCH_DRAFTED") return "Patch drafted";
    return "Triage";
  };
  const fleetAffecting = cves.filter((c) => c.affectsDeployed).length;

  return (
    <section
      aria-label="Vulnerabilities"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Vulnerabilities</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {fleetAffecting} fleet-affecting
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>CVE</span>
        <span>Component</span>
        <span>Affected</span>
        <span>Severity</span>
        <span>Remediation</span>
      </div>
      {cves.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No open vulnerabilities.
        </p>
      ) : (
        cves.map((v) => (
          <div
            key={v.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <span className="font-mono text-[12px] text-ink">{v.code}</span>
            <span
              className="truncate text-[13px] text-ink"
              title={
                v.affectsDeployed ? "Deployed fleet · OT" : "Component library"
              }
            >
              {v.affectsDeployed ? "Deployed fleet · OT" : "Component library"}
            </span>
            <span className="font-mono text-[11.5px] text-ink-muted">
              {v.affectedUnits > 0 ? `${v.affectedUnits} units` : "component"}
            </span>
            <span>
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${SEV_BADGE[v.severity]}`}
              >
                {titleCase(v.severity)}
              </span>
            </span>
            <span
              className="truncate font-mono text-[11.5px] text-ink-muted"
              title={remediation(v)}
            >
              {remediation(v)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
