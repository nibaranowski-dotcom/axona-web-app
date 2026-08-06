import type { EntityType, LinkRelation } from "@prisma/client";
import type { OrgScopedDb } from "../client";

// LINK.1 — the ONE 1-hop neighbor fetch over the ONT.1 EntityLink graph. This is
// the primitive the whole platform's graph traversal is built on:
//   • getBlastRadius (ONT.1, @axona/agents) BFS's OVER getEntityLinks (N-hop impact)
//   • recallMemory's neighborhood BFS (MEM.1) walks getEntityLinks (graph proximity)
//   • the <ConnectedObjects> panel (LINK.1) renders getEntityLinks directly (1-hop nav)
// One edge query, one traversal — no parallel graph. Kept in @axona/db so recall
// (also @axona/db) shares it without importing @axona/agents (a dependency cycle),
// and so the resolver + route map live in one place. Org-scoped through `db`
// (dbForOrg): every read is confined to the tenant.

export type LinkDirection = "out" | "in";

export interface EntityLinkNeighbor {
  type: EntityType;
  id: string;
  relation: LinkRelation;
  /** "out" = this record is the edge's `from` end; "in" = it is the `to` end. */
  direction: LinkDirection;
  /** the human-readable "why" carried on the edge (EntityLink.note). */
  note: string | null;
  // ── resolved (present when `resolve !== false` AND the record still exists) ──
  code?: string;
  label?: string;
  /** the neighbor's detail route, or null when it has no dedicated detail view. */
  route?: string | null;
}

/**
 * Fetch the DIRECT (1-hop) neighbors of a record over EntityLink, both directions.
 * Returns one neighbor per edge, in edge order (so a BFS over this is identical to
 * the inline edge loop it replaces). With `resolve` (default true) each neighbor is
 * resolved to its real record's code/label/route for display; pass `resolve:false`
 * for the raw traversal (getBlastRadius / recall only need type·id·relation·direction).
 */
export async function getEntityLinks(
  db: OrgScopedDb,
  opts: { type: EntityType; id: string; resolve?: boolean },
): Promise<EntityLinkNeighbor[]> {
  const { type, id } = opts;
  const resolve = opts.resolve ?? true;

  const edges = await db.entityLink.findMany({
    where: {
      OR: [
        { fromType: type, fromId: id },
        { toType: type, toId: id },
      ],
    },
  });

  const neighbors: EntityLinkNeighbor[] = edges.map((e) => {
    const fromIsNode = e.fromType === type && e.fromId === id;
    return {
      type: fromIsNode ? e.toType : e.fromType,
      id: fromIsNode ? e.toId : e.fromId,
      relation: e.relation,
      direction: fromIsNode ? "out" : "in",
      note: e.note,
    };
  });

  if (resolve) await resolveNeighbors(db, neighbors);
  return neighbors;
}

// ── the canonical per-type natural-key/label resolver (ONT.1 "natural keys per
// type") + the entity-type → detail-route map. One place; the panel and any
// drill-in use it. Batched per type. Real records only — a deleted record leaves
// its neighbor without a code/route (never invented). ────────────────────────────
async function resolveNeighbors(
  db: OrgScopedDb,
  neighbors: EntityLinkNeighbor[],
): Promise<void> {
  const idsByType = new Map<EntityType, string[]>();
  for (const n of neighbors) {
    const arr = idsByType.get(n.type) ?? [];
    arr.push(n.id);
    idsByType.set(n.type, arr);
  }
  const refs = new Map<string, { code: string; label: string }>();
  for (const [type, ids] of idsByType) {
    const m = await resolveRefsByType(db, type, ids);
    for (const [rid, r] of m) refs.set(`${type}:${rid}`, r);
  }
  for (const n of neighbors) {
    const r = refs.get(`${n.type}:${n.id}`);
    if (r) {
      n.code = r.code;
      n.label = r.label;
      n.route = entityRoute(n.type, r.code);
    } else {
      n.route = null;
    }
  }
}

interface Ref {
  code: string;
  label: string;
}

