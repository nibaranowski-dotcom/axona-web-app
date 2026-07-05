import {
  dbForOrg,
  writeAudit,
  type OrgScopedDb,
  type Role,
  type POStatus,
} from "@axona/db";
import { resumeParkedRun } from "@axona/agents";
import { requireRole } from "./rbac";

// RBAC.4 — the reusable approval primitive. "AI proposes; a human approves
// money/safety/contract." One registry of gated action kinds; one `decide()` that
// role-gates FIRST, loads org-scoped, asserts the target is pending, runs the
// effect, and writes an AUDIT.1 entry (actor = the human approver). There is NO
// auto path — a human with the right role must click. Idempotent: a non-pending
// target returns "already decided", never a double-execute.
// /// TRUST.1 + /// CONF.1: confidence-gated / progressive-trust auto-approval is a
// later story — this primitive stays strictly human-in-the-loop.

export type ApprovalKind =
  | "po.approve"
  | "eco.release"
  | "policy.rollback"
  | "creditnote.issue"
  | "workflow.gate";

export type Decision = "APPROVE" | "REJECT";

// The approver — the getCurrentUser() shape (structurally a Prisma User).
export type DecideUser = {
  id: string;
  role: Role;
  email: string;
  name: string | null;
  orgId: string;
} | null;

type Approver = { id: string; label: string };
type Effect = { output: Record<string, unknown>; summary: string };

interface ApprovalDef<T> {
  kind: ApprovalKind;
  roles: Role[]; // who may decide
  targetType: string; // AuditLog target type
  load(db: OrgScopedDb, orgId: string, id: string): Promise<T | null>;
  isPending(t: T): boolean; // must be an approvable/pending state
  onApprove(
    db: OrgScopedDb,
    orgId: string,
    t: T,
    by: Approver,
  ): Promise<Effect>;
  onReject(db: OrgScopedDb, orgId: string, t: T, by: Approver): Promise<Effect>;
}

export type DecideResult =
  | { ok: true; decision: Decision; status: string; summary: string }
  | { ok: false; reason: "not_found" | "already_decided"; message: string };

// PO advance chain (forward transitions). REJECTED is the terminal reject state.
const PO_NEXT: Partial<Record<POStatus, POStatus>> = {
  DRAFTED: "AWAITING_APPROVAL",
  AWAITING_APPROVAL: "APPROVED",
  APPROVED: "SENT",
};

