import type { LegalExportLicense } from "@/lib/legal";
import { exportDot, titleCase } from "./format";

// Export control (Legal.dc.html) — dual-use license state per shipment. The
// DLV-3312 EAR99 hold surfaces here (ink dot). State via a dot + ink text
// (AA-safe). Brand palette only.
export function ExportControl({
  licenses,
}: {
  licenses: LegalExportLicense[];
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Export control</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Dual-use · per shipment
        </span>
      </div>
      {licenses.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No export licenses.
        </p>
      ) : (
        licenses.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-[10px] border-t border-line py-[11px]"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-ink">
                {e.destination}
              </div>
              <div className="mt-px truncate font-mono text-[9.5px] text-ink-muted">
                {e.code}
              </div>
            </div>
            <span className="inline-flex flex-none items-center gap-1.5 text-[10.5px] font-semibold text-ink">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-pill ${exportDot(e.state)}`}
              />
              {titleCase(e.state)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
