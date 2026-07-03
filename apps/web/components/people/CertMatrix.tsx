import type { CertMatrix as CertMatrixData } from "@/lib/people";
import { CELL_DOT, certCell, certLabel, sortCertKeys } from "./format";

// Certification matrix — the People signature artifact (People.dc.html). A tech ×
// cert-type grid; each cell is a dot (certified = green · expiring < 30d = ink ·
// in-training = lime · not-held = skeleton) so dispatch eligibility reads at a
// glance. M. Osei's HV/battery cell is ink (expiring) — the dispatch gate. Brand
// palette only.
export function CertMatrix({ matrix }: { matrix: CertMatrixData }) {
  const keys = sortCertKeys(matrix.certKeys);
  const gridCols = `minmax(140px, 1.2fr) ${keys.map(() => "minmax(56px, 1fr)").join(" ")}`;

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Field technician certifications
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Gates field-service dispatch
        </span>
      </div>
      <p className="mb-3.5 text-[12px] text-ink-muted">
        A tech can only be dispatched to a job their certification covers.
        Expiries are tracked against every deployed model.
      </p>

      <div
        role="region"
        aria-label="Field technician certification matrix"
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div
          className="grid min-w-[520px] gap-0.5"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="px-1 py-1.5" />
          {keys.map((k) => (
            <span
              key={k}
              className="px-0.5 py-1.5 text-center font-mono text-[8.5px] uppercase tracking-[0.03em] text-ink-muted"
            >
              {certLabel(k)}
            </span>
          ))}

          {matrix.technicians.map((t) => (
            <div key={t.id} className="contents">
              <span className="flex items-center gap-2 px-1 py-2 text-[12px] font-semibold text-ink">
                <span
                  aria-hidden
                  className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-line-strong bg-panel font-mono text-[8.5px] font-bold text-ink"
                >
                  {t.initials}
                </span>
                <span className="truncate">{t.name}</span>
              </span>
              {keys.map((k) => {
                const cell = certCell(t, k);
                return (
                  <div
                    key={k}
                    className="flex flex-col items-center gap-1 rounded-md bg-panel-2 py-[9px]"
                    title={`${t.name} · ${certLabel(k)} · ${cell.label}`}
                  >
                    <span
                      aria-hidden
                      className={`h-[9px] w-[9px] rounded-full ${CELL_DOT[cell.state]}`}
                    />
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.02em] text-ink-muted">
                      {cell.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3">
        {[
          { dot: "bg-success", label: "Certified" },
          { dot: "bg-ink-strong", label: "Expiring < 30d" },
          { dot: "bg-accent", label: "In training" },
          { dot: "bg-skeleton", label: "Not held" },
        ].map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted"
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
