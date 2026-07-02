import type { Severity } from "@axona/db";
import type { FieldTech, FieldWorkOrder } from "@/lib/field-service";
import { SLA_COLOR, humanizeStatus, slaLabel } from "./format";

// The SLA-tracked work-order queue (Field Service.dc.html). Each row: WO · unit ·
// site · issue · live SLA countdown · tech · status pill (by severity — critical
// = ink, major = lime, minor = neutral) — brand palette only.
const SEV_BADGE: Record<Severity, string> = {
  CRITICAL: "bg-ink-strong text-on-dark",
  MAJOR: "bg-accent text-accent-ink",
  MINOR: "bg-panel text-ink-muted",
};

const COLS =
  "grid grid-cols-[0.8fr_1.4fr_1.9fr_1fr_1fr_1fr] items-center gap-3 px-5";

export function WorkOrderQueue({
  workOrders,
  technicians,
}: {
  workOrders: FieldWorkOrder[];
  technicians: FieldTech[];
}) {
  const nameOf = new Map(technicians.map((t) => [t.id, t.name]));
  const open = workOrders.filter((w) => w.status.toUpperCase() !== "CLOSED");

  return (
    <section
      aria-label="Work orders"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Work orders</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {open.length} open · SLA tracked
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>WO</span>
        <span>Unit · Site</span>
        <span>Issue</span>
        <span>SLA</span>
        <span>Tech</span>
        <span>Status</span>
      </div>
      {workOrders.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No work orders.
        </p>
      ) : (
        workOrders.map((w) => {
          const sla = slaLabel(w);
          return (
            <div
              key={w.id}
              className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
            >
              <span className="font-mono text-[12px] text-ink">{w.code}</span>
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-semibold text-ink">
                  {w.robotSerial}
                </div>
                <div className="mt-px truncate text-[10.5px] text-ink-muted">
                  {w.site}
                </div>
              </div>
              <span className="truncate text-[13px] text-ink">{w.issue}</span>
              <span
                className={`font-mono text-[12px] font-semibold ${SLA_COLOR[sla.tone]}`}
              >
                {sla.text}
              </span>
              <span className="truncate text-[12.5px] text-ink-muted">
                {w.techId ? (nameOf.get(w.techId) ?? "—") : "Unassigned"}
              </span>
              <span>
                <span
                  className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${SEV_BADGE[w.severity]}`}
                >
                  {humanizeStatus(w.status)}
                </span>
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
