import type { OrgScopedDb } from "../../src";
import { Prisma } from "../../src";
import { CODES } from "./constants";

// AUDIT.1 — seed a historical immutable trail across the NCR-118 → ECO-318 →
// PO-9001 through-line so the (future) AUDIT.2 viewer + the demo render populated.
// Each row is what a real gated mutation / agent action would have appended:
// actor · action · target · inputs · output. Idempotent (clearDemoOrg wipes the
// tenant's AuditLog first). Timestamps spread over the last few days.

type ActorType = "HUMAN" | "AGENT" | "SYSTEM";
interface Entry {
  daysAgo: number;
  actorType: ActorType;
  actorId: string | null;
  actorLabel: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  inputs?: unknown;
  output?: unknown;
  correlationId?: string;
}

const json = (v: unknown): Prisma.InputJsonValue =>
  (v === undefined ? Prisma.JsonNull : v) as Prisma.InputJsonValue;

export async function seedAudit(
  db: OrgScopedDb,
  orgId: string,
  nowMs: number,
): Promise<{ entries: number }> {
  // Resolve the real through-line targets (fall back to a stable synthetic id).
  const [po, ncr, eco, run, project, admin, ops] = await Promise.all([
    db.purchaseOrder.findFirst({ select: { id: true, code: true } }),
    db.nCR.findFirst({ where: { code: CODES.ncr }, select: { id: true } }),
    db.eCO.findFirst({ where: { code: CODES.eco }, select: { id: true } }),
    db.workflowRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }),
    db.project.findFirst({
      where: { name: { contains: CODES.eco } },
      select: { id: true },
    }),
    db.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true, name: true },
    }),
    db.user.findFirst({
      where: { role: "OPS" },
      select: { id: true, name: true },
    }),
  ]);

  const files = project
    ? await db.file.findMany({
        where: { projectId: project.id },
        select: { id: true, name: true },
      })
    : [];
  const columns = project
    ? await db.matrixColumn.findMany({
        where: { projectId: project.id },
        select: { id: true, question: true },
      })
    : [];

  const poId = po?.id ?? "po-seed";
  const poCode = po?.code ?? "PO-9001";
  const ncrId = ncr?.id ?? "ncr-seed";
  const ecoId = eco?.id ?? "eco-seed";
  const runId = run?.id ?? "run-seed";
  const opsLabel = ops?.name ?? "M. Osei";
  const adminLabel = admin?.name ?? "A. Fenwick";
  const opsId = ops?.id ?? null;
  const adminId = admin?.id ?? null;

  const entries: Entry[] = [
    // NCR → ECO chain
    {
      daysAgo: 5,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Quality agent",
      action: "ncr.open",
      targetType: "NCR",
      targetId: ncrId,
      summary: `NCR ${CODES.ncr} opened — stiff drive on ${CODES.lot}`,
      output: { severity: "major", lot: CODES.lot },
    },
    {
      daysAgo: 5,
      actorType: "HUMAN",
      actorId: adminId,
      actorLabel: adminLabel,
      action: "ncr.triage",
      targetType: "NCR",
      targetId: ncrId,
      summary: `NCR ${CODES.ncr} triaged → root-cause investigation`,
      inputs: { disposition: "investigate" },
    },
    {
      daysAgo: 4,
      actorType: "HUMAN",
      actorId: adminId,
      actorLabel: adminLabel,
      action: "eco.raise",
      targetType: "ECO",
      targetId: ecoId,
      summary: `ECO ${CODES.eco} raised from ${CODES.ncr} — supersede ${CODES.servoOld} → ${CODES.servoNew}`,
      inputs: { from: CODES.servoOld, to: CODES.servoNew },
    },
    // Workflow run (correlationId ties the chain)
    {
      daysAgo: 4,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Workflow orchestrator",
      action: "workflow.run",
      targetType: "WorkflowRun",
      targetId: runId,
      summary: "NCR→ECO change workflow run → AWAITING_APPROVAL",
      output: { status: "AWAITING_APPROVAL" },
      correlationId: runId,
    },
    {
      daysAgo: 4,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Compatibility agent",
      action: "compat.check",
      targetType: "ECO",
      targetId: ecoId,
      summary: `Compat check for ${CODES.servoNew} — HX-1 r5 cert pending`,
      output: { blocked: ["HX-1 r5"] },
      correlationId: runId,
    },
    // Sourcing / PO-9001 lifecycle
    {
      daysAgo: 3,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Sourcing agent",
      action: "po.draft",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode} drafted for ${CODES.servoNew} drive — AWAITING_APPROVAL`,
      output: { status: "AWAITING_APPROVAL" },
    },
    {
      daysAgo: 3,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Sourcing agent",
      action: "supplier.propose",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode}: Vendor A proposed — best ETA (4wk lead, $540/unit)`,
      output: { supplier: "Vendor A", leadWeeks: 4 },
    },
    {
      daysAgo: 3,
      actorType: "HUMAN",
      actorId: opsId,
      actorLabel: opsLabel,
      action: "po.advance",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode} DRAFTED → AWAITING_APPROVAL`,
      inputs: { from: "DRAFTED" },
      output: { status: "AWAITING_APPROVAL" },
    },
    {
      daysAgo: 2,
      actorType: "HUMAN",
      actorId: adminId,
      actorLabel: adminLabel,
      action: "po.advance",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode} AWAITING_APPROVAL → APPROVED`,
      inputs: { from: "AWAITING_APPROVAL" },
      output: { status: "APPROVED" },
    },
    {
      daysAgo: 2,
      actorType: "HUMAN",
      actorId: opsId,
      actorLabel: opsLabel,
      action: "po.advance",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode} APPROVED → SENT`,
      inputs: { from: "APPROVED" },
      output: { status: "SENT" },
    },
    // File uploads on the ECO project
    ...files.slice(0, 3).map(
      (f): Entry => ({
        daysAgo: 2,
        actorType: "HUMAN",
        actorId: opsId,
        actorLabel: opsLabel,
        action: "file.upload",
        targetType: "File",
        targetId: f.id,
        summary: `uploaded ${f.name}`,
        output: { name: f.name },
      }),
    ),
    // Matrix extraction (agent) per seeded column
    ...columns.map(
      (c): Entry => ({
        daysAgo: 1,
        actorType: "AGENT",
        actorId: null,
        actorLabel: "Matrix extraction agent",
        action: "column.extract",
        targetType: "MatrixColumn",
        targetId: c.id,
        summary: `extracted "${c.question}" across ${files.length} files`,
        inputs: { question: c.question },
        output: { files: files.length },
      }),
    ),
    // Recent activity
    {
      daysAgo: 1,
      actorType: "AGENT",
      actorId: null,
      actorLabel: "Sourcing agent",
      action: "po.reprice",
      targetType: "PurchaseOrder",
      targetId: poId,
      summary: `${poCode} re-cost flagged: +$140/unit vs prior drive`,
      output: { delta: "+$140/unit" },
    },
    {
      daysAgo: 0,
      actorType: "SYSTEM",
      actorId: null,
      actorLabel: "system",
      action: "digest.compile",
      targetType: "Org",
      targetId: "demo",
      summary: "daily operations digest compiled",
      output: { openNCRs: 1, posInFlight: 1 },
    },
  ];

  let count = 0;
  for (const e of entries) {
    const createdAt = new Date(
      nowMs - e.daysAgo * 86_400_000 - count * 137_000,
    );
    await db.auditLog.create({
      data: {
        orgId,
        actorType: e.actorType,
        actorId: e.actorId,
        actorLabel: e.actorLabel,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        summary: e.summary,
        inputs: json(e.inputs),
        output: json(e.output),
        correlationId: e.correlationId ?? null,
        createdAt,
      },
    });
    count++;
  }
  return { entries: count };
}
