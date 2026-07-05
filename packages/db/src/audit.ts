import { AuditActor, Prisma } from "@prisma/client";
import type { OrgScopedDb } from "./client";

// AUDIT.1 — the ONLY writer for the immutable event log. Every gated mutation +
// agent action lands here (actor · action · target · inputs · output). Append-only:
// this only INSERTs, and the DB blocks UPDATE/DELETE (audit_no_update/_delete rules).
// Best-effort DURABILITY, mandatory INTENT: a logging failure must NEVER roll back
// the business mutation — it's caught + logged to the console, never re-thrown.
// Core lives in @axona/db so apps/worker (the WF.1 executor) can call it too.
// /// AUDIT.3 will enrich each entry with model · confidence · approver.
// /// ONT.1 hardens this table into the immutable ontology event log.

export interface AuditActorInput {
  type: AuditActor; // "HUMAN" | "AGENT" | "SYSTEM"
  id?: string | null; // userId / agentId (null for SYSTEM)
  label: string; // denormalized display
}

export interface WriteAuditInput {
  orgId: string;
  actor: AuditActorInput;
  action: string; // dotted verb — "po.advance", "workflow.run", …
  target: { type: string; id: string };
  summary: string;
  inputs?: unknown;
  output?: unknown;
  correlationId?: string;
  // AUDIT.3 — agent entries carry model + emitted confidence; human approval
  // entries carry the approver. All optional.
  model?: string;
  confidence?: number;
  approver?: { id: string; label: string };
}

const asJson = (v: unknown): Prisma.InputJsonValue =>
  (v === undefined ? Prisma.JsonNull : v) as Prisma.InputJsonValue;

/**
 * Append one row to the immutable audit log. Org-scoped through the passed
 * `dbForOrg(orgId)` client. Never throws into the caller — a failed write is
 * logged and swallowed so the business transaction is unaffected.
 */
export async function writeAudit(
  db: OrgScopedDb,
  e: WriteAuditInput,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: e.orgId,
        actorType: e.actor.type,
        actorId: e.actor.id ?? null,
        actorLabel: e.actor.label,
        action: e.action,
        targetType: e.target.type,
        targetId: e.target.id,
        summary: e.summary,
        inputs: asJson(e.inputs),
        output: asJson(e.output),
        correlationId: e.correlationId ?? null,
        model: e.model ?? null,
        confidence: e.confidence ?? null,
        approverId: e.approver?.id ?? null,
        approverLabel: e.approver?.label ?? null,
      },
    });
  } catch (err) {
    // Durability is best-effort; the mutation already committed. Do not re-throw.
    console.error(
      `[writeAudit] failed to log ${e.action} on ${e.target.type}:${e.target.id} —`,
      (err as Error).message,
    );
  }
}

export { AuditActor };
