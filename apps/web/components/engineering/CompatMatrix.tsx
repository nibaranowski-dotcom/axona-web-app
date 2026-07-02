import { Fragment } from "react";
import type { CompatMatrix as CompatMatrixData } from "@/lib/engineering";

// HW ↔ firmware compatibility matrix — the Engineering signature artifact
// (Engineering.dc.html). hwRevs (rows) × fwVersions (cols); each cell a state
// dot: cert = green · compatible = neutral · in-test = lime (attention) · n/a =
// muted · blocked = ink. No invented reds.
const CELL: Record<string, { dot: string; label: string }> = {
  cert: { dot: "bg-success", label: "Cert" },
  compatible: { dot: "bg-ink-faint", label: "Compat" },
  "in-test": { dot: "bg-accent", label: "In test" },
  na: { dot: "bg-line-strong", label: "n/a" },
  blocked: { dot: "bg-ink-strong", label: "Blocked" },
};

export function CompatMatrix({ matrix }: { matrix: CompatMatrixData }) {
  const { hwRevs, fwVersions, cells } = matrix;
  const byKey = new Map(
    cells.map((c) => [`${c.hwRev}|${c.fwVersion}`, c.state]),
  );

  return (
    <section
      aria-label="Hardware and firmware compatibility"
      className="rounded-card border border-line bg-paper p-5"
    >
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          HW ↔ firmware compatibility
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Certified matrix
        </span>
      </div>

      <div
        className="grid gap-[2px]"
        style={{
          gridTemplateColumns: `1.1fr repeat(${Math.max(fwVersions.length, 1)}, 1fr)`,
        }}
      >
        <span aria-hidden />
        {fwVersions.map((f) => (
          <span
            key={f}
            className="px-1 py-1.5 text-center font-mono text-[9px] text-ink-muted"
          >
            {f}
          </span>
        ))}
        {hwRevs.map((hw) => (
          <Fragment key={hw}>
            <span className="flex items-center px-1 font-mono text-[11px] font-semibold text-ink">
              {hw}
            </span>
            {fwVersions.map((f) => {
              const state = byKey.get(`${hw}|${f}`) ?? "na";
              const meta = CELL[state] ?? {
                dot: "bg-line-strong",
                label: "n/a",
              };
              return (
                <div
                  key={f}
                  className="flex flex-col items-center gap-1 rounded-md bg-panel-2 py-[9px]"
                  title={`${hw} × ${f}: ${state}`}
                >
                  <span
                    aria-hidden
                    className={`h-[9px] w-[9px] rounded-pill ${meta.dot}`}
                  />
                  <span className="font-mono text-[8px] uppercase tracking-[0.03em] text-ink-muted">
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-4 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-pill bg-success" />
          Certified
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-pill bg-ink-faint" />
          Compatible
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-pill bg-accent" />
          In test
        </span>
      </div>
    </section>
  );
}
