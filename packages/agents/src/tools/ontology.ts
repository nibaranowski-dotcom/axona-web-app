import { z } from "zod";
import type { OrgScopedDb } from "@axona/db";
import type { Tool } from "../runtime/types";

// ONT.1 — the entity-link graph traversal (the cross-module ripple). getBlastRadius
// runs a bidirectional, depth-limited BFS over EntityLink from a seed record,
// resolving every reached node to its REAL record (code · label · status), tagging
// its module, and returning grouped-by-module WITH the relation path that reached
// it. Real records only — nothing invented. Read-only; org-scoping is inherited
// from ctx.db (dbForOrg), so a tenant never sees another org's graph.

export type EntityType =
  | "NCR"
  | "ECO"
  | "PART"
  | "SUPPLIER"
  | "PURCHASE_ORDER"
  | "UNIT"
  | "LOT"
  | "DELIVERY"
  | "WORK_ORDER"
  | "SPC_SAMPLE"
  | "INVOICE"
  // PLM.1a — must stay in sync with Prisma's EntityType enum
  | "PRODUCT_MODEL"
  | "PART_REVISION"
  | "CONFIG_VERSION"
  // PLM.8
  | "TEST_RUN"
  | "FIELD_EVENT";

const ENTITY_TYPES = [
  "NCR",
  "ECO",
  "PART",
  "SUPPLIER",
  "PURCHASE_ORDER",
  "UNIT",
  "LOT",
  "DELIVERY",
  "WORK_ORDER",
  "SPC_SAMPLE",
  "INVOICE",
  "PRODUCT_MODEL",
  "PART_REVISION",
  "CONFIG_VERSION",
  "TEST_RUN",
  "FIELD_EVENT",
] as const;

/** The module each entity type belongs to (drives the grouped answer). */
const MODULE: Record<EntityType, string> = {
  NCR: "Quality",
  SPC_SAMPLE: "Quality",
  ECO: "Engineering",
  PART: "Procurement",
  SUPPLIER: "Procurement",
  PURCHASE_ORDER: "Procurement",
  LOT: "Manufacturing",
  // PLM.2 — units are their OWN group, not a Manufacturing sub-item. Once Unit
  // became the spine (PLM.1a) "which units are affected" is the first question a
  // blast radius answers, so `Blast Radius.dc.html` leads with a Units group.
  UNIT: "Units",
  DELIVERY: "Fulfillment",
  WORK_ORDER: "Field Service",
  INVOICE: "Finance",
  // PLM.1a — the PLM cluster tags to Engineering (the PLM hub).
  PRODUCT_MODEL: "Engineering",
  PART_REVISION: "Engineering",
  CONFIG_VERSION: "Engineering",
  // PLM.8 — test runs are Quality (per-unit verification); field events are Field Service.
  TEST_RUN: "Quality",
  FIELD_EVENT: "Field Service",
};

const MAX_NODES = 200;

export interface BlastNode {
  type: EntityType;
  code: string;
  label: string;
  status: string;
  depth: number;
  path: string; // e.g. "NCR-118 —CAUSED_BY→ SERVO-204 —SUPPLIED_BY→ Tier-1 Actuator Co"
}

export interface BlastRadiusResult {
  found: boolean;
  root: { type: EntityType; code: string; label: string } | null;
  nodeCount: number;
  moduleCount: number;
  groups: { module: string; nodes: BlastNode[] }[];
  message?: string;
}

interface Resolved {
  code: string;
  label: string;
  status: string;
}

