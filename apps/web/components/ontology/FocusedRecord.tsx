import Link from "next/link";
import { X } from "lucide-react";
import type { EntityType } from "@axona/db";
import { ConnectedObjects } from "@/components/ontology/ConnectedObjects";
import type { ConnectedGroup } from "@/lib/connected-objects";

// DEMO.6 #10 — LINK.1 on a MODULE SCREEN.
//
// The graph's detail-route types (UNIT/NCR/ECO/CONFIG_VERSION/TEST_RUN) each own a
// page that can host <ConnectedObjects>. The rest — parts, POs, work orders — live on
// list screens with no per-record route, so a hop to one used to land on a bare list:
// the chain technically resolved, but the human arrived somewhere they still had to
// hunt. That is the dead-end this closes.
//
// `?focus=<code>` on those screens renders this banner ABOVE the list: which record
// you followed, and its 1-hop neighbours as onward links (both directions, straight
// from getEntityLinks). Not a detail page and not a parallel nav — the same LINK.1
// read model the detail views use, hosted where the record actually lives. Dismissing
// it returns to the plain screen.
export function FocusedRecord({
  type,
  code,
  label,
  groups,
  basePath,
}: {
  type: EntityType;
  code: string;
  label: string | null;
  groups: ConnectedGroup[];
  /** the screen's own path, for the dismiss link (e.g. "/field-service"). */
  basePath: string;
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section
      aria-labelledby="focused-record-title"
      className="mb-[18px] rounded-card border border-line bg-panel-2 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-mono-faint">
            Followed here from a connected record
          </div>
          <h2
            id="focused-record-title"
            className="mt-1 font-mono text-[14px] font-semibold text-ink"
          >
            {code}
          </h2>
          {label && (
            <p className="mt-1 max-w-[70ch] text-[12.5px] leading-[1.45] text-ink-muted">
              {label}
            </p>
          )}
        </div>
        <Link
          href={basePath}
          aria-label="Dismiss the focused record"
          className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
          Clear
        </Link>
      </div>

      {total > 0 ? (
        <ConnectedObjects groups={groups} className="mt-3.5 bg-paper" />
      ) : (
        // Never invent a link. An unconnected record says so plainly — that is a
        // real answer about the graph, not a rendering failure.
        <p className="mt-3.5 text-[12px] text-ink-muted">
          {code} has no connected records in the graph yet.
        </p>
      )}
    </section>
  );
}
