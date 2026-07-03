import type { OrgScopedDb } from "../../src";
import { Prisma } from "../../src";

// WF.1 — seed workflows across a few modules with real WorkflowGraph `steps`
// (validated by the executor's parseGraph + verify-wf-1), each with ≥1 persisted
// WorkflowRun using the real TraceLine shape, so WFL.1 shows last-run status and
// WFL.2 replays a real trace. Tied to the cross-module through-line. Idempotent
// (seed truncates + re-creates). No import from @axona/agents here — that would
// be a circular package dep; the graphs are plain literals matching the schema.
//
// Graphs are authored plain; the shapes match @axona/agents WorkflowGraph:
//   trigger{ id,type:"trigger",event,next }, agent{ agentCode,action,next },
//   gate{ kind:"decision"|"guardrail",condition?,onTrue?,onFalse? }, output{ label }.

const T0 = new Date("2026-06-24T09:00:00.000Z").getTime();
const ts = (min: number) => new Date(T0 + min * 60_000).toISOString();
const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

// 1) Procurement reorder (the wedge) — parks at the guardrail (PO approve = RBAC.4).
const procurementReorder = {
  trigger: {
    id: "t",
    type: "trigger",
    event: "procurement.reorder_point_hit",
    next: "sourcing",
  },
  nodes: [
    {
      id: "sourcing",
      type: "agent",
      agentCode: "proc-01",
      action: "rank suppliers for the part under reorder point",
      next: "rfq",
    },
    {
      id: "rfq",
      type: "agent",
      agentCode: "proc-02",
      action: "draft and issue the RFQ",
      next: "gate-value",
    },
    {
      id: "gate-value",
      type: "gate",
      kind: "decision",
      condition: { field: "value", op: "lt", value: 50000 },
      onTrue: "reorder",
      onFalse: "escalate",
    },
    {
      id: "reorder",
      type: "agent",
      agentCode: "proc-04",
      action: "draft the purchase order",
      next: "gate-approve",
    },
    {
      id: "gate-approve",
      type: "gate",
      kind: "guardrail",
      onTrue: "po-out",
      onFalse: "escalate",
    },
    { id: "po-out", type: "output", label: "PO approved and placed" },
    {
      id: "escalate",
      type: "output",
      label: "escalated to a buyer for manual sourcing",
    },
  ],
};
const procurementTrace = [
  {
    ts: ts(0),
    kind: "scan",
    text: 'workflow "Procurement reorder" · trigger procurement.reorder_point_hit',
  },
  {
    ts: ts(1),
    kind: "draft",
    text: "proc-01 · rank suppliers for the part under reorder point",
  },
  {
    ts: ts(1),
    kind: "correlate",
    text: "model claude-sonnet-4-6 · 3 suppliers ranked; lead-time risk scored",
    data: { model: "claude-sonnet-4-6" },
  },
  { ts: ts(2), kind: "draft", text: "proc-02 · draft and issue the RFQ" },
  {
    ts: ts(3),
    kind: "policy-check",
    text: "gate gate-value: value lt 50000 → onTrue (PO value $48,200)",
  },
  {
    ts: ts(4),
    kind: "draft",
    text: "proc-04 · PO-4471 DRAFTED · $48,200 · actuator drive lot",
  },
  {
    ts: ts(5),
    kind: "proposal",
    text: "guardrail gate-approve — proposed — AWAITING_APPROVAL (RBAC.4); halting (no auto-execute)",
  },
];

