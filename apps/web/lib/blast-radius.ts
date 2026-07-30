import { dbForOrg, entityRoute } from "@axona/db";
import { getBlastRadius, affectedUnits } from "@axona/agents";
import type { EntityType } from "@axona/db";

// PLM.5 — the blast-radius UI read model. The traversal already ships (ONT.1
// getBlastRadius); this assembles it for the screen: results grouped by module,
// each row carrying the RELATION PATH that reached it.
//
// The load-bearing detail: UNIT rows link to /units/:serial — the Unit page, the
// hero object — never to a build record. Since PLM.2 the ontology's UNIT node IS
// the Unit spine, so `node.code` is the serial and the link is direct rather than
// bridged. Unit rows are additionally hydrated through `affectedUnits` so their
// status/site/customer are the unit's own, and so units the graph misses but the
// AS-BUILT CAPTURE knows about (a lot consumed with no explicit edge) still show
// up — capture fidelity, not just the graph.

// Types + labels live in ./blast-radius-shared (no server imports) so the client
// view can use them without pulling @axona/agents into the browser bundle. They
// are re-exported here so server callers still have one import site.
export type {
  TraceType,
  BlastRow,
  BlastGroup,
  TraceOption,
  BlastRadiusView,
} from "./blast-radius-shared";
export { TRACE_LABEL } from "./blast-radius-shared";

import type {
  TraceType,
  BlastRow,
  TraceOption,
  BlastRadiusView,
} from "./blast-radius-shared";
import { TRACE_LABEL } from "./blast-radius-shared";

/**
 * Where a node of each type links — delegates to the single centralized
 * `entityRoute` map (LINK.1) so the blast-radius drill-in and the
 * <ConnectedObjects> panel share one route resolver. UNIT/NCR/ECO/CONFIG/TEST_RUN
 * now go to their real detail routes; the rest to their module screen.
 */
function hrefFor(type: string, code: string): string {
  return entityRoute(type as EntityType, code);
}

/** Human one-liner per module group (the design's summary column). */
function groupSummary(module: string, n: number): string {
  const s = (one: string, many: string) => (n === 1 ? one : many);
  switch (module) {
    case "Units":
      return s("unit carrying it", "units carrying it");
    case "Quality":
      return s("non-conformance raised", "non-conformances raised");
    case "Engineering":
      return s("change order in flight", "change orders in flight");
    case "Field Service":
      return s("dispatch touched", "dispatches touched");
    case "Procurement":
      return s("supply record touched", "supply records touched");
    case "Fulfillment":
      return s("shipment affected", "shipments affected");
    case "Finance":
      return s("invoice exposed", "invoices exposed");
    case "Manufacturing":
      return s("build record touched", "build records touched");
    default:
      return s("record reached", "records reached");
  }
}

