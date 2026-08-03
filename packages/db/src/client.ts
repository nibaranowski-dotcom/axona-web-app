import { PrismaClient, Prisma } from "@prisma/client";

/**
 * The bare client — for migrations, seed, and system tasks ONLY. Request paths
 * must use `dbForOrg(orgId)` so tenant isolation (ISO.1) is enforced by default.
 *
 * Dev singleton: Next hot-reload (and repeated tsx runs) re-evaluate this module,
 * each time spawning a fresh PrismaClient + connection pool — which exhausts
 * Postgres ("too many clients already"). Pin ONE client on globalThis in dev so
 * every reload reuses it. In production the module is evaluated once, so we skip
 * the global.
 */
const g = globalThis as unknown as { __axonaPrisma?: PrismaClient };
export const prisma = g.__axonaPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__axonaPrisma = prisma;

/**
 * Tenant-owned models that carry a real `orgId` column. Children that inherit
 * tenancy via a parent FK (Message/AgentRun/MatrixColumn/MachineSignal) are
 * deliberately excluded — scope them through their parent. `Module` is global and
 * never scoped. `WorkflowRun` gained a scalar `orgId` in WF.1 (the engine sets it
 * on create) → it is scoped directly here.
 *
 * ISO.1 — this set is now COVERAGE-GUARDED: `tenantCoverageGaps()` below reads the
 * Prisma DMMF and reports any model with an `orgId` column that is missing here.
 * `verify:iso-1` fails on a non-empty result, so an org-scoped model cannot be
 * added to the schema without being scoped. PRIV.1a found `File` the hard way —
 * an unqualified `findMany` on it read every tenant's rows — and the same audit
 * turned up four more (NotificationPref · SsoConfig · Invite · SearchDoc).
 */
const TENANT_MODELS = new Set<string>([
  "User",
  "LoginSession",
  "Subscription",
  "InvoiceSaaS",
  "Notification",
  "Integration",
  "ApiKey",
  "AuditLog",
  "Agent",
  "Chat",
  "Workflow",
  "WorkflowRun",
  "Project",
  "Machine",
  "Supplier",
  "Part",
  "PurchaseOrder",
  "InventoryStock",
  "WorkOrderMfg",
  "NCR",
  "SpcSample",
  "Cert",
  "Deal",
  "Campaign",
  "Delivery",
  "Robot",
  "TelemetryPoint",
  "WorkOrderField",
  "Technician",
  "ECO",
  "FirmwareRelease",
  "CompatCell",
  "AutonomyMetric",
  "SafetyIncident",
  "PolicyVersion",
  "LedgerEntry",
  "Invoice",
  "UnitEconomic",
  "Requisition",
  "CVE",
  "Obligation",
  "ExportLicense",
  "LegalMatter",
  "EntityLink", // ONT.1 — the entity-link graph is tenant-scoped like every edge/record
  "MemoryItem", // MEM.1 — per-tenant isolation of operational memory is a moat invariant
  "CalibrationModel", // CONF.1 — per-tenant isolation of fitted models is a moat invariant
  // PLM.1a — the Unit spine + configuration cluster (per-tenant isolation is a moat invariant)
  "ProductModel",
  "PartMaster",
  "PartRevision",
  "BomLine",
  "Unit",
  "AsBuiltRecord",
  "SoftwareRelease",
  "UnitSoftwareState",
  "ConfigurationVersion",
  // PLM.1b — the deferred tier (test traceability · field events · change requests)
  "TestRun",
  "TestResult",
  "FieldEvent",
  "ChangeRequest",
  // PLM.12 — the ECO review roster (per-reviewer approval; awaiting-me is org-scoped).
  "EcoReviewer",
  // ISO.1 — the gap PRIV.1a surfaced. All five carry an `orgId` and were being
  // read UNSCOPED. `File` and `SearchDoc` hold it nullably (a file scopes by its
  // own orgId OR through its project — see SCOPE_RULES), the other three require it.
  "File",
  "SearchDoc",
  "NotificationPref",
  "SsoConfig",
  "Invite",
  // ISO.1 — the org row ITSELF. Its tenant key is `id`, not `orgId`, so it needs a
  // rule below; without it `db.org.findFirst()` returned an arbitrary tenant's org
  // (PRIV.1a stamped another tenant's NAME on an export bundle).
  "Org",
]);

/**
 * ISO.1 — how a model pins to one tenant, for the models where `{ orgId }` is not
 * the answer. Everything absent here uses the default `{ orgId }`.
 *
 * `where` is applied to READ ops only. Unique-target ops (`findUnique`/`update`/
 * `delete`/`upsert`) take a unique `where`, and neither an `OR` nor a foreign key
 * is legal there — the house rule below (scope mutations via `updateMany`/
 * `deleteMany`, or do an explicit ownership check) is what covers those.
 */
interface ScopeRule {
  /** the READ predicate that pins a row to one tenant. */
  where(orgId: string): Record<string, unknown>;
  /** whether `create`/`createMany` inject `{ orgId }`. */
  injectOnCreate: boolean;
  /** whether unique-target ops get the defensive `orgId` tag. */
  tagUniqueOps: boolean;
}

const DEFAULT_RULE: ScopeRule = {
  where: (orgId) => ({ orgId }),
  injectOnCreate: true,
  tagUniqueOps: true,
};

