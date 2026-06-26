import { PrismaClient } from "@prisma/client";

/**
 * The bare client — for migrations, seed, and system tasks ONLY. Request paths
 * must use `dbForOrg(orgId)` so tenant isolation (ISO.1) is enforced by default.
 */
export const prisma = new PrismaClient();

/**
 * Tenant-owned models that carry a real `orgId` column. Children that inherit
 * tenancy via a parent FK (Message/AgentRun/WorkflowRun/File/MatrixColumn/
 * MachineSignal) are deliberately excluded — scope them through their parent.
 * `Module` is global and never scoped.
 */
const TENANT_MODELS = new Set<string>([
  "User",
  "Agent",
  "Chat",
  "Workflow",
  "Project",
  "Machine",
  "Supplier",
  "Part",
  "PurchaseOrder",
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
]);

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
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const a = (args ?? {}) as Record<string, unknown>;
          if (READ_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), orgId };
          } else if (operation === "create") {
            a.data = { ...((a.data as object) ?? {}), orgId };
          } else if (operation === "createMany") {
            const data = a.data as unknown;
            const rows = Array.isArray(data) ? data : [data];
            a.data = rows.map((r) => ({ ...(r as object), orgId }));
          } else if (
            operation === "update" ||
            operation === "delete" ||
            operation === "upsert"
          ) {
            // Unique-target op: `orgId` can't be added to a findUnique-style
            // where. Tag defensively; the house rule above is the real guard.
            a.where = { ...((a.where as object) ?? {}), orgId };
          }
          return query(a);
        },
      },
    },
  });
}

export type OrgScopedDb = ReturnType<typeof dbForOrg>;
