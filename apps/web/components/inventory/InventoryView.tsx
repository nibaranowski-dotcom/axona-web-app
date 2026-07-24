"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type {
  EdgeCache,
  InventoryData,
  LocationStock,
  PartMasterRow,
} from "@/lib/inventory";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { StatStrip } from "@/components/shell/StatStrip";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";
import { ECHELON_COLOR, STATUS_BADGE, coverBar, fmtUsd } from "./format";

export interface InventoryScreenData extends InventoryData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

const PARTS_COLS =
  "grid grid-cols-[1.7fr_0.8fr_0.8fr_1.5fr_1.1fr] items-center gap-3";
const PM_COLS =
  "grid grid-cols-[1.3fr_1fr_1fr_0.9fr_1fr_0.9fr] items-center gap-3";

// PLM.V6 lifecycle badge — sanctioned tokens only (ink for attention, success for
// live). ncr_hold reads ink-strong (a hold needs to stand out; ink is the brand's
// critical color — never an invented red).
const LIFECYCLE_BADGE: Record<PartMasterRow["lifecycleTone"], string> = {
  active: "bg-success-tint text-success",
  eol: "bg-ink-strong text-on-dark",
  hold: "bg-ink-strong text-on-dark",
};

// The Inventory & Warehouse screen (INV.2, matching Inventory.dc.html on the v2
// shell): stat strip · stock-by-echelon · critical parts (cover vs build
// schedule) · edge caches + RMA · inv-orchestrator trace. Read-only — reorder is
// Procurement's gated write; transfer/RMA are agent-drafted (RBAC.4/AUDIT.3).
// Days-of-cover is the labelled stand-in (Part.dailyUse). The module Inventory
// agents populate the pane automatically.
export function InventoryView({
  data,
  error = false,
}: {
  data: InventoryScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const propose = (prompt: string) => {
    setSeed(prompt);
    setCollapsed(false);
  };

  const r = data.rollup;
  const hasData =
    data.stockByLocation.length > 0 || data.criticalParts.length > 0;

  const stats = [
    { v: fmtUsd(r.totalValueUsd), l: "Inventory value" },
    { v: String(data.criticalParts.length), l: "Critical SKUs" },
    { v: String(r.reorderNeeded), l: "Below cover" },
    { v: String(r.reservedTotal), l: "Reserved" },
  ];
  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? new Date(l.ts).toISOString().slice(11, 19) : "",
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));
  const maxValue = Math.max(1, ...data.stockByLocation.map((l) => l.valueUsd));

  return (
    <ScreenShell
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Value chain · central · line-side · 3 edge caches
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Inventory &amp; Warehouse
            </h1>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-ink-strong"
              />
              {r.reorderNeeded} parts below cover
            </span>
            <button
              type="button"
              onClick={() =>
                propose(
                  "Draft a stock move between echelons and reserve against builds",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Stock move
            </button>
          </div>
        </>
      }
    >
      {error ? (
        <ScreenMessage>
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load inventory. Check the database and refresh.
          </p>
        </ScreenMessage>
      ) : !hasData ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No inventory — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </ScreenMessage>
      ) : (
        <>
          <StatStrip stats={stats} />

          {/* stock by location */}
          <section className="shrink-0 rounded-card border border-line bg-paper px-5 py-[18px]">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">
                Stock by location
              </h2>
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                {fmtUsd(r.totalValueUsd)} ON HAND
              </span>
            </div>
            <p className="mb-4 text-[12px] text-ink-muted">
              Multi-echelon: central warehouse feeds the line, line-side feeds
              builds, edge caches feed the deployed fleet.
            </p>
            {data.stockByLocation.map((e, i) => (
              <EchelonRow
                key={e.kind}
                e={e}
                maxValue={maxValue}
                edges={data.edgeCaches}
                first={i === 0}
              />
            ))}
            <div className="mt-3.5 flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <Legend color="bg-ink-strong" label="Parts & sub-assemblies" />
              <Legend color="bg-accent" label="Spares at the edge" />
              <Legend color="bg-ink-faint" label="Finished goods" />
            </div>
          </section>

          {/* critical parts */}
          <section className="shrink-0 overflow-hidden rounded-card border border-line bg-paper">
            <div className="flex items-center justify-between px-5 pb-3 pt-[15px]">
              <h2 className="text-[15px] font-semibold text-ink">
                Critical parts · cover vs build schedule
              </h2>
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                {data.criticalParts.length} SKUS TRACKED
              </span>
            </div>
            <div
              className={`${PARTS_COLS} border-t border-line px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
            >
              <span>Part</span>
              <span>On hand</span>
              <span>Reserved</span>
              <span>Days of cover</span>
              <span>Status</span>
            </div>
            {data.criticalParts.map((p) => {
              const badge = STATUS_BADGE[p.status];
              const bar = coverBar(p.status, p.daysOfCover);
              // Quarantine is conveyed by the badge + "On hold" cover (not row
              // opacity — dimming would drop the text below AA contrast).
              return (
                <div
                  key={p.id}
                  className={`${PARTS_COLS} border-t border-line px-5 py-[13px]`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[12.5px] font-semibold text-ink">
                      {p.sku}
                    </div>
                    <div
                      className="mt-px truncate text-[11px] text-ink-muted"
                      title={p.name}
                    >
                      {p.name}
                    </div>
                    {p.reorderNeeded && p.incomingPo && (
                      <div className="mt-0.5 font-mono text-[9.5px] text-ink-muted">
                        → {p.incomingPo.code} ({p.incomingPo.qty}) · Procurement
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[12.5px] text-ink">
                    {p.onHand}
                  </span>
                  <span className="font-mono text-[12.5px] text-ink-muted">
                    {p.reserved}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="h-[7px] max-w-[96px] flex-1 overflow-hidden rounded-pill bg-skeleton">
                      <span
                        className={`block h-[7px] ${bar.fill}`}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold text-ink">
                      {bar.label}
                    </span>
                  </div>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </section>

          {/* edge caches + RMA */}
          <div className="grid shrink-0 grid-cols-1 gap-[18px] lg:grid-cols-[1.15fr_1fr]">
            <section className="rounded-card border border-line bg-paper px-5 py-[18px]">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">
                  Field edge caches
                </h2>
                <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                  SPARES NEAR FLEET
                </span>
              </div>
              {data.edgeCaches.map((c) => (
                <EdgeRow key={c.location} c={c} />
              ))}
            </section>

            {/* Returns & RMA — no returns model yet (INV.1 deferred-ledger). */}
            <section className="rounded-card border border-line bg-paper px-5 py-[18px]">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">
                  Returns &amp; RMA
                </h2>
                <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                  DEFERRED
                </span>
              </div>
              <p className="py-6 text-center text-[12px] text-ink-muted">
                Returns pipeline not yet modeled — the RMA model lands in a
                later story (no fabricated numbers).
              </p>
            </section>
          </div>

          {/* part master · lot traceability (PLM.V6) */}
          {data.partMaster.length > 0 && (
            <section className="shrink-0 overflow-hidden rounded-card border border-line bg-paper">
              <div className="flex items-center justify-between px-5 pb-3 pt-[15px]">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold text-ink">
                    Part master · lot traceability
                  </h2>
                  <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
                    lot → units
                  </span>
                </div>
                <Link
                  href="/blast-radius?type=lot&value=88421"
                  className="text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Trace a lot →
                </Link>
              </div>
              <div
                className={`${PM_COLS} border-t border-line px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
              >
                <span>Part</span>
                <span>Category</span>
                <span>Vendors</span>
                <span>Lifecycle</span>
                <span>Lot</span>
                <span>In units</span>
              </div>
              {data.partMaster.slice(0, 8).map((p) => (
                <Link
                  key={p.id}
                  href={p.blastHref}
                  className={`${PM_COLS} border-t border-line px-5 py-3 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] font-semibold text-ink">
                      {p.partNumber}
                    </div>
                    <div className="mt-px truncate text-[10.5px] text-ink-faint">
                      {p.name}
                    </div>
                  </div>
                  <span className="text-[12px] text-ink-muted">
                    {p.category}
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {p.vendors}
                  </span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-[5px] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.03em] ${LIFECYCLE_BADGE[p.lifecycleTone]}`}
                    >
                      {p.lifecycle}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-[11px] ${p.lotQuarantine ? "font-semibold text-ink-strong" : "text-ink-muted"}`}
                  >
                    {p.lot ?? "—"}
                  </span>
                  <span className="font-mono text-[11.5px] font-semibold text-ink">
                    {p.unitsInField}
                  </span>
                </Link>
              ))}
            </section>
          )}

          {/* inv-orchestrator trace */}
          {trace.length > 0 && (
            <div className="shrink-0">
              <TraceConsole
                lines={trace}
                title="Agent trace · inv-orchestrator"
              />
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function EchelonRow({
  e,
  maxValue,
  edges,
  first,
}: {
  e: LocationStock;
  maxValue: number;
  edges: EdgeCache[];
  first: boolean;
}) {
  const pct = Math.max(4, Math.round((e.valueUsd / maxValue) * 100));
  const detail =
    e.kind === "EDGE_CACHE"
      ? edges.map((c) => c.location).join(" · ")
      : e.kind === "FINISHED_GOODS"
        ? `${e.onHand} units · pre-delivery`
        : e.kind === "CENTRAL"
          ? "parts & sub-assy"
          : "build-ready";
  return (
    <div
      className={`flex items-center gap-3.5 py-2.5 ${first ? "" : "border-t border-line"}`}
    >
      <div className="w-[150px] flex-none">
        <div className="truncate text-[13px] font-semibold text-ink">
          {e.label}
        </div>
        <div className="mt-px truncate font-mono text-[9.5px] text-ink-muted">
          {detail}
        </div>
      </div>
      <span className="h-3.5 flex-1 overflow-hidden rounded-[5px] bg-skeleton">
        <span
          className={`block h-3.5 ${ECHELON_COLOR[e.kind]}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-[64px] flex-none text-right font-mono text-[12.5px] font-semibold text-ink">
        {fmtUsd(e.valueUsd)}
      </span>
    </div>
  );
}

function EdgeRow({ c }: { c: EdgeCache }) {
  const replenish = c.state === "REPLENISH";
  // AA: the colored DOT carries state; the label stays ink (green text ~3.4:1 fails).
  const dot = replenish ? "bg-ink-strong" : "bg-success";
  const detail = replenish
    ? `Below min · ${c.skusShort} SKU${c.skusShort === 1 ? "" : "s"} short`
    : `${c.onHand} on hand · stocked`;
  return (
    <div className="flex items-center justify-between gap-2.5 border-t border-line py-[11px] first:border-t-0">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">
          {c.location} edge cache
        </div>
        <div className="mt-px font-mono text-[10px] text-ink-muted">
          {detail}
        </div>
      </div>
      <span className="inline-flex flex-none items-center gap-1.5 text-[11px] font-semibold text-ink">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {replenish ? "Replenish" : "Stocked"}
      </span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
    </span>
  );
}