// ── resolve a set of ids of one type to their real records ──────────────────
async function resolveByType(
  db: OrgScopedDb,
  type: EntityType,
  ids: string[],
): Promise<Map<string, Resolved>> {
  const out = new Map<string, Resolved>();
  if (ids.length === 0) return out;
  const where = { id: { in: ids } };
  switch (type) {
    case "NCR": {
      for (const r of await db.nCR.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.defect, status: r.status });
      break;
    }
    case "SPC_SAMPLE": {
      for (const r of await db.spcSample.findMany({ where }))
        out.set(r.id, {
          code: r.characteristic,
          // unit-agnostic: the characteristic name carries the metric/unit (e.g.
          // drive_torque_Nm, mispick_rate_pct) — don't hardcode a torque unit.
          label: `${r.value} (UCL ${r.ucl})`,
          status:
            r.value > r.ucl || r.value < r.lcl ? "out of spec" : "in control",
        });
      break;
    }
    case "ECO": {
      for (const r of await db.eCO.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.title, status: r.stage });
      break;
    }
    // PART and LOT are both rows of the Part table — the EntityType distinguishes
    // a general SKU from the quarantined lot; the module tag differs (see MODULE).
    case "PART":
    case "LOT": {
      for (const r of await db.part.findMany({ where }))
        out.set(r.id, {
          code: r.sku,
          label: r.name,
          status:
            type === "LOT"
              ? "quarantined"
              : r.onHand <= r.reorderPoint
                ? "below cover"
                : "in stock",
        });
      break;
    }
    case "SUPPLIER": {
      for (const r of await db.supplier.findMany({ where }))
        out.set(r.id, {
          code: r.name,
          label: r.name,
          status: `tier ${r.tier}`,
        });
      break;
    }
    case "PURCHASE_ORDER": {
      for (const r of await db.purchaseOrder.findMany({ where }))
        out.set(r.id, {
          code: r.code,
          label: `qty ${r.qty} · $${r.value.toLocaleString()}`,
          status: r.status,
        });
      break;
    }
    // PLM.2 — a UNIT node resolves through the Unit SPINE, not the build record.
    // Before PLM.1a a "unit" was split across WorkOrderMfg (build) and Robot
    // (deploy), so the graph pointed at the build row and every consumer had to
    // bridge serial→Unit itself. Unit is now the first-class per-serial identity,
    // so the traversal resolves it directly and callers can link to /units/:serial.
    case "UNIT": {
      for (const r of await db.unit.findMany({
        where,
        include: { productModel: true },
      }))
        out.set(r.id, {
          code: r.serial,
          label: r.productModel.name,
          status: r.status,
        });
      break;
    }
    case "DELIVERY": {
      for (const r of await db.delivery.findMany({ where }))
        out.set(r.id, {
          code: r.code,
          label: r.account,
          status: r.riskState || r.stage,
        });
      break;
    }
    case "WORK_ORDER": {
      for (const r of await db.workOrderField.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.issue, status: r.status });
      break;
    }
    case "INVOICE": {
      for (const r of await db.invoice.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.account, status: r.status });
      break;
    }
    // PLM.8 — the deferred-tier nodes reached via NCR/Unit edges.
    case "TEST_RUN": {
      for (const r of await db.testRun.findMany({ where }))
        out.set(r.id, {
          code: r.code,
          label: r.procedure,
          status: r.outcome,
        });
      break;
    }
    case "FIELD_EVENT": {
      for (const r of await db.fieldEvent.findMany({ where }))
        out.set(r.id, {
          code: `FE-${r.id.slice(-6)}`,
          label: r.summary,
          status: r.kind,
        });
      break;
    }
  }
  return out;
}

// ── resolve a seed record's id from its human code (the traversal entry) ─────
async function resolveSeedId(
  db: OrgScopedDb,
  type: EntityType,
  code: string,
): Promise<string | null> {
  const first = <T extends { id: string }>(r: T | null) => r?.id ?? null;
  switch (type) {
    case "NCR":
      return first(await db.nCR.findFirst({ where: { code } }));
    case "ECO":
      return first(await db.eCO.findFirst({ where: { code } }));
    case "PART":
    case "LOT":
      return first(await db.part.findFirst({ where: { sku: code } }));
    case "SUPPLIER":
      return first(await db.supplier.findFirst({ where: { name: code } }));
    case "PURCHASE_ORDER":
      return first(await db.purchaseOrder.findFirst({ where: { code } }));
    case "UNIT":
      return first(await db.unit.findFirst({ where: { serial: code } }));
    case "DELIVERY":
      return first(await db.delivery.findFirst({ where: { code } }));
    case "WORK_ORDER":
      return first(await db.workOrderField.findFirst({ where: { code } }));
    case "INVOICE":
      return first(await db.invoice.findFirst({ where: { code } }));
    case "SPC_SAMPLE":
      return first(await db.spcSample.findFirst({ where: { serial: code } }));
    case "TEST_RUN":
      return first(await db.testRun.findFirst({ where: { code } }));
    default:
      // PLM.1a types (PRODUCT_MODEL/PART_REVISION/CONFIG_VERSION) are graph
      // members but not yet seeded as blast-radius roots — resolve nothing.
      return null;
  }
}

interface Visited {
  type: EntityType;
  id: string;
  depth: number;
  parent: string | null; // key of the node we reached this from
  relation: string | null;
  forward: boolean; // was the parent the "from" end of the connecting edge?
}

/**
 * Depth-limited bidirectional BFS over EntityLink. `db` is already org-scoped, so
 * every read (edges AND resolved records) is confined to the tenant — a second
 * org's entity returns nothing from this org's graph.
 */
