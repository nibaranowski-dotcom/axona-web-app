/**
 * PRIV.1a — the ORG DATA EXPORT bundle (portability half of data-subject rights).
 *
 * One org owner/admin action produces every org-scoped entity as one archive. It
 * is built ON IO.2, not beside it: `exportEntity` is still the only thing that
 * turns an entity into `{headers, rows}`, and the three registered import
 * descriptors (unit · partMaster · bomLine) are reused BY REFERENCE — their
 * columns and readRows are not restated here. The additional entities the bundle
 * covers (procurement, quality, change control, tests, configurations, file
 * metadata, audit trail) are export-only, so they declare the export half of the
 * same descriptor shape and nothing more.
 *
 * ISOLATION IS THE POINT (P0). Every source reads through the caller's
 * `OrgScopedDb`, whose extension pins `orgId` on every query — there is no raw
 * `prisma` in this file and no `orgId` parameter to get wrong. `verify:priv-1a`
 * proves the property from the outside: a second org's rows are absent.
 */
import {
  exportEntity,
  unitDescriptor,
  partMasterDescriptor,
  bomLineDescriptor,
} from "./import-core";
import type { ExportRow } from "./import-core";
import type { OrgScopedDb } from "../client";

/**
 * The export half of an entity — exactly the two optional fields
 * `EntityDescriptor` already carries, so a full import descriptor satisfies it
 * structurally and can be handed to the bundle unchanged.
 */
export interface ExportSource {
  entity: string;
  label: string;
  columns: string[];
  readRows(db: OrgScopedDb): Promise<ExportRow[]>;
}

const iso = (d: Date | null | undefined): string => (d ? d.toISOString() : "");
const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const json = (v: unknown): string =>
  v === null || v === undefined ? "" : JSON.stringify(v);

/**
 * Export-only sources. Each is deliberately shallow — the bundle is a portability
 * artifact, not a backup: scalar columns plus the natural keys that let a reader
 * rejoin the pieces (a BOM line's position, a PO's code). Deep object graphs are
 * reconstructable from those keys.
 */
const partSource: ExportSource = {
  entity: "part",
  label: "Parts (procurement SKUs)",
  columns: ["sku", "name", "onHand", "reorderPoint", "leadDays", "dailyUse"],
  async readRows(db) {
    const rows = await db.part.findMany({ orderBy: { sku: "asc" } });
    return rows.map((r) => ({
      key: r.sku,
      cells: [
        r.sku,
        str(r.name),
        str(r.onHand),
        str(r.reorderPoint),
        str(r.leadDays),
        str(r.dailyUse),
      ],
    }));
  },
};

const inventorySource: ExportSource = {
  entity: "inventoryStock",
  label: "Inventory stock",
  columns: [
    "partId",
    "location",
    "kind",
    "onHand",
    "reserved",
    "minLevel",
    "valueUsd",
  ],
  async readRows(db) {
    const rows = await db.inventoryStock.findMany({
      orderBy: [{ partId: "asc" }, { location: "asc" }],
    });
    return rows.map((r) => ({
      key: `${r.partId}:${r.location}`,
      cells: [
        str(r.partId),
        str(r.location),
        str(r.kind),
        str(r.onHand),
        str(r.reserved),
        str(r.minLevel),
        str(r.valueUsd),
      ],
    }));
  },
};

const poSource: ExportSource = {
  entity: "purchaseOrder",
  label: "Purchase orders",
  columns: [
    "code",
    "supplierId",
    "partId",
    "status",
    "qty",
    "value",
    "eta",
    "receivedAt",
    "draftedByAgentId",
  ],
  async readRows(db) {
    const rows = await db.purchaseOrder.findMany({ orderBy: { code: "asc" } });
    return rows.map((r) => ({
      key: r.code,
      cells: [
        r.code,
        str(r.supplierId),
        str(r.partId),
        str(r.status),
        str(r.qty),
        str(r.value),
        iso(r.eta),
        iso(r.receivedAt),
        str(r.draftedByAgentId),
      ],
    }));
  },
};

const ncrSource: ExportSource = {
  entity: "ncr",
  label: "Non-conformance reports",
  columns: [
    "code",
    "defect",
    "severity",
    "status",
    "rootCause",
    "linkedTo",
    "unitId",
  ],
  async readRows(db) {
    const rows = await db.nCR.findMany({ orderBy: { code: "asc" } });
    return rows.map((r) => ({
      key: r.code,
      cells: [
        r.code,
        str(r.defect),
        str(r.severity),
        str(r.status),
        str(r.rootCause),
        str(r.linkedTo),
        str(r.unitId),
      ],
    }));
  },
};

const ecoSource: ExportSource = {
  entity: "eco",
  label: "Change orders (ECOs)",
  columns: [
    "code",
    "title",
    "changeType",
    "changeClass",
    "stage",
    "affected",
    "effectiveFromSerial",
    "effectiveFromDate",
  ],
  async readRows(db) {
    const rows = await db.eCO.findMany({ orderBy: { code: "asc" } });
    return rows.map((r) => ({
      key: r.code,
      cells: [
        r.code,
        str(r.title),
        str(r.changeType),
        str(r.changeClass),
        str(r.stage),
        str(r.affected),
        str(r.effectiveFromSerial),
        iso(r.effectiveFromDate),
      ],
    }));
  },
};