// ── the registry ──────────────────────────────────────────────────────────
const REGISTRY: { [K in ApprovalKind]: ApprovalDef<unknown> } = {
  // Purchase order — the wedge's gated action. Advance one legal step per approve;
  // reject → REJECTED (terminal). OPS/ADMIN only; the agent never sends.
  "po.approve": {
    kind: "po.approve",
    roles: ["OPS", "ADMIN"],
    targetType: "PurchaseOrder",
    load: (db, _org, id) => db.purchaseOrder.findFirst({ where: { id } }),
    isPending: (po) =>
      PO_NEXT[(po as { status: POStatus }).status] !== undefined,
    onApprove: async (db, _org, t) => {
      const po = t as { id: string; code: string; status: POStatus };
      const to = PO_NEXT[po.status]!;
      await db.purchaseOrder.updateMany({
        where: { id: po.id },
        data: { status: to },
      });
      return {
        output: { from: po.status, status: to },
        summary: `PO ${po.code} ${po.status} → ${to}`,
      };
    },
    onReject: async (db, _org, t) => {
      const po = t as { id: string; code: string; status: POStatus };
      await db.purchaseOrder.updateMany({
        where: { id: po.id },
        data: { status: "REJECTED" },
      });
      return {
        output: { from: po.status, status: "REJECTED" },
        summary: `PO ${po.code} rejected (was ${po.status})`,
      };
    },
  } as ApprovalDef<unknown>,

  // Workflow guardrail gate — resume the parked WF.1 run (WF.1 executor, not forked).
  "workflow.gate": {
    kind: "workflow.gate",
    roles: ["OPS", "ADMIN", "ENGINEER"],
    targetType: "WorkflowRun",
    load: (db, _org, id) => db.workflowRun.findFirst({ where: { id } }),
    isPending: (r) => (r as { status: string }).status === "AWAITING_APPROVAL",
    onApprove: async (_db, org, t, by) => {
      const run = t as { id: string };
      const status = await resumeParkedRun(run.id, org, "APPROVE", by.label);
      return {
        output: { status },
        summary: `workflow run resumed → ${status} (approved by ${by.label})`,
      };
    },
    onReject: async (_db, org, t, by) => {
      const run = t as { id: string };
      const status = await resumeParkedRun(run.id, org, "REJECT", by.label);
      return {
        output: { status },
        summary: `workflow run rejected → ${status} (by ${by.label})`,
      };
    },
  } as ApprovalDef<unknown>,

  // Engineering change order release — registered; UI is a fan-out follow-up.
  "eco.release": {
    kind: "eco.release",
    roles: ["ENGINEER", "ADMIN"],
    targetType: "ECO",
    load: (db, _org, id) => db.eCO.findFirst({ where: { id } }),
    isPending: (e) => (e as { stage: string }).stage !== "RELEASED",
    onApprove: async (db, _org, t) => {
      const eco = t as { id: string; code: string; stage: string };
      await db.eCO.updateMany({
        where: { id: eco.id },
        data: { stage: "RELEASED" },
      });
      return {
        output: { from: eco.stage, status: "RELEASED" },
        summary: `ECO ${eco.code} released`,
      };
    },
    onReject: async (db, _org, t) => {
      const eco = t as { id: string; code: string; stage: string };
      await db.eCO.updateMany({
        where: { id: eco.id },
        data: { stage: "DRAFT" },
      });
      return {
        output: { from: eco.stage, status: "DRAFT" },
        summary: `ECO ${eco.code} release rejected`,
      };
    },
  } as ApprovalDef<unknown>,

  // Autonomy policy rollback — registered; UI later.
  "policy.rollback": {
    kind: "policy.rollback",
    roles: ["TECH", "ADMIN"],
    targetType: "PolicyVersion",
    load: (db, _org, id) => db.policyVersion.findFirst({ where: { id } }),
    isPending: (p) => (p as { state: string }).state !== "standby",
    onApprove: async (db, _org, t) => {
      const pol = t as { id: string; version: string; state: string };
      await db.policyVersion.updateMany({
        where: { id: pol.id },
        data: { state: "standby" },
      });
      return {
        output: { from: pol.state, status: "standby" },
        summary: `policy ${pol.version} rolled back → standby`,
      };
    },
    onReject: async (_db, _org, t) => {
      const pol = t as { version: string; state: string };
      return {
        output: { status: pol.state },
        summary: `policy ${pol.version} rollback rejected`,
      };
    },
  } as ApprovalDef<unknown>,

  // Finance credit note — registered; UI later.
  "creditnote.issue": {
    kind: "creditnote.issue",
    roles: ["FINANCE", "ADMIN"],
    targetType: "Invoice",
    load: (db, _org, id) => db.invoice.findFirst({ where: { id } }),
    isPending: (i) => (i as { status: string }).status !== "credited",
    onApprove: async (db, _org, t) => {
      const inv = t as { id: string; code: string; status: string };
      await db.invoice.updateMany({
        where: { id: inv.id },
        data: { status: "credited" },
      });
      return {
        output: { from: inv.status, status: "credited" },
        summary: `credit note issued for ${inv.code}`,
      };
    },
    onReject: async (_db, _org, t) => {
      const inv = t as { code: string; status: string };
      return {
        output: { status: inv.status },
        summary: `credit note for ${inv.code} rejected`,
      };
    },
  } as ApprovalDef<unknown>,
};

export function approvalRoles(kind: ApprovalKind): Role[] {
  return REGISTRY[kind].roles;
}

/**
 * The single entry point for a gated decision. Role check FIRST (VIEWER can never
 * approve), then org-scoped load + pending assertion + effect + AUDIT.1 write.
 * Throws only for an insufficient role (requireRole); every other outcome is a
 * structured DecideResult.
 */
export async function decide(
  kind: ApprovalKind,
  targetId: string,
  decision: Decision,
  user: DecideUser,
): Promise<DecideResult> {
  const def = REGISTRY[kind];
  requireRole(user, def.roles); // line 1 — insufficient role throws "forbidden"

  const db = dbForOrg(user.orgId);
  const target = await def.load(db, user.orgId, targetId);
  if (!target) {
    return {
      ok: false,
      reason: "not_found",
      message: `${kind}: target not found`,
    };
  }
  if (!def.isPending(target)) {
    return {
      ok: false,
      reason: "already_decided",
      message: `${kind}: already decided`,
    };
  }

  const by: Approver = { id: user.id, label: user.name ?? user.email };
  const eff =
    decision === "APPROVE"
      ? await def.onApprove(db, user.orgId, target, by)
      : await def.onReject(db, user.orgId, target, by);

  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: by.label },
    action: `${kind}.${decision.toLowerCase()}`,
    target: { type: def.targetType, id: targetId },
    summary: eff.summary,
    output: eff.output,
    // AUDIT.3 — a human decision records the approver (model/confidence null).
    approver: { id: by.id, label: by.label },
  });

  return {
    ok: true,
    decision,
    status: String(eff.output.status ?? "done"),
    summary: eff.summary,
  };
}
