"use client";

import { useState } from "react";
import { Factory, Plus, Truck } from "lucide-react";
import type { MachinesData, MachineRow } from "@/lib/machines";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { HEALTH_DOT, STATUS_BADGE, utilColor } from "./format";

export interface MachinesScreenData extends MachinesData {
  traceLines?: unknown;
}

const COLS =
  "grid grid-cols-[2.2fr_1fr_1fr_1.3fr_1.4fr_0.8fr] items-center gap-[14px]";

// The Machines screen (MACH.1, matching Machines.dc.html on the v2 shell): the
// plant & equipment register as a full-width table grouped Fixed / Mobile, each
// row's status / utilization / health / telemetry cells, plus a needs-service
// filter. Read-only; the Maintenance agents come in the module-aware pane
// automatically. "Register machine" / service actions route to the agent
// (propose; a real write is gated — RBAC.4/AUDIT.3 — deferred, see notes).
export function MachinesView({
  data,
  error = false,
}: {
  data: MachinesScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const [needsOnly, setNeedsOnly] = useState(false);

  const r = data.rollup;
  const hasData = r.total > 0;

  const stats = [
    { v: r.total, l: "Machines" },
    { v: r.running, l: "Running now" },
    { v: r.maintenance, l: "In maintenance" },
    { v: `${r.avgUtilization}%`, l: "Avg utilization" },
  ];

  const visibleGroups = data.groups
    .map((g) => ({
      ...g,
      machines: needsOnly
        ? g.machines.filter((m) => m.needsService)
        : g.machines,
    }))
    .filter((g) => g.machines.length > 0);

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Core · plant &amp; equipment register
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Machines
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setSeed("Register a new machine and start its telemetry");
            setCollapsed(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Register machine
        </button>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load machines. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No machines — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <>
          {/* stat strip + needs-service filter */}
          <div className="flex flex-none flex-wrap items-center gap-x-[18px] gap-y-2 border-b border-line bg-paper px-6 py-[13px]">
            {stats.map((s) => (
              <div key={s.l}>
                <span className="text-[16px] font-bold text-ink">{s.v}</span>
                <span className="ml-1 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
                  {s.l}
                </span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNeedsOnly(false)}
                aria-pressed={!needsOnly}
                className={`rounded-pill border px-3 py-[5px] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${!needsOnly ? "border-ink-strong bg-ink-strong text-on-dark" : "border-line-strong bg-paper text-ink"}`}
              >
                All machines
              </button>
              <button
                type="button"
                onClick={() => setNeedsOnly(true)}
                aria-pressed={needsOnly}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-[5px] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${needsOnly ? "border-ink-strong bg-ink-strong text-on-dark" : "border-line-strong bg-paper text-ink"}`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-ink-strong"
                />
                Needs service {r.needsService}
              </button>
            </div>
          </div>

          {/* table header */}
          <div
            className={`${COLS} flex-none border-b border-line bg-panel px-6 py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
          >
            <span>Machine</span>
            <span>Location</span>
            <span>Status</span>
            <span>Utilization</span>
            <span>Health</span>
            <span>Telemetry</span>
          </div>

          <div
            role="region"
            aria-label="Machines register"
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            {visibleGroups.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                No machines need service.
              </p>
            ) : (
              visibleGroups.map((g) => (
                <div key={g.kind}>
                  <div className="mb-1.5 mt-4 flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-[7px] w-[7px] flex-none rounded-[2px] bg-ink-strong"
                    />
                    <span className="text-[13px] font-semibold text-ink">
                      {g.label}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {g.machines.length} machines
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-line" />
                  </div>
                  {g.machines.map((m) => (
                    <MachineRowView key={m.id} m={m} />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MachineRowView({ m }: { m: MachineRow }) {
  const badge = STATUS_BADGE[m.status];
  const Icon = m.kind === "FIXED" ? Factory : Truck;
  return (
    <div className={`${COLS} border-b border-line px-2 py-3`}>
      <div className="flex min-w-0 items-center gap-[11px]">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-panel-2 text-ink-muted">
          <Icon className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">
            {m.name}
          </div>
          <div className="mt-px font-mono text-[9.5px] text-ink-muted">
            {m.assetId} · {m.kind}
          </div>
        </div>
      </div>
      <span className="truncate font-mono text-[11px] text-ink-muted">
        {m.location}
      </span>
      <span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${badge.cls}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
          />
          {badge.label}
        </span>
      </span>
      <div className="flex items-center gap-[9px]">
        <span className="h-[7px] max-w-[88px] flex-1 overflow-hidden rounded-pill bg-skeleton">
          <span
            className={`block h-[7px] ${utilColor(m.utilization)}`}
            style={{ width: `${m.utilization}%` }}
          />
        </span>
        <span className="w-[34px] font-mono text-[11px] text-ink-muted">
          {m.utilization > 0 ? `${m.utilization}%` : "—"}
        </span>
      </div>
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={`h-[7px] w-[7px] flex-none rounded-full ${HEALTH_DOT[m.healthLevel]}`}
        />
        <span className="truncate text-[12px] text-ink">{m.health}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.03em] text-ink-muted">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${m.telemetryOnline ? "bg-success" : "bg-line-strong"}`}
        />
        {m.telemetryOnline ? "Online" : "Offline"}
      </span>
    </div>
  );
}
