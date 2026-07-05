"use client";

import { Plus } from "lucide-react";
import type { FulfillmentData } from "@/lib/fulfillment";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { DeliveryPipeline } from "./DeliveryPipeline";
import { ShipmentPanel } from "./ShipmentPanel";
import { CommissioningPanel } from "./CommissioningPanel";
import { StatStrip } from "@/components/shell/StatStrip";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

export interface FulfillmentScreenData extends FulfillmentData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

const TRANSIT = new Set(["CRATE", "FREIGHT", "CUSTOMS"]);
const ONSITE = new Set(["ONSITE", "COMMISSION"]);

// The Fulfillment & Delivery screen (FUL.2, matching Fulfillment.dc.html on the
// v2 shell): the delivery pipeline leads (signature artifact), then the shipment
// + commissioning detail panels, then the agent trace. Read-only from FUL.1; the
// Fulfillment agents come in the module-aware pane automatically. "Schedule
// delivery" routes to the agent (proposes; scheduling a real delivery is a gated
// write — deferred, see notes).
export function FulfillmentView({
  data,
  error = false,
}: {
  data: FulfillmentScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const total = data.deliveries.length;
  const inTransit = data.deliveries.filter((d) => TRANSIT.has(d.stage)).length;
  const onSite = data.deliveries.filter((d) => ONSITE.has(d.stage)).length;
  const atRisk = data.holds.length;
  const onTimePct =
    total === 0
      ? 100
      : Math.round(
          (data.deliveries.filter((d) => !d.late).length / total) * 100,
        );
  const hasData = total > 0;

  const atRiskShipment = data.holds[0];
  const commissioning = data.deliveries.find((d) => ONSITE.has(d.stage));

  // Design metrics (real data). "Installs this week" / "avg lead time" need a
  // dispatch/order date we don't model — On-site + At risk fill those slots.
  const stats = [
    { v: `${onTimePct}%`, l: "On-time" },
    { v: inTransit, l: "In transit" },
    { v: onSite, l: "On-site" },
    { v: atRisk, l: "At risk" },
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
              Value chain · {inTransit} in transit · {onSite} installs due
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Fulfillment &amp; Delivery
            </h1>
          </div>
          <div className="flex items-center gap-[14px]">
            <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className={`h-[7px] w-[7px] rounded-full ${atRisk > 0 ? "bg-ink-strong" : "bg-success"}`}
              />
              {atRisk} deliver{atRisk === 1 ? "y" : "ies"} at risk
            </span>
            <button
              type="button"
              onClick={() => {
                setSeed("Schedule a delivery for an allocated order");
                setCollapsed(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Schedule delivery
            </button>
          </div>
        </>
      }
    >
      {error ? (
        <ScreenMessage>
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load fulfillment data. Check the database and refresh.
          </p>
        </ScreenMessage>
      ) : !hasData ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No deliveries — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </ScreenMessage>
      ) : (
        <>
          {/* summary strip */}
          <StatStrip stats={stats} />

          <DeliveryPipeline deliveries={data.deliveries} />

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            <ShipmentPanel delivery={atRiskShipment} />
            <CommissioningPanel delivery={commissioning} />
          </div>

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · ful-orchestrator"
            />
          )}
        </>
      )}
    </ScreenShell>
  );
}