const testRunSource: ExportSource = {
  entity: "testRun",
  label: "Test runs",
  columns: [
    "code",
    "unitId",
    "procedure",
    "outcome",
    "startedAt",
    "operatorId",
  ],
  async readRows(db) {
    const rows = await db.testRun.findMany({ orderBy: { code: "asc" } });
    return rows.map((r) => ({
      key: r.code,
      cells: [
        r.code,
        str(r.unitId),
        str(r.procedure),
        str(r.outcome),
        iso(r.startedAt),
        str(r.operatorId),
      ],
    }));
  },
};

const configSource: ExportSource = {
  entity: "configurationVersion",
  label: "Configurations",
  columns: ["name", "productModelId", "isBaseline", "lockedAt", "swSpec"],
  async readRows(db) {
    const rows = await db.configurationVersion.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({
      key: r.name,
      cells: [
        r.name,
        str(r.productModelId),
        str(r.isBaseline),
        iso(r.lockedAt),
        json(r.swSpec),
      ],
    }));
  },
};

const fileSource: ExportSource = {
  entity: "file",
  label: "File metadata",
  // METADATA ONLY — the bytes live in the blob store and are fetched by key. A
  // portability bundle that inlined every attachment would be a different product.
  columns: [
    "id",
    "name",
    "ext",
    "sizeBytes",
    "type",
    "blobKey",
    "targetType",
    "targetId",
    "projectId",
    "createdAt",
  ],
  async readRows(db) {
    // ISOLATION, EXPLICIT: `File` is deliberately NOT in TENANT_MODELS — a file
    // scopes either by its own orgId (entity/org attachments) or through its
    // project (ATTACH.1), so the client extension pins NOTHING here. An unscoped
    // findMany would put every tenant's files in this bundle. The predicate is
    // the same join getProjectFiles uses.
    const rows = await db.file.findMany({
      where: {
        OR: [{ orgId: db.$org }, { project: { orgId: db.$org } }],
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      key: r.id,
      cells: [
        r.id,
        str(r.name),
        str(r.ext),
        str(r.sizeBytes),
        str(r.type),
        str(r.blobKey),
        str(r.targetType),
        str(r.targetId),
        str(r.projectId),
        iso(r.createdAt),
      ],
    }));
  },
};

const auditSource: ExportSource = {
  entity: "auditLog",
  label: "Audit trail",
  columns: [
    "id",
    "createdAt",
    "actorType",
    "actorLabel",
    "action",
    "targetType",
    "targetId",
    "summary",
  ],
  async readRows(db) {
    const rows = await db.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      key: r.id,
      cells: [
        r.id,
        iso(r.createdAt),
        str(r.actorType),
        str(r.actorLabel),
        str(r.action),
        str(r.targetType),
        str(r.targetId),
        str(r.summary),
      ],
    }));
  },
};

/**
 * The org's entity set. The first three are the IO.2 import descriptors reused
 * as-is — adding an entity to the import registry therefore also widens the
 * export bundle, which is the point of not forking.
 */
export const ORG_EXPORT_SOURCES: ExportSource[] = [
  unitDescriptor as unknown as ExportSource,
  bomLineDescriptor as unknown as ExportSource,
  partMasterDescriptor as unknown as ExportSource,
  partSource,
  inventorySource,
  poSource,
  ncrSource,
  ecoSource,
  testRunSource,
  configSource,
  fileSource,
  auditSource,
];

export interface OrgExportEntity {
  entity: string;
  label: string;
  headers: string[];
  rows: (string | number)[][];
  count: number;
}

export interface OrgExportBundle {
  orgId: string;
  orgName: string;
  generatedAt: string;
  entities: OrgExportEntity[];
  totalRows: number;
}

/**
 * Build the whole bundle. Every entity goes through IO.2's `exportEntity`, so the
 * header/row serialization is the same one the per-entity export already uses.
 * `now` is injectable so verification is deterministic (VERIFY.3).
 */
export async function buildOrgExport(
  db: OrgScopedDb,
  opts: { now?: Date } = {},
): Promise<OrgExportBundle> {
  // EXPLICIT `where`: `Org` is not in TENANT_MODELS either (the extension scopes
  // rows BELONGING to an org, not the org row itself), so an unqualified findFirst
  // returns whichever org the database hands back first — another tenant's NAME in
  // this tenant's bundle. Small leak, same class as the File one.
  const org = await db.org.findFirst({
    where: { id: db.$org },
    select: { id: true, name: true },
  });
  const entities: OrgExportEntity[] = [];
  for (const source of ORG_EXPORT_SOURCES) {
    const { headers, rows } = await exportEntity(db, source);
    entities.push({
      entity: source.entity,
      label: source.label,
      headers,
      rows,
      count: rows.length,
    });
  }
  return {
    orgId: db.$org,
    orgName: org?.name ?? "",
    generatedAt: (opts.now ?? new Date()).toISOString(),
    entities,
    totalRows: entities.reduce((n, e) => n + e.count, 0),
  };
}