const SCOPE_RULES: Record<string, ScopeRule> = {
  // A file belongs to the org directly (entity/org attachments, ATTACH.1) OR
  // through its project (the original FILE.1 uploads). This is the predicate
  // `getProjectFiles` has always used, lifted here so EVERY read gets it.
  File: {
    where: (orgId) => ({ OR: [{ orgId }, { project: { orgId } }] }),
    // A file's tenancy is set by the caller (orgId for entity/org attachments,
    // projectId for project files). Injecting `orgId` here would quietly change
    // ATTACH.1's shape for project uploads.
    injectOnCreate: false,
    tagUniqueOps: false,
  },
  // The org row's tenant key is its own id.
  Org: {
    where: (orgId) => ({ id: orgId }),
    // Creating an org has no enclosing tenant — provisioning uses the bare client.
    injectOnCreate: false,
    tagUniqueOps: false,
  },
  // These three are read/written through unique compound keys (userId, domain,
  // token), so tagging a unique `where` with `orgId` would make Prisma reject the
  // call. Reads are scoped; their mutations already pass explicit ids.
  NotificationPref: { ...DEFAULT_RULE, tagUniqueOps: false },
  SsoConfig: { ...DEFAULT_RULE, tagUniqueOps: false },
  Invite: { ...DEFAULT_RULE, tagUniqueOps: false },
  // The search index is written by the system path on the bare client; scoping
  // its reads is the isolation win, and its `orgId` is nullable.
  SearchDoc: { ...DEFAULT_RULE, tagUniqueOps: false },
};

/** Operations whose `where` we tag with `orgId` (non-unique-target). */
const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

/**
 * Returns a Prisma client whose every tenant-model operation is pinned to one
 * org. This is the ISO.1 enforcement surface — prefer it over the bare `prisma`
 * for any request path.
 *
 * NOTE on unique-target ops (`findUnique`/`update`/`delete`/`upsert`): Prisma
 * rejects non-unique fields in a unique `where`, so we cannot inject `orgId`
 * there. House rule: scope tenant mutations through `updateMany`/`deleteMany`,
 * or do an explicit `findFirst({ where: { id, orgId } })` ownership check first.
 */
export function dbForOrg(orgId: string) {
  if (!orgId) throw new Error("dbForOrg requires a non-empty orgId");
  const client = prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const a = (args ?? {}) as Record<string, unknown>;
          const rule = SCOPE_RULES[model] ?? DEFAULT_RULE;
          if (READ_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), ...rule.where(orgId) };
          } else if (operation === "create") {
            if (rule.injectOnCreate)
              a.data = { ...((a.data as object) ?? {}), orgId };
          } else if (operation === "createMany") {
            if (rule.injectOnCreate) {
              const data = a.data as unknown;
              const rows = Array.isArray(data) ? data : [data];
              a.data = rows.map((r) => ({ ...(r as object), orgId }));
            }
          } else if (
            operation === "update" ||
            operation === "delete" ||
            operation === "upsert"
          ) {
            // Unique-target op: `orgId` can't be added to a findUnique-style
            // where. Tag defensively; the house rule above is the real guard.
            if (rule.tagUniqueOps)
              a.where = { ...((a.where as object) ?? {}), orgId };
          }
          return query(a);
        },
      },
    },
  });
  // Stash the tenant id on the scoped client. Prisma model ops are auto-scoped by
  // the extension above, but RAW SQL ($queryRaw/$executeRaw — e.g. the pgvector
  // cosine query in recallMemory) bypasses it, so those paths must org-filter
  // explicitly. `$org` lets a `db`-first helper (recallMemory/ingestMemory) recover
  // the tenant without changing its signature. Non-enumerable so it never leaks
  // into spreads/logs.
  Object.defineProperty(client, "$org", {
    value: orgId,
    enumerable: false,
    writable: false,
  });
  return client as typeof client & { readonly $org: string };
}

export type OrgScopedDb = ReturnType<typeof dbForOrg>;

/**
 * ISO.1 — the coverage guard. Every Prisma model carrying an `orgId` column must
 * be tenant-scoped; anything else is a model whose unqualified reads cross
 * tenants. Returns the offenders (empty = covered), so a verify can fail on it
 * rather than the gap being discovered by an export bundle again.
 *
 * Models with NO `orgId` are out of scope by construction — they either inherit
 * tenancy through a parent FK (Message → Chat, AgentRun → Agent, MatrixColumn →
 * Project, MachineSignal → Machine) or are genuinely global (Module, Lead, the
 * auth tokens). `Org` is the one exception in the other direction: it has no
 * `orgId` yet IS tenant-scoped, by `id`.
 */
export function tenantCoverageGaps(): string[] {
  const models = Prisma.dmmf.datamodel.models;
  return models
    .filter((m) => m.fields.some((f) => f.name === "orgId"))
    .map((m) => m.name)
    .filter((name) => !TENANT_MODELS.has(name))
    .sort();
}

/**
 * ISO.1 — what the guard can SEE. A coverage guard that reads an empty model list
 * would pass vacuously forever, so the verify asserts these numbers are sane
 * before trusting `tenantCoverageGaps()`.
 */
export function tenantModelCensus(): {
  models: number;
  withOrgId: number;
  scoped: number;
} {
  const models = Prisma.dmmf.datamodel.models;
  return {
    models: models.length,
    withOrgId: models.filter((m) => m.fields.some((f) => f.name === "orgId"))
      .length,
    scoped: TENANT_MODELS.size,
  };
}

/** ISO.1 — the scoped model set + rule names, for the coverage guard's report. */
export function tenantScopingSummary(): {
  scoped: string[];
  ruled: string[];
} {
  return {
    scoped: [...TENANT_MODELS].sort(),
    ruled: Object.keys(SCOPE_RULES).sort(),
  };
}
