import { DELIVERY_STAGES, type Delivery } from "@/lib/fulfillment";

// Commissioning detail for an on-site / commissioning delivery
// (Fulfillment.dc.html). Real stage progress (lime), from the Delivery model.
// (The design's per-unit commissioning checklist isn't in the model — see notes.)
export function CommissioningPanel({
  delivery,
}: {
  delivery: Delivery | undefined;
}) {
  const idx = delivery ? DELIVERY_STAGES.indexOf(delivery.stage) : 0;
  const pct = Math.round((idx / (DELIVERY_STAGES.length - 1)) * 100);
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Commissioning{delivery ? ` · ${delivery.code}` : ""}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {delivery ? delivery.stage : "—"}
        </span>
      </div>
      {!delivery ? (
        <p className="text-sm text-ink-muted">No installs in progress.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-[10px]">
            <div className="h-[6px] flex-1 overflow-hidden rounded-pill bg-[var(--skeleton)]">
              <span
                className="block h-[6px] rounded-pill bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-ink-muted">
              {pct}%
            </span>
          </div>
          {(
            [
              { k: "Account", v: delivery.account },
              { k: "Units", v: delivery.units },
              { k: "Destination", v: delivery.destination },
            ] as const
          ).map((r) => (
            <div
              key={r.k}
              className="flex items-center justify-between gap-[10px] border-t border-line py-[9px] text-[13px]"
            >
              <span className="text-ink-muted">{r.k}</span>
              <span className="text-right font-mono text-[11.5px] text-ink">
                {r.v}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
