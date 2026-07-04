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

// A linear agent chain → output, built to WF.1's WorkflowGraph shape. Keeps the
// enrichment workflows real (valid graphs the executor could run) without hand-
// authoring each. `agentCode` values are real seeded codes (prefix-0N).
type Step = { code: string; action: string };
function linearGraph(event: string, steps: Step[], outputLabel: string) {
  const nodes: unknown[] = steps.map((s, i) => ({
    id: `a${i + 1}`,
    type: "agent",
    agentCode: s.code,
    action: s.action,
    next: i < steps.length - 1 ? `a${i + 2}` : "out",
  }));
  nodes.push({ id: "out", type: "output", label: outputLabel });
  return {
    trigger: {
      id: "t",
      type: "trigger",
      event,
      next: steps.length ? "a1" : "out",
    },
    nodes,
  };
}
function chainTrace(
  name: string,
  event: string,
  steps: Step[],
  result: string,
): unknown[] {
  const lines: unknown[] = [
    { ts: ts(0), kind: "scan", text: `workflow "${name}" · trigger ${event}` },
  ];
  steps.forEach((s, i) =>
    lines.push({
      ts: ts(i + 1),
      kind: "draft",
      text: `${s.code} · ${s.action}`,
    }),
  );
  lines.push({ ts: ts(steps.length + 1), kind: "result", text: result });
  return lines;
}

interface Spec {
  moduleKey: string;
  name: string;
  description: string;
  status: "ACTIVE" | "DRAFT" | "PAUSED";
  graph: { trigger: unknown; nodes: unknown[] };
  // The latest run to persist (null = never run, e.g. a fresh draft).
  run: {
    status: "SUCCEEDED" | "AWAITING_APPROVAL" | "FAILED";
    trace: unknown[];
    minsAgo: number;
  } | null;
}

// mfg exception → reschedule (a draft, never run)
const mfgSteps: Step[] = [
  { code: "mfg-01", action: "rebalance the line schedule around the stoppage" },
  { code: "inv-01", action: "re-kit affected work orders" },
  { code: "ful-01", action: "notify delivery of the new dates" },
];
// sales deal → deliverability
const salesSteps: Step[] = [
  {
    code: "sales-01",
    action: "check build feasibility for the configured quote",
  },
  { code: "legal-01", action: "draft the contract terms" },
  { code: "fin-01", action: "schedule the revenue recognition" },
];
// fulfillment delivery recovery (a draft that has been run)
const fulSteps: Step[] = [
  { code: "ful-01", action: "clear the export/customs hold" },
  { code: "field-01", action: "schedule the on-site install" },
  { code: "fin-01", action: "resync the delivery SLA" },
];
// security CVE response
const secSteps: Step[] = [
  { code: "sec-01", action: "verify the patch certification" },
  { code: "eng-01", action: "stage isolate-or-push for the fleet" },
  { code: "fleet-01", action: "write the audit-log entry" },
];
// autonomy incident → policy review
const autoSteps: Step[] = [
  { code: "auto-01", action: "replay the near-miss in sim" },
  { code: "auto-02", action: "validate the candidate fix" },
];
// finance invoice → 3-way match
const finSteps: Step[] = [
  { code: "fin-01", action: "3-way match the invoice to PO + receipt" },
  { code: "fin-02", action: "auto-clear or flag the exception" },
];

