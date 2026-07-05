import { dbForOrg } from "@axona/db";

// AUDIT.2 — the audit-trail READ model. Read-only over the append-only AuditLog
// (AUDIT.1); org-scoped via dbForOrg; newest-first, cursor-paginated. Surfaces the
// AUDIT.3 enrichment (model · confidence · approver) and resolves a deep-link to
// each target's source screen where one is derivable. There is NO write path — the
// log is immutable; this module only reads.

export const LOW_CONFIDENCE = 0.4; // < this = flagged for human review (INK, never red)
const DEFAULT_TAKE = 40;

export interface AuditEntry {
  id: string;
  createdAt: Date;
  actorType: "HUMAN" | "AGENT" | "SYSTEM";
  actorLabel: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  model: string | null;
  confidence: number | null;
  approverLabel: string | null;
  href: string | null; // deep-link to the target's source screen, when derivable
}

export interface AuditTrailPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

export interface AuditRollup {
  total: number;
  agentActions: number;
  humanDecisions: number;
  approvals: number;
  lowConfidence: number;
}

export interface AuditFilterOptions {
  actorTypes: string[];
  actions: string[];
  targetTypes: string[];
}

export interface AuditFilters {
  actor?: string; // actorType
  action?: string;
  targetType?: string;
  cursor?: string;
  take?: number;
}

// Target types that have no dedicated screen → rendered as plain text (flagged).
const UNLINKED_TARGETS = new Set(["ECO", "NCR", "Org", "Verify"]);

function whereFrom(f: AuditFilters) {
  return {
    ...(f.actor ? { actorType: f.actor as "HUMAN" | "AGENT" | "SYSTEM" } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.targetType ? { targetType: f.targetType } : {}),
  };
}

/**
 * Resolve a deep-link per entry: PurchaseOrder → /procurement (the queue);
 * WorkflowRun → /workflows/:workflowId; MatrixColumn/File → /projects/:projectId.
 * Batched so the page costs a few lookups, not one-per-row. Org-scoped.
 */
async function resolveHrefs(
  orgId: string,
  rows: { targetType: string; targetId: string }[],
): Promise<Map<string, string>> {
  const db = dbForOrg(orgId);
  const byType = (t: string) =>
    rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const href = new Map<string, string>();

  const runIds = byType("WorkflowRun");
  if (runIds.length) {
    const runs = await db.workflowRun.findMany({
      where: { id: { in: runIds } },
      select: { id: true, workflowId: true },
    });
    for (const r of runs) href.set(r.id, `/workflows/${r.workflowId}`);
  }
  const colIds = byType("MatrixColumn");
  if (colIds.length) {
    const cols = await db.matrixColumn.findMany({
      where: { id: { in: colIds } },
      select: { id: true, projectId: true },
    });
    for (const c of cols) href.set(c.id, `/projects/${c.projectId}`);
  }
  const fileIds = byType("File");
  if (fileIds.length) {
    const files = await db.file.findMany({
      where: { id: { in: fileIds }, project: { orgId } },
      select: { id: true, projectId: true },
    });
    for (const f of files) href.set(f.id, `/projects/${f.projectId}`);
  }
  return href;
}

export async function getAuditTrail(
  orgId: string,
  filters: AuditFilters = {},
): Promise<AuditTrailPage> {
  const db = dbForOrg(orgId);
  const take = Math.min(Math.max(filters.take ?? DEFAULT_TAKE, 1), 100);
  const rows = await db.auditLog.findMany({
    where: whereFrom(filters),
    orderBy: { createdAt: "desc" },
    take: take + 1, // fetch one extra to compute nextCursor
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      actorLabel: true,
      action: true,
      targetType: true,
      targetId: true,
      summary: true,
      model: true,
      confidence: true,
      approverLabel: true,
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const hrefMap = await resolveHrefs(orgId, page);

  const entries: AuditEntry[] = page.map((r) => ({
    ...r,
    href:
      r.targetType === "PurchaseOrder"
        ? "/procurement"
        : UNLINKED_TARGETS.has(r.targetType)
          ? null
          : (hrefMap.get(r.targetId) ?? null),
  }));
  return { entries, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

export async function getAuditRollup(orgId: string): Promise<AuditRollup> {
  const db = dbForOrg(orgId);
  const [total, agentActions, humanDecisions, approvals, lowConfidence] =
    await Promise.all([
      db.auditLog.count(),
      db.auditLog.count({ where: { actorType: "AGENT" } }),
      db.auditLog.count({ where: { actorType: "HUMAN" } }),
      db.auditLog.count({ where: { approverId: { not: null } } }),
      db.auditLog.count({ where: { confidence: { lt: LOW_CONFIDENCE } } }),
    ]);
  return { total, agentActions, humanDecisions, approvals, lowConfidence };
}

export async function getAuditFilterOptions(
  orgId: string,
): Promise<AuditFilterOptions> {
  const db = dbForOrg(orgId);
  const [actors, actions, targets] = await Promise.all([
    db.auditLog.findMany({
      distinct: ["actorType"],
      select: { actorType: true },
    }),
    db.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    db.auditLog.findMany({
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
    }),
  ]);
  return {
    actorTypes: actors.map((a) => a.actorType),
    actions: actions.map((a) => a.action),
    targetTypes: targets.map((t) => t.targetType),
  };
}