export async function getBlastRadiusView(
  orgId: string,
  type: TraceType,
  value: string | null,
): Promise<BlastRadiusView> {
  const db = dbForOrg(orgId);
  const options = await loadOptions(orgId);

  // Default to the first available root of this type so the screen is never blank.
  const chosen = value ?? options[type][0]?.value ?? null;
  const base: BlastRadiusView = {
    type,
    value: chosen,
    found: false,
    rootLabel: chosen ?? "—",
    rootHint: null,
    groups: [],
    summary: { units: 0, sites: 0, customers: 0 },
    options,
    handoffSerials: [],
  };
  if (!chosen) {
    return {
      ...base,
      message: `No ${TRACE_LABEL[type].toLowerCase()} to trace from yet.`,
    };
  }

  const opt = options[type].find((o) => o.value === chosen);
  base.rootLabel = opt?.label ?? chosen;
  base.rootHint = opt?.hint ?? null;

  // ── 1. graph traversal (lot · ECO · part) ─────────────────────────────────
  const groups = new Map<string, BlastRow[]>();
  let found = false;

  if (type !== "sw") {
    const entityType = type === "lot" ? "LOT" : type === "eco" ? "ECO" : "PART";
    // A lot lives in the Part table as "LOT-<code>"; a part as its SKU.
    const code = type === "lot" ? `LOT-${chosen}` : chosen;
    const blast = await getBlastRadius(db, {
      entityType,
      code,
      maxDepth: 4,
    });
    found = blast.found;
    for (const g of blast.groups) {
      const rows = g.nodes.map((n) => ({
        code: n.code,
        label: n.label,
        status: n.status,
        path: n.path,
        href: hrefFor(n.type, n.code),
        isUnit: n.type === "UNIT",
      }));
      groups.set(g.module, [...(groups.get(g.module) ?? []), ...rows]);
    }
  }

  // ── 2. capture-backed units (never rely on the graph alone) ───────────────
  // affectedUnits reads the as-built records / software states directly, so a
  // unit that consumed the lot but has no explicit edge still surfaces.
  const affected = await affectedUnits(db, {
    lot: type === "lot" ? chosen : undefined,
    ecoId: type === "eco" ? chosen : undefined,
    softwareReleaseId: type === "sw" ? chosen : undefined,
    partRevisionId: undefined,
  });

  const unitRows = groups.get("Units") ?? [];
  const bySerial = new Map(unitRows.map((r) => [r.code, r]));
  for (const u of affected.units) {
    found = true;
    const existing = bySerial.get(u.serial);
    const path =
      existing?.path ?? u.path ?? `${base.rootLabel} → as-built → ${u.serial}`;
    bySerial.set(u.serial, {
      code: u.serial,
      label:
        [u.customerLabel, u.siteLabel].filter(Boolean).join(" · ") || u.status,
      status: u.status,
      path,
      href: `/units/${encodeURIComponent(u.serial)}`,
      isUnit: true,
    });
  }
  if (bySerial.size > 0) {
    groups.set(
      "Units",
      [...bySerial.values()].sort((a, b) => a.code.localeCompare(b.code)),
    );
  }

  // ── 3. impact summary from the REAL units, not the node count ─────────────
  const serials = [...bySerial.keys()];
  const units = serials.length
    ? await db.unit.findMany({ where: { serial: { in: serials } } })
    : [];
  const sites = new Set(units.map((u) => u.siteLabel).filter(Boolean));
  const customers = new Set(units.map((u) => u.customerLabel).filter(Boolean));
  // A hand-off only makes sense for units actually in the field.
  const handoffSerials = units
    .filter((u) => u.status === "deployed" || u.status === "active")
    .map((u) => u.serial)
    .sort();

  // Units lead — "which units are affected" is the first question this answers.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "Units" ? -1 : b === "Units" ? 1 : a.localeCompare(b),
  );

  return {
    ...base,
    found,
    groups: ordered.map(([module, rows]) => ({
      module,
      count: rows.length,
      summary: groupSummary(module, rows.length),
      rows,
    })),
    summary: {
      units: serials.length,
      sites: sites.size,
      customers: customers.size,
    },
    handoffSerials,
    message: found
      ? undefined
      : `Nothing in this workspace traces from ${base.rootLabel}.`,
  };
}

/** The selectable roots — real records only, never invented. */
async function loadOptions(
  orgId: string,
): Promise<Record<TraceType, TraceOption[]>> {
  const db = dbForOrg(orgId);
  const [lotRecords, releases, ecos, parts] = await Promise.all([
    db.asBuiltRecord.findMany({
      where: { lotCode: { not: null } },
      select: { lotCode: true, partRevision: { select: { partMaster: true } } },
    }),
    db.softwareRelease.findMany({ orderBy: { version: "asc" } }),
    db.eCO.findMany({ orderBy: { code: "asc" } }),
    db.partMaster.findMany({ orderBy: { partNumber: "asc" } }),
  ]);

  // Only lots that the graph can actually root from (a LOT-<code> Part exists)
  // OR that as-built capture knows — both are real; nothing invented.
  const lotByCode = new Map<string, string>();
  for (const r of lotRecords) {
    if (r.lotCode && !lotByCode.has(r.lotCode))
      lotByCode.set(r.lotCode, r.partRevision.partMaster.partNumber);
  }

  return {
    lot: [...lotByCode.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, part]) => ({
        value: code,
        label: `lot ${code}`,
        hint: part,
      })),
    sw: releases.map((r) => ({
      value: r.id,
      label: r.version,
      hint: r.component,
    })),
    eco: ecos.map((e) => ({ value: e.code, label: e.code, hint: e.title })),
    part: parts.map((p) => ({
      value: p.partNumber,
      label: p.partNumber,
      hint: p.description,
    })),
  };
}