const SPECS: Spec[] = [
  // The three WF.1 through-line workflows (kept).
  {
    moduleKey: "procurement",
    name: "Procurement reorder",
    description:
      "Reorder-point hit → source, RFQ, and draft a PO; the PO approval parks for a human (RBAC.4).",
    status: "ACTIVE",
    graph: procurementReorder,
    run: { status: "AWAITING_APPROVAL", trace: procurementTrace, minsAgo: 29 },
  },
  {
    moduleKey: "quality",
    name: "NCR-118 → ECO-318",
    description:
      "NCR opened → root-cause the torque drift and draft the ECO to supersede the drive.",
    status: "ACTIVE",
    graph: ncrToEco,
    run: { status: "SUCCEEDED", trace: ncrTrace, minsAgo: 120 },
  },
  {
    moduleKey: "fleet",
    name: "Predictive maintenance → dispatch",
    description:
      "Predictive telemetry alert → assess remaining life and dispatch a certified technician.",
    status: "ACTIVE",
    graph: fleetToDispatch,
    run: { status: "SUCCEEDED", trace: fleetTrace, minsAgo: 180 },
  },
  // Enrichment — a workflow per remaining module so the module-separated list
  // renders as populated as the mock (real graphs + a last run each).
  {
    moduleKey: "manufacturing",
    name: "Build exception → reschedule",
    description:
      "Line stoppage → rebalance the schedule → re-kit → notify delivery.",
    status: "DRAFT",
    graph: linearGraph(
      "manufacturing.line_exception",
      mfgSteps,
      "schedule rebalanced; delivery notified",
    ),
    run: null,
  },
  {
    moduleKey: "sales",
    name: "Robot deal → deliverability",
    description:
      "Quote configured → feasibility → contract → revenue schedule.",
    status: "ACTIVE",
    graph: linearGraph(
      "sales.quote_configured",
      salesSteps,
      "deal deliverable; revenue scheduled",
    ),
    run: {
      status: "SUCCEEDED",
      trace: chainTrace(
        "Robot deal → deliverability",
        "sales.quote_configured",
        salesSteps,
        "deal deliverable; revenue scheduled",
      ),
      minsAgo: 60,
    },
  },
  {
    moduleKey: "fulfillment",
    name: "Robot delivery recovery",
    description:
      "Delivery at risk → clear customs → expedite install → resync SLA.",
    status: "DRAFT",
    graph: linearGraph(
      "fulfillment.delivery_at_risk",
      fulSteps,
      "delivery recovered; SLA resynced",
    ),
    run: {
      status: "SUCCEEDED",
      trace: chainTrace(
        "Robot delivery recovery",
        "fulfillment.delivery_at_risk",
        fulSteps,
        "delivery recovered; SLA resynced",
      ),
      minsAgo: 480,
    },
  },
  {
    moduleKey: "security",
    name: "Fleet CVE response",
    description:
      "Critical CVE → verify patch cert → isolate or push → audit log.",
    status: "ACTIVE",
    graph: linearGraph(
      "security.critical_cve",
      secSteps,
      "patch staged; audit-log written",
    ),
    run: {
      status: "SUCCEEDED",
      trace: chainTrace(
        "Fleet CVE response",
        "security.critical_cve",
        secSteps,
        "patch staged; audit-log written",
      ),
      minsAgo: 180,
    },
  },
  {
    moduleKey: "autonomy",
    name: "Safety incident → policy review",
    description: "Near-miss → replay in sim → validate fix → stage rollback.",
    status: "ACTIVE",
    graph: linearGraph(
      "autonomy.near_miss",
      autoSteps,
      "fix validated; rollback staged",
    ),
    run: {
      status: "SUCCEEDED",
      trace: chainTrace(
        "Safety incident → policy review",
        "autonomy.near_miss",
        autoSteps,
        "fix validated; rollback staged",
      ),
      minsAgo: 300,
    },
  },
  {
    moduleKey: "finance",
    name: "Invoice → 3-way match → pay",
    description: "Supplier invoice → match PO + receipt → auto-clear or flag.",
    status: "ACTIVE",
    graph: linearGraph(
      "finance.invoice_received",
      finSteps,
      "invoice matched; cleared for pay",
    ),
    run: {
      status: "SUCCEEDED",
      trace: chainTrace(
        "Invoice → 3-way match → pay",
        "finance.invoice_received",
        finSteps,
        "invoice matched; cleared for pay",
      ),
      minsAgo: 20,
    },
  },
];

const NOW = Date.now();

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
        status: s.status,
        trigger: json(s.graph.trigger),
        steps: json(s.graph),
      },
    });
    if (s.run) {
      // dbForOrg injects orgId on WorkflowRun (tenant model). startedAt drives
      // the list's last-run relative time; keep it recent + varied.
      const started = new Date(NOW - s.run.minsAgo * 60_000);
      await db.workflowRun.create({
        data: {
          workflowId: wf.id,
          status: s.run.status,
          trace: json(s.run.trace),
          startedAt: started,
          endedAt: new Date(started.getTime() + 6 * 60_000),
        },
      });
      runs++;
    }
  }
  return { workflows: SPECS.length, runs };
}
