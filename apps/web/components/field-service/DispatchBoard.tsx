import type { DispatchColumn } from "@/lib/field-service";
import { humanizeStatus } from "./format";

// The technician dispatch board — the Field Service signature artifact
// (Field Service.dc.html). One lane per technician; their assigned (non-closed)
// work orders render as status-colored blocks (en route = lime · on-site = ink ·
// scheduled = hairline). A tech whose cert is expiring carries a lime "cert" flag
// — the dispatch gate. Brand palette only.
//
// Note: the design's precise clock-positioned blocks need a scheduled start/end
// per work order, which the model doesn't carry → blocks are the tech's queue
// ordered by SLA urgency (see FIELD.2 notes).
const BLOCK: Record<string, string> = {
  EN_ROUTE: "bg-accent",
  DISPATCH: "bg-accent",
  ON_SITE: "bg-ink-strong",
  ON_JOB: "bg-ink-strong",
  SCHEDULED: "border border-line-strong bg-panel-2",
  OPEN: "border border-line-strong bg-panel-2",
};

export function DispatchBoard({ board }: { board: DispatchColumn[] }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Today’s dispatch</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {board.length} techs
        </span>
      </div>
      <div className="flex flex-col">
        {board.map(({ tech, workOrders }) => {
          const active = workOrders.filter(
            (w) => w.status.toUpperCase() !== "CLOSED",
          );
          return (
            <div
              key={tech.id}
              className="flex items-center gap-3 border-t border-line py-[7px] first:border-t-0"
            >
              <div className="flex w-[166px] flex-none items-center gap-[9px]">
                <span
                  aria-hidden
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border border-line-strong bg-panel text-[10px] font-bold text-ink"
                >
                  {tech.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-ink">
                      {tech.name}
                    </span>
                    {tech.certExpiring && (
                      <span className="flex-none rounded-[4px] bg-accent px-[5px] py-px font-mono text-[8px] uppercase tracking-[0.04em] text-accent-ink">
                        cert
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-[8.5px] uppercase tracking-[0.04em] text-ink-muted">
                    {humanizeStatus(tech.status)}
                    {active[0] ? ` · ${active[0].robotSerial}` : ""}
                  </div>
                </div>
              </div>
              <div className="relative h-[30px] flex-1 overflow-hidden rounded-md bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(20%-1px),var(--line)_calc(20%-1px),var(--line)_20%)]">
                {active.slice(0, 3).map((w, i) => (
                  <span
                    key={w.id}
                    title={`${w.code} · ${humanizeStatus(w.status)}`}
                    className={`absolute bottom-1 top-1 rounded-[5px] ${BLOCK[w.status.toUpperCase()] ?? "border border-line-strong bg-panel-2"}`}
                    style={{ left: `${i * 26}%`, width: "22%" }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[13px] flex items-center gap-[18px] border-t border-line pt-3">
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
          En route
        </span>
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-[3px] bg-ink-strong"
          />
          On-site
        </span>
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-[3px] border border-line-strong bg-panel-2"
          />
          Scheduled
        </span>
      </div>
    </div>
  );
}