async function resolveRefsByType(
  db: OrgScopedDb,
  type: EntityType,
  ids: string[],
): Promise<Map<string, Ref>> {
  const out = new Map<string, Ref>();
  if (ids.length === 0) return out;
  const where = { id: { in: ids } };
  switch (type) {
    case "NCR":
      for (const r of await db.nCR.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.defect });
      break;
    case "ECO":
      for (const r of await db.eCO.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.title });
      break;
    // PART and LOT are both rows of the Part table (the EntityType distinguishes
    // a general SKU from a quarantined lot).
    case "PART":
    case "LOT":
      for (const r of await db.part.findMany({ where }))
        out.set(r.id, { code: r.sku, label: r.name });
      break;
    case "SUPPLIER":
      for (const r of await db.supplier.findMany({ where }))
        out.set(r.id, { code: r.name, label: r.name });
      break;
    case "PURCHASE_ORDER":
      for (const r of await db.purchaseOrder.findMany({ where }))
        out.set(r.id, {
          code: r.code,
          label: `qty ${r.qty} · $${r.value.toLocaleString()}`,
        });
      break;
    // UNIT resolves through the Unit SPINE (PLM.1a) — the first-class per-serial
    // identity the graph is keyed on.
    case "UNIT":
      for (const r of await db.unit.findMany({
        where,
        include: { productModel: true },
      }))
        out.set(r.id, { code: r.serial, label: r.productModel.name });
      break;
    case "DELIVERY":
      for (const r of await db.delivery.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.account });
      break;
    case "WORK_ORDER":
      for (const r of await db.workOrderField.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.issue });
      break;
    case "INVOICE":
      for (const r of await db.invoice.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.account });
      break;
    case "SPC_SAMPLE":
      for (const r of await db.spcSample.findMany({ where }))
        out.set(r.id, {
          code: r.characteristic,
          label: `${r.value} (UCL ${r.ucl})`,
        });
      break;
    case "TEST_RUN":
      for (const r of await db.testRun.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.procedure });
      break;
    case "FIELD_EVENT":
      for (const r of await db.fieldEvent.findMany({ where }))
        out.set(r.id, { code: `FE-${r.id.slice(-6)}`, label: r.summary });
      break;
    case "PRODUCT_MODEL":
      for (const r of await db.productModel.findMany({ where }))
        out.set(r.id, { code: r.code, label: r.name });
      break;
    case "PART_REVISION":
      for (const r of await db.partRevision.findMany({
        where,
        include: { partMaster: true },
      }))
        out.set(r.id, {
          code: `${r.partMaster.partNumber} ${r.rev}`,
          label: r.partMaster.description,
        });
      break;
    case "CONFIG_VERSION":
      for (const r of await db.configurationVersion.findMany({ where }))
        out.set(r.id, { code: r.name, label: r.name });
      break;
  }
  return out;
}

/**
 * The single entity-type → route map (the ONE the app links a record through).
 * The rich PLM/spine types resolve to their real DETAIL route; the rest resolve
 * to their module screen so every neighbor is still one click away ("where used").
 * `hrefFor` in the blast-radius read model delegates here — one resolver, not a
 * fork. Always non-null for a known type (a deleted record is dropped upstream).
 */
export function entityRoute(type: EntityType, code: string): string {
  const c = encodeURIComponent(code);
  switch (type) {
    // detail routes (these views exist and own the record).
    case "UNIT":
      return `/units/${c}`;
    case "NCR":
      return `/rca/${c}`;
    case "ECO":
      return `/changes/${c}`;
    case "CONFIG_VERSION":
      return `/configurations/${c}`;
    case "TEST_RUN":
      return `/tests/${c}`;
    // Module screens (no per-record detail route). DEMO.6 #10: the three screens on
    // the fault-to-part-order loop carry `?focus=<code>`, which those screens read to
    // open the record's connected-objects panel. Landing on a bare list was a soft
    // DEAD END — the chain "resolved" while the human arrived somewhere they still had
    // to hunt. Still ONE resolver: the focus param is part of this map, not a fork.
    // Screens without focus support keep their bare route until they grow one.
    // LINK.2 — the last four module screens now honour ?focus= too, so EVERY hop
    // lands on its record instead of a bare list. See the LINK.1 note above.
    case "SPC_SAMPLE":
      return `/quality?focus=${c}`;
    case "PART":
    case "LOT":
      return `/inventory?focus=${c}`;
    case "SUPPLIER":
    case "PURCHASE_ORDER":
      return `/procurement?focus=${c}`;
    case "DELIVERY":
      return `/fulfillment?focus=${c}`;
    case "WORK_ORDER":
    case "FIELD_EVENT":
      return `/field-service?focus=${c}`;
    case "INVOICE":
      return `/finance?focus=${c}`;
    case "PRODUCT_MODEL":
    case "PART_REVISION":
      return `/engineering?focus=${c}`;
  }
}

