"use client";

import { Plus } from "lucide-react";
import type { QualityData } from "@/lib/quality";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { SpcChart } from "./SpcChart";
import { DefectPareto } from "./DefectPareto";
import { CertList } from "./CertList";
import { NcrTable } from "./NcrTable";

export interface QualityScreenData extends QualityData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Quality & Testing screen (QUAL.2, matching Quality.dc.html on the v2
// shell): the SPC control chart leads (signature artifact), then defect Pareto +
// certs, then the NCR tracker. All read-only from QUAL.1; the Quality agents come
// in the module-aware pane automatically. "Open NCR" routes to the agent (the
// agent proposes; a human approves — no mutation here).
export function QualityView({
  data,
  error = false,
}: {
  data: QualityScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const primary =
    data.spcSeries.find((s) => s.characteristic === "drive_torque_Nm") ??
    data.spcSeries[0];
  const criticalCount = data.ncrs.filter(
    (n) => n.severity === "CRITICAL",
  ).length;
  const outOfSpec = primary
    ? primary.points.filter((p) => p.value > p.ucl || p.value < p.lcl).length
    : 0;
  const certsReady = data.certs.filter((c) => c.auditReady).length;
  const hasData =
    data.spcSeries.length > 0 || data.ncrs.length > 0 || data.certs.length > 0;

  const stats = [
    { v: data.ncrs.length, l: "Open NCRs" },
    { v: criticalCount, l: "Critical" },
    { v: outOfSpec, l: "Out of spec" },
    { v: `${certsReady}/${data.certs.length}`, l: "Certs ready" },
  ];

  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? l.ts.slice(11, 19) : undefined,
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Value chain · {data.ncrs.length} open NCRs
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Quality &amp; Testing
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          {criticalCount > 0 ? (
            <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-ink-strong"
              />
              {criticalCount} critical NCR
            </span>
          ) : (
            <span className="inline-flex items-center gap-[7px] rounded-pill bg-success-tint px-3 py-[5px] text-[12.5px] font-semibold text-success">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-success"
              />
              All conformant
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSeed("Open an NCR for the SERVO-204 torque breach");
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Open NCR
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load quality data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No quality data — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <div
          role="region"
          tabIndex={0}
          aria-label="Quality overview"
          className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {/* summary strip */}
          <div className="flex overflow-hidden rounded-card border border-line bg-paper">
            {stats.map((s, i) => (
              <div
                key={s.l}
                className={`flex-1 px-[18px] py-[15px] ${i ? "border-l border-line" : ""}`}
              >
                <div className="text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {s.v}
                </div>
                <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          {primary && <SpcChart series={primary} />}

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.3fr_1fr]">
            <DefectPareto bars={data.defectPareto} />
            <CertList certs={data.certs} />
          </div>

          <NcrTable ncrs={data.ncrs} />

          {trace.length > 0 && (
            <TraceConsole lines={trace} title="Agent trace · qa-orchestrator" />
          )}
        </div>
      )}
    </div>
  );
}
