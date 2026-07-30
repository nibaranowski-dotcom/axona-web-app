import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { EntityType } from "@axona/db";
import type { ConnectedGroup } from "@/lib/connected-objects";

// LINK.1 — the shared "Connected objects" panel. Renders a record's DIRECT graph
// neighbors (ONT.1 EntityLink, 1-hop), grouped by relation, each a one-click link
// to its detail route with the edge's `note` as the "why". Presentational — the
// data comes from getConnectedObjects (the shared getEntityLinks primitive). Drops
// onto any detail view as a secondary rail/section; never the signature artifact.
// v2 tokens · Lucide thin · no emoji · labelled, keyboard-operable links.

const TYPE_LABEL: Record<EntityType, string> = {
  NCR: "NCR",
  ECO: "Change",
  PART: "Part",
  LOT: "Lot",
  SUPPLIER: "Supplier",
  PURCHASE_ORDER: "PO",
  UNIT: "Unit",
  DELIVERY: "Delivery",
  WORK_ORDER: "Work order",
  SPC_SAMPLE: "SPC",
  INVOICE: "Invoice",
  PRODUCT_MODEL: "Model",
  PART_REVISION: "Part rev",
  CONFIG_VERSION: "Config",
  TEST_RUN: "Test run",
  FIELD_EVENT: "Field event",
};

export function ConnectedObjects({
  groups,
  className,
}: {
  groups: ConnectedGroup[];
  className?: string;
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section
      aria-labelledby="connected-objects-title"
      className={`rounded-card border border-line bg-paper p-5 ${className ?? ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="connected-objects-title"
          className="font-mono text-[10px] uppercase tracking-[0.07em] text-ink-muted"
        >
          Connected objects
        </h2>
        {total > 0 && (
          <span className="font-mono text-[11px] font-bold text-ink-strong">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[12px] leading-[1.5] text-ink-muted">
          Nothing is linked to this record yet. As it moves through the
          workflow, related records — NCRs, changes, parts, units — appear here.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.relation}>
              <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                {g.relationLabel}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {g.items.map((it) => (
                  <li key={`${it.type}:${it.code}`}>
                    <Link
                      href={it.route}
                      aria-label={`${TYPE_LABEL[it.type]} ${it.code} — ${it.label} (${g.relationLabel})`}
                      className="group block rounded-[10px] border border-line p-2.5 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-ink">
                          {it.code}
                        </span>
                        <span className="flex flex-none items-center gap-1 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
                          {TYPE_LABEL[it.type]}
                          <ArrowUpRight
                            className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                            strokeWidth={1.6}
                            aria-hidden
                          />
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[12px] leading-[1.4] text-ink-muted">
                        {it.label}
                      </div>
                      {it.note && (
                        <div className="mt-1 text-[11px] leading-[1.4] text-ink-faint">
                          {it.note}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