/** Human-readable relation label for the panel (e.g. CAUSED_BY → "caused by"). */
export function relationLabel(relation: LinkRelation): string {
  return relation.toLowerCase().replace(/_/g, " ");
}

/**
 * Resolve a record's HUMAN CODE (serial · code · name) to the canonical id the
 * EntityLink graph is keyed on — the traversal entry point. The single code→id
 * resolver: recall's `resolveSubjectId` (MEM.1a) delegates here, so there is one
 * natural-key map, not a fork. Returns null when no record matches (caller decides
 * the fallback). Mirrors ONT.1's per-type natural keys; UNIT resolves through the
 * Unit spine (PLM.1a).
 */
export async function resolveEntityId(
  db: OrgScopedDb,
  type: EntityType,
  code: string,
): Promise<string | null> {
  const pick = <T extends { id: string }>(r: T | null): string | null =>
    r?.id ?? null;
  const sel = { select: { id: true } };
  switch (type) {
    case "NCR":
      return pick(await db.nCR.findFirst({ where: { code }, ...sel }));
    case "ECO":
      return pick(await db.eCO.findFirst({ where: { code }, ...sel }));
    case "PART":
    case "LOT": {
      const exact = await db.part.findFirst({ where: { sku: code }, ...sel });
      if (exact) return exact.id;
      // DEMO.7 §3 — people say "lot 88471", not "LOT-88471". The blast-radius
      // question in every run-of-show is phrased with the bare number, and an exact
      // sku match answered "no record exists" about a lot that was right there.
      // Try the prefixed form for a bare numeric; general, not a special case.
      if (/^\d+$/.test(code)) {
        const prefixed = await db.part.findFirst({
          where: { sku: `LOT-${code}` },
          ...sel,
        });
        if (prefixed) return prefixed.id;
      }
      return null;
    }
    case "SUPPLIER":
      return pick(
        await db.supplier.findFirst({ where: { name: code }, ...sel }),
      );
    case "PURCHASE_ORDER":
      return pick(
        await db.purchaseOrder.findFirst({ where: { code }, ...sel }),
      );
    case "UNIT":
      return pick(await db.unit.findFirst({ where: { serial: code }, ...sel }));
    case "DELIVERY":
      return pick(await db.delivery.findFirst({ where: { code }, ...sel }));
    case "WORK_ORDER":
      return pick(
        await db.workOrderField.findFirst({ where: { code }, ...sel }),
      );
    case "INVOICE":
      return pick(await db.invoice.findFirst({ where: { code }, ...sel }));
    case "SPC_SAMPLE":
      return pick(
        await db.spcSample.findFirst({ where: { serial: code }, ...sel }),
      );
    case "TEST_RUN":
      return pick(await db.testRun.findFirst({ where: { code }, ...sel }));
    case "CONFIG_VERSION":
      return pick(
        await db.configurationVersion.findFirst({
          where: { name: code },
          ...sel,
        }),
      );
    case "PRODUCT_MODEL":
      return pick(await db.productModel.findFirst({ where: { code }, ...sel }));
    case "PART_REVISION": {
      // LINK.2 — a part revision's human code is "<partNumber> <rev>" (the form
      // resolveRefsByType emits). It used to resolve to nothing, so a hop to one
      // could never land focused — the one remaining hop that was a dead end BY
      // CONSTRUCTION rather than by a missing screen.
      const m = /^(\S+)\s+(\S+)$/.exec(code);
      if (!m) return null;
      const master = await db.partMaster.findFirst({
        where: { partNumber: m[1] },
        select: { id: true },
      });
      if (!master) return null;
      return pick(
        await db.partRevision.findFirst({
          where: { partMasterId: master.id, rev: m[2] },
          ...sel,
        }),
      );
    }
    case "FIELD_EVENT":
      // not addressed by a single human code — resolved only as reached neighbors.
      return null;
  }
}