// 2) NCR-118 → ECO-318 (quality → engineering) — a completed run.
const ncrToEco = {
  trigger: {
    id: "t",
    type: "trigger",
    event: "quality.ncr_opened",
    next: "rootcause",
  },
  nodes: [
    {
      id: "rootcause",
      type: "agent",
      agentCode: "qa-01",
      action: "root-cause NCR-118 actuator torque drift",
      next: "change",
    },
    {
      id: "change",
      type: "agent",
      agentCode: "eng-01",
      action: "draft ECO-318 to supersede SERVO-204",
      next: "out",
    },
    {
      id: "out",
      type: "output",
      label: "ECO-318 drafted; routed for engineering review",
    },
  ],
};
const ncrTrace = [
  {
    ts: ts(0),
    kind: "scan",
    text: 'workflow "NCR-118 → ECO-318" · trigger quality.ncr_opened',
  },
  {
    ts: ts(1),
    kind: "draft",
    text: "qa-01 · root-cause NCR-118 actuator torque drift",
  },
  {
    ts: ts(2),
    kind: "correlate",
    text: "model claude-sonnet-4-6 · torque drift traced to harmonic-drive lot 88421",
    data: { model: "claude-sonnet-4-6" },
  },
  {
    ts: ts(3),
    kind: "draft",
    text: "eng-01 · draft ECO-318 to supersede SERVO-204",
  },
  {
    ts: ts(4),
    kind: "draft",
    text: "ECO-318 DRAFTED — supersede SERVO-204 → -205 + firmware torque-comp",
  },
  {
    ts: ts(5),
    kind: "result",
    text: "ECO-318 drafted; routed for engineering review",
  },
];

// 3) Fleet predictive-maintenance → field dispatch (SN-2196) — a completed run.
const fleetToDispatch = {
  trigger: {
    id: "t",
    type: "trigger",
    event: "fleet.predictive_alert",
    next: "predict",
  },
  nodes: [
    {
      id: "predict",
      type: "agent",
      agentCode: "fleet-02",
      action: "assess SN-2196 thermal signature and remaining life",
      next: "dispatch",
    },
    {
      id: "dispatch",
      type: "agent",
      agentCode: "field-01",
      action: "dispatch a certified technician for the service window",
      next: "out",
    },
    { id: "out", type: "output", label: "field visit scheduled for SN-2196" },
  ],
};
const fleetTrace = [
  {
    ts: ts(0),
    kind: "scan",
    text: 'workflow "Predictive maintenance → dispatch" · trigger fleet.predictive_alert',
  },
  {
    ts: ts(1),
    kind: "draft",
    text: "fleet-02 · assess SN-2196 thermal signature and remaining life",
  },
  {
    ts: ts(2),
    kind: "correlate",
    text: "model claude-sonnet-4-6 · rising thermal trend; ~8 days to threshold",
    data: { model: "claude-sonnet-4-6" },
  },
  {
    ts: ts(3),
    kind: "draft",
    text: "field-01 · dispatch a certified technician for the service window",
  },
  { ts: ts(4), kind: "result", text: "field visit scheduled for SN-2196" },
];

interface Spec {
  moduleKey: string;
  name: string;
  description: string;
  graph: { trigger: unknown; nodes: unknown[] };
  runStatus: "SUCCEEDED" | "AWAITING_APPROVAL";
  trace: unknown[];
}

const SPECS: Spec[] = [
  {
    moduleKey: "procurement",
    name: "Procurement reorder",
    description:
      "Reorder-point hit → source, RFQ, and draft a PO; the PO approval parks for a human (RBAC.4).",
    graph: procurementReorder,
    runStatus: "AWAITING_APPROVAL",
    trace: procurementTrace,
  },
  {
    moduleKey: "quality",
    name: "NCR-118 → ECO-318",
    description:
      "NCR opened → root-cause the torque drift and draft the ECO to supersede the drive.",
    graph: ncrToEco,
    runStatus: "SUCCEEDED",
    trace: ncrTrace,
  },
  {
    moduleKey: "fleet",
    name: "Predictive maintenance → dispatch",
    description:
      "Predictive telemetry alert → assess remaining life and dispatch a certified technician.",
    graph: fleetToDispatch,
    runStatus: "SUCCEEDED",
    trace: fleetTrace,
  },
];

export async function seedWorkflows(
  db: OrgScopedDb,
): Promise<{ workflows: number; runs: number }> {
  let runs = 0;
  for (const s of SPECS) {
    const wf = await db.workflow.create({
      data: {
        moduleKey: s.moduleKey,
        name: s.name,
        description: s.description,
        status: "ACTIVE",
        trigger: json(s.graph.trigger),
        steps: json(s.graph),
      },
    });
    // dbForOrg injects orgId on WorkflowRun (tenant model).
    await db.workflowRun.create({
      data: {
        workflowId: wf.id,
        status: s.runStatus,
        trace: json(s.trace),
        endedAt: new Date(T0 + 6 * 60_000),
      },
    });
    runs++;
  }
  return { workflows: SPECS.length, runs };
}