export async function getBlastRadius(
  db: OrgScopedDb,
  opts: { entityType: EntityType; code: string; maxDepth?: number },
): Promise<BlastRadiusResult> {
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 3, 1), 5);
  const rootId = await resolveSeedId(db, opts.entityType, opts.code);
  if (!rootId) {
    return {
      found: false,
      root: null,
      nodeCount: 0,
      moduleCount: 0,
      groups: [],
      message: `No ${opts.entityType} with code "${opts.code}" exists in this org.`,
    };
  }

  const key = (t: EntityType, id: string) => `${t}:${id}`;
  const rootKey = key(opts.entityType, rootId);
  const visited = new Map<string, Visited>();
  visited.set(rootKey, {
    type: opts.entityType,
    id: rootId,
    depth: 0,
    parent: null,
    relation: null,
    forward: true,
  });
  const queue: string[] = [rootKey];

  while (queue.length > 0 && visited.size < MAX_NODES) {
    const cur = visited.get(queue.shift()!)!;
    if (cur.depth >= maxDepth) continue;
    const edges = await db.entityLink.findMany({
      where: {
        OR: [
          { fromType: cur.type, fromId: cur.id },
          { toType: cur.type, toId: cur.id },
        ],
      },
    });
    for (const e of edges) {
      const parentIsFrom = e.fromType === cur.type && e.fromId === cur.id;
      const nType = (parentIsFrom ? e.toType : e.fromType) as EntityType;
      const nId = parentIsFrom ? e.toId : e.fromId;
      const nKey = key(nType, nId);
      if (visited.has(nKey)) continue;
      if (visited.size >= MAX_NODES) break;
      visited.set(nKey, {
        type: nType,
        id: nId,
        depth: cur.depth + 1,
        parent: key(cur.type, cur.id),
        relation: e.relation,
        forward: parentIsFrom,
      });
      queue.push(nKey);
    }
  }

  // Resolve every visited node to its real record, batched per type.
  const idsByType = new Map<EntityType, string[]>();
  for (const v of visited.values()) {
    const arr = idsByType.get(v.type) ?? [];
    arr.push(v.id);
    idsByType.set(v.type, arr);
  }
  const resolved = new Map<string, Resolved>();
  for (const [t, ids] of idsByType) {
    const m = await resolveByType(db, t, ids);
    for (const [id, r] of m) resolved.set(key(t, id), r);
  }

  // Build the relation path (root → node) for each resolved node.
  const pathFor = (k: string): string => {
    const chain: { code: string; relation: string | null; forward: boolean }[] =
      [];
    let curKey: string | null = k;
    while (curKey) {
      const v: Visited = visited.get(curKey)!;
      const r = resolved.get(curKey);
      chain.unshift({
        code: r?.code ?? "?",
        relation: v.relation,
        forward: v.forward,
      });
      curKey = v.parent;
    }
    let s = chain[0]?.code ?? "?";
    for (let i = 1; i < chain.length; i++) {
      const hop = chain[i]!;
      s += hop.forward
        ? ` —${hop.relation}→ ${hop.code}`
        : ` ←${hop.relation}— ${hop.code}`;
    }
    return s;
  };

  // Group by module (excluding the root itself + any unresolved nodes).
  const byModule = new Map<string, BlastNode[]>();
  for (const [k, v] of visited) {
    if (k === rootKey) continue;
    const r = resolved.get(k);
    if (!r) continue; // record was deleted — never invent one
    const mod = MODULE[v.type];
    const arr = byModule.get(mod) ?? [];
    arr.push({
      type: v.type,
      code: r.code,
      label: r.label,
      status: r.status,
      depth: v.depth,
      path: pathFor(k),
    });
    byModule.set(mod, arr);
  }

  const groups = [...byModule.entries()]
    .map(([module, nodes]) => ({
      module,
      nodes: nodes.sort(
        (a, b) => a.depth - b.depth || a.code.localeCompare(b.code),
      ),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));

  const rootResolved = resolved.get(rootKey);
  const nodeCount = groups.reduce((n, g) => n + g.nodes.length, 0);

  return {
    found: true,
    root: {
      type: opts.entityType,
      code: rootResolved?.code ?? opts.code,
      label: rootResolved?.label ?? "",
    },
    nodeCount,
    moduleCount: groups.length,
    groups,
    message:
      nodeCount === 0
        ? `${opts.code} exists but has no linked records in the graph yet.`
        : undefined,
  };
}

// ── the agent read-tool ─────────────────────────────────────────────────────
export const getBlastRadiusTool: Tool<{
  entityType: EntityType;
  code: string;
  maxDepth?: number;
}> = {
  name: "getBlastRadius",
  category: "read",
  description:
    "Trace the cross-module blast radius of an entity (e.g. an NCR): every linked real record — SPC breaches, ECOs, parts, suppliers, POs, affected build units and lots, deliveries, field work orders, invoices — grouped by module, each with the relation PATH that connects it back to the source. Real records only; if nothing is linked it says so.",
  inputSchema: z.object({
    entityType: z.enum(ENTITY_TYPES),
    code: z.string().min(1),
    maxDepth: z.number().int().min(1).max(5).optional(),
  }),
  handler: async (input, ctx) => getBlastRadius(ctx.db, input),
};
