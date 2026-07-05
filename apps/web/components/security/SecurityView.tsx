"use client";

import { Plus } from "lucide-react";
import type { AccessGrant, SecurityData } from "@/lib/security";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { PosturePanel } from "./PosturePanel";
import { AccessPanel } from "./AccessPanel";
import { VulnerabilitiesTable } from "./VulnerabilitiesTable";
import { StatStrip } from "@/components/shell/StatStrip";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

export interface SecurityScreenData extends SecurityData {
  accessGrants: AccessGrant[];
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The IT & Security screen (SEC.2, matching Security.dc.html on the v2 shell):
// fleet endpoint posture + fleet command access, then the CVE-triage
// vulnerabilities table (signature artifact), then the agent trace. Read-only
// from SEC.1; the Security agents come in the module-aware pane automatically.
// "Push patch" routes to the agent (proposes; the real patch deploy is a gated
// write owned by Engineering's cert gate — deferred, see notes).
export function SecurityView({
  data,
  error = false,
}: {
  data: SecurityScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const r = data.rollup;
  const endpoints = r.postureSpread.reduce((n, b) => n + b.count, 0);
  const criticalCves =
    r.bySeverity.find((s) => s.severity === "CRITICAL")?.count ?? 0;
  const hasData = data.cves.length > 0 || endpoints > 0;

  // Real metrics. The design's "MFA coverage / mean patch time" need an access /
  // patch-timing model the schema lacks → Open rollouts + Units affected fill
  // those slots; "Endpoints" counts deployed robots (gateways/IT not modeled).
  const stats = [
    { v: endpoints, l: "Endpoints" },
    { v: criticalCves, l: "Critical CVEs" },
    { v: r.openRollouts, l: "Open rollouts" },
    { v: r.unitsAffected, l: "Units affected" },
  ];

  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? l.ts.slice(11, 19) : undefined,
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));

  return (
    <ScreenShell
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Back office · OT + IT · {endpoints} endpoints
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              IT &amp; Security
            </h1>
          </div>
          <div className="flex items-center gap-[14px]">
            <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className={`h-[7px] w-[7px] rounded-full ${criticalCves > 0 ? "bg-ink-strong" : "bg-success"}`}
              />
              {criticalCves} critical CVE{criticalCves === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSeed(
                  "Stage the CVE-2026-3187 patch (v4.2.2-rc) through the cert gate",
                );
                setCollapsed(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Push patch
            </button>
          </div>
        </>
      }
    >
      {error ? (
        <ScreenMessage>
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load security data. Check the database and refresh.
          </p>
        </ScreenMessage>
      ) : !hasData ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No security data — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </ScreenMessage>
      ) : (
        <>
          {/* summary strip */}
          <StatStrip stats={stats} />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.25fr_1fr]">
            <PosturePanel posture={data.devicePosture} />
            <AccessPanel grants={data.accessGrants} />
          </div>

          <VulnerabilitiesTable
            cves={data.cves}
            patchRollouts={data.patchRollouts}
          />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · sec-orchestrator"
            />
          )}
        </>
      )}
    </ScreenShell>
  );
}
