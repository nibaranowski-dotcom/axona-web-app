import type { Delivery } from "@/lib/fulfillment";

// Shipment detail for the at-risk delivery (Fulfillment.dc.html). Built from the
// real Delivery fields — a hold / late row reads in ink (critical), brand only.
// (The design's per-leg carrier detail isn't in the Delivery model — see notes.)
function fmt(dt: Date): string {
  return new Date(dt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ShipmentPanel({
  delivery,
}: {
  delivery: Delivery | undefined;
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Shipment{delivery ? ` · ${delivery.code}` : ""}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {delivery ? delivery.stage : "—"}
        </span>
      </div>
      {!delivery ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No shipment at risk.
        </p>
      ) : (
        (
          [
            { k: "Account", v: delivery.account, warn: false },
            { k: "Units", v: delivery.units, warn: false },
            { k: "Destination", v: delivery.destination, warn: false },
            { k: "Committed", v: fmt(delivery.committedDate), warn: false },
            { k: "ETA", v: fmt(delivery.etaDate), warn: delivery.late },
            { k: "Risk", v: delivery.riskState, warn: delivery.atRisk },
          ] as const
        ).map((r) => (
          <div
            key={r.k}
            className="flex items-center justify-between gap-[10px] border-t border-line py-[9px] text-[13px]"
          >
            <span className="text-ink-muted">{r.k}</span>
            <span
              className={`text-right font-mono text-[11.5px] ${r.warn ? "font-semibold text-ink-strong" : "text-ink"}`}
            >
              {r.v}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
