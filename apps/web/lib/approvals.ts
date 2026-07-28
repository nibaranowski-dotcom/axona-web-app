import {
  dbForOrg,
  writeAudit,
  applyFieldModification,
  rejectFieldModification,
  isGatedActionKind,
  trustForTarget,
  recordOutcome,
  freezeConfigManifest,
  type OrgScopedDb,
  type Role,
  type POStatus,
  type TrustRung,
  type TrustCell,
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
  | "workflow.gate"
  | "config.lock" // PLM.10/11 — baseline/lock a ConfigurationVersion (dual-approver)
  | "config.unlock" // PLM.11 — unlock a baselined ConfigurationVersion (second approver)
  | "field.mod"; // PLM.V5 — approve a recorded field modification (applies the delta)

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

// TRUST.1 — the advisory consult decide() records on every decision. `rung` is the
// proposing agent's earned rung for this (agent, actionKind); `frictionRelaxEligible`
// is the ADVISORY hint for a future non-gated auto-path — HARD-false for any gated
// (money/safety/contract) kind. This story acts on NONE of it: the human still decides.
export interface TrustConsult {
  rung: TrustRung;
  gated: boolean;
  frictionRelaxEligible: boolean;
}

export type DecideResult =
  | {
      ok: true;
      decision: Decision;
      status: string;
      summary: string;
      /** TRUST.1 — the rung recorded on this decision (advisory; no autonomy granted). */
      trust: TrustConsult;
      /** LOOP.1 — the `loop` writeback trace line (outcome → MEM.1 episode). */
      loop: string;
    }
  | { ok: false; reason: "not_found" | "already_decided"; message: string };

/**
 * TRUST.1 hard ceiling. Computes the advisory autonomy hint for a decision. NEVER true
 * for a gated action-kind — a money/safety/contract decision can never be auto-approved
 * regardless of the rung or confidence. The auto rung stays disabled; decide() ignores
 * this for its flow (still fully human-in-the-loop). It exists so LOOP.1/Act can read it.
 */
function advisoryAutonomy(
  kind: ApprovalKind,
  cell: TrustCell | null,
): TrustConsult {
  const rung: TrustRung = cell?.rung ?? "SUGGEST";
  // Gated if EITHER the decide-kind or the proposing cell's kind is gated (defense in depth).
  const gated = isGatedActionKind(kind) || (cell?.gated ?? false);
  const frictionRelaxEligible =
    !gated && (rung === "REVIEW_LIGHT" || rung === "AUTO_BOUNDED");
  return { rung, gated, frictionRelaxEligible };
}

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

  // PLM.10 — lock/baseline a ConfigurationVersion. A locked config is IMMUTABLE:
  // isPending is false once lockedAt is set, so decide() refuses a second lock, and
  // the app offers no edit path. Gated (ENGINEER/ADMIN) + audited via decide().
  // PLM.11 — lock/baseline a draft config. DUAL-APPROVER: the first approver PROPOSES
  // the lock (draft → awaiting-second); a DIFFERENT second approver finalizes, which
  // FREEZES the manifest (immutable) and baselines it. A single approver can never
  // finalize alone. Each step writes its own AUDIT.1 entry (both approvers on record).
  "config.lock": {
    kind: "config.lock",
    roles: ["ENGINEER", "ADMIN"],
    targetType: "ConfigurationVersion",
    load: (db, _org, id) =>
      db.configurationVersion.findFirst({ where: { id } }),
    isPending: (c) => (c as { lockedAt: Date | null }).lockedAt === null,
    onApprove: async (db, _org, t, by) => {
      const cfg = t as {
        id: string;
        name: string;
        productModelId: string;
        swSpec: unknown;
        lockProposedById: string | null;
      };
      // First approver → propose (still a draft, awaiting a second approver).
      if (!cfg.lockProposedById) {
        await db.configurationVersion.updateMany({
          where: { id: cfg.id },
          data: { lockProposedById: by.id, lockProposedAt: new Date() },
        });
        return {
          output: { status: "awaiting_second", name: cfg.name },
          summary: `configuration ${cfg.name} lock proposed by ${by.label} — awaiting a second approver`,
        };
      }
      // Same approver again → cannot finalize alone (dual-control).
      if (cfg.lockProposedById === by.id) {
        return {
          output: { status: "awaiting_second", name: cfg.name },
          summary: `configuration ${cfg.name} still awaiting a SECOND approver (a single approver cannot finalize)`,
        };
      }
      // A different second approver → FREEZE the manifest + baseline (immutable).
      const frozen = await freezeConfigManifest(db, {
        productModelId: cfg.productModelId,
        swSpec: cfg.swSpec,
      });
      await db.configurationVersion.updateMany({
        where: { id: cfg.id },
        data: {
          lockedAt: new Date(),
          lockedById: by.id,
          isBaseline: true,
          frozenManifest: frozen as never,
        },
      });
      return {
        output: { status: "locked", name: cfg.name },
        summary: `configuration ${cfg.name} baselined + locked (immutable) — second approver ${by.label}`,
      };
    },
    onReject: async (db, _org, t) => {
      const cfg = t as { id: string; name: string };
      // Decline clears any pending lock proposal (back to a clean draft).
      await db.configurationVersion.updateMany({
        where: { id: cfg.id },
        data: { lockProposedById: null, lockProposedAt: null },
      });
      return {
        output: { status: "draft", name: cfg.name },
        summary: `configuration ${cfg.name} lock declined`,
      };
    },
  } as ApprovalDef<unknown>,

  // PLM.11 — unlock a baselined config. Separation of duties: the unlocking approver
  // must be DIFFERENT from the approver who locked it ("unlock needs a second
  // approver"). Reverts to a draft (the manifest resolves live again); RBAC + audited.
  "config.unlock": {
    kind: "config.unlock",
    roles: ["ENGINEER", "ADMIN"],
    targetType: "ConfigurationVersion",
    load: (db, _org, id) =>
      db.configurationVersion.findFirst({ where: { id } }),
    isPending: (c) => (c as { lockedAt: Date | null }).lockedAt !== null,
    onApprove: async (db, _org, t, by) => {
      const cfg = t as { id: string; name: string; lockedById: string | null };
      // The locker cannot unlock their own baseline — a second person must.
      if (cfg.lockedById && cfg.lockedById === by.id) {
        return {
          output: { status: "locked", name: cfg.name },
          summary: `configuration ${cfg.name} stays locked — unlock needs a SECOND approver (not the locker)`,
        };
      }
      // Back to a draft: lockedAt=null → readConfigManifest resolves LIVE again, so the
      // now-stale frozenManifest is simply ignored (no need to clear the Json column).
      await db.configurationVersion.updateMany({
        where: { id: cfg.id },
        data: {
          lockedAt: null,
          lockedById: null,
          isBaseline: false,
          lockProposedById: null,
          lockProposedAt: null,
        },
      });
      return {
        output: { status: "draft", name: cfg.name },
        summary: `configuration ${cfg.name} unlocked by ${by.label} — back to draft`,
      };
    },
    onReject: async (_db, _org, t) => {
      const cfg = t as { name: string };
      return {
        output: { status: "locked", name: cfg.name },
        summary: `configuration ${cfg.name} unlock declined`,
      };
    },
  } as ApprovalDef<unknown>,

  // PLM.V5 — approve a recorded field modification. The pending FieldEvent IS the
  // decide() target (a human tech proposed it; an engineer/ops approves). onApprove
  // APPLIES the config delta (new UnitSoftwareState / as-built delta) so
  // resolveConfigAt(now) moves forward; the event's frozen snapshot is untouched.
  "field.mod": {
    kind: "field.mod",
    roles: ["ENGINEER", "OPS", "ADMIN"],
    targetType: "FieldEvent",
    load: (db, _org, id) => db.fieldEvent.findFirst({ where: { id } }),
    isPending: (e) =>
      (e as { kind: string; state: string }).kind === "field_modification" &&
      (e as { state: string }).state === "pending",
    onApprove: async (db, _org, t, by) => {
      const ev = t as { id: string; summary: string; effect: string | null };
      const res = await applyFieldModification(db, ev.id, { id: by.id });
      return {
        output: {
          status: "approved",
          changedConfig: res.changedConfig,
          effect: ev.effect,
        },
        summary: res.summary,
      };
    },
    onReject: async (db, _org, t, by) => {
      const ev = t as { id: string; summary: string };
      await rejectFieldModification(db, ev.id, { id: by.id });
      return {
        output: { status: "rejected" },
        summary: `field modification rejected — ${ev.summary}`,
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

  // TRUST.1 — consult the proposing agent's earned rung (advisory + recorded). The
  // consult NEVER changes the flow here (human-in-the-loop stays intact) and NEVER
  // auto-approves a gated kind — it only annotates the decision + audit entry.
  const cell = await trustForTarget(db, user.orgId, def.targetType, targetId);
  const trust = advisoryAutonomy(kind, cell);

  const by: Approver = { id: user.id, label: user.name ?? user.email };
  const eff =
    decision === "APPROVE"
      ? await def.onApprove(db, user.orgId, target, by)
      : await def.onReject(db, user.orgId, target, by);

  const auditEntryId = await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: by.label },
    action: `${kind}.${decision.toLowerCase()}`,
    target: { type: def.targetType, id: targetId },
    summary: eff.summary,
    // TRUST.1 — record the rung on the decision (no schema change; the rung rides in
    // the existing output JSON). Nothing bypasses the immutable log.
    output: {
      ...eff.output,
      trustRung: trust.rung,
      trustGated: trust.gated,
      frictionRelaxEligible: trust.frictionRelaxEligible,
    },
    // AUDIT.3 — a human decision records the approver (model/confidence null).
    approver: { id: by.id, label: by.label },
  });

  // LOOP.1 — writeback: turn this verdict into an OUTCOME episode in the MEM.1 store so
  // MEM.2 injects it into the next similar proposal + CONF.1 gets a label. Linked to the
  // audit entry (never mutates it), idempotent, org-scoped. Outcomes INFORM — the human
  // still decided above; nothing here grants autonomy. Best-effort (never undoes the decision).
  const outcome = auditEntryId
    ? await recordOutcome(db, {
        auditEntryId,
        decision,
        actionKind: kind,
        targetType: def.targetType,
        targetId,
        approverLabel: by.label,
        occurredAt: new Date(),
      })
    : null;

  return {
    ok: true,
    decision,
    status: String(eff.output.status ?? "done"),
    summary: eff.summary,
    trust,
    loop:
      outcome?.trace ?? "recorded outcome: (audit unavailable — no writeback)",
  };
}
