import type { Delivery } from "@/lib/fulfillment";
import { DeliveryCard } from "./DeliveryCard";

// The delivery pipeline (Fulfillment.dc.html) — the signature artifact: every
// delivery as a card carrying its ALLOC → ACTIVE station track.
export function DeliveryPipeline({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <section
      aria-label="Delivery pipeline"
      className="flex flex-col gap-[14px]"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
          Deliveries
        </span>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] text-ink-muted">
          Alloc → Crate → Freight → Customs → On-site → Commission → Active
        </span>
      </div>
      {deliveries.length === 0 ? (
        <p className="rounded-card border border-line bg-paper px-4 py-8 text-center text-sm text-ink-muted">
          No deliveries in the pipeline.
        </p>
      ) : (
        deliveries.map((d) => <DeliveryCard key={d.id} d={d} />)
      )}
    </section>
  );
}
