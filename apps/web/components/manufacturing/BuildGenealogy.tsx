import type { GenealogyStep } from "@/lib/manufacturing";
import { statusBadge, titleCase } from "./format";

// Build genealogy (Manufacturing.dc.html) — the as-built station trace for one
// serial (the genealogy anchor), captured as-built, never reconstructed. Each
// step is a station the unit passed through, with its status. Brand palette only.
//
// Note: the part-level tree (parts · serials · firmware — SERVO-204/-205, lot
// 88421, CB-12) is ONT.2; this panel shows the station-level as-built trace that
// WorkOrderMfg captures.
export function BuildGenealogy({
  serial,
  steps,
}: {
  serial: string;
  steps: GenealogyStep[];
}) {
  return (
    <div className="rounded-card border border-line bg-paper px-5 pb-2 pt-[18px]">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Build genealogy · {serial || "—"}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {steps.length} station{steps.length === 1 ? "" : "s"}
        </span>
      </div>
      {steps.length === 0 ? (
        <p className="border-t border-line py-6 text-sm text-ink-muted">
          No build history for this serial.
        </p>
      ) : (
        steps.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 border-t border-line py-[11px]"
          >
            <span
              aria-hidden
              className="h-2 w-2 flex-none rounded-[2px] bg-line-strong"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-ink">
                {s.station}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                {s.product}
                {s.startedAt
                  ? ` · ${new Date(s.startedAt).toISOString().slice(0, 10)}`
                  : ""}
              </div>
            </div>
            <span
              className={`inline-flex flex-none items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${statusBadge(s.status)}`}
            >
              {titleCase(s.status)}
            </span>
          </div>
        ))
      )}
      <p className="border-t border-line py-[11px] font-mono text-[10px] text-ink-muted">
        Part-level genealogy (parts · serials · firmware) → ONT.2
      </p>
    </div>
  );
}
