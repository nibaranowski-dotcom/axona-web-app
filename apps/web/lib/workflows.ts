import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { RunStatus, WorkflowStatus } from "@axona/db";
import { safeParseGraph, type TraceLine } from "@axona/agents";

// WFL.1 — Workflows read model (build-spec §4.5). Agent orchestration by module.
// Read-only over the existing Workflow + WorkflowRun models (WF.1): no schema
// change. Reuses WF.1's WorkflowGraph (safeParseGraph) to derive the step count,
// the agent-chain preview (ordered agent-node codes → the glyph row), and the
// modules the chain touches. Surfaces each workflow's last run (latest
// WorkflowRun: status incl. AWAITING_APPROVAL + relative time). Grouped module-
// separated. Org-scoped via dbForOrg; the list paginated with the FND.11 helpers.
//
// MOAT / gating: this is a read-only browse+open list. Running a workflow (the
// Run button + live console) is WFL.2; any trigger stays agent/RBAC-gated via
// WF.1's enqueue API. /// RBAC.4: the approval/resume state machine gates money/
// safety/contract runs. /// AUDIT.3: each run logs inputs·output·model·confidence
// ·approver to the immutable log. Do not add those columns here.

const WORKFLOW_CAP = 500;

// moduleKey → display name (group headers) — matches the module catalog.
const MODULE_LABEL: Record<string, string> = {
  procurement: "Procurement",
  manufacturing: "Manufacturing",
  inventory: "Inventory",
  fulfillment: "Fulfillment",
  quality: "Quality",
  sales: "Sales & CRM",
  marketing: "Marketing",
  fleet: "Fleet",
  "field-service": "Field Service",
  engineering: "Engineering",
  autonomy: "Autonomy",
  finance: "Finance",
  people: "People",
  security: "Security",
  legal: "Legal",
  machines: "Machines",
};
// agentCode prefix → canonical moduleKey (so a workflow's own module and its
// agents' modules resolve to the SAME short label — no "Fulfillment·Ful" dupes).
const PREFIX_TO_MODULE: Record<string, string> = {
  proc: "procurement",
  mfg: "manufacturing",
  inv: "inventory",
  ful: "fulfillment",
  qa: "quality",
  sales: "sales",
  mkt: "marketing",
  fleet: "fleet",
  field: "field-service",
  eng: "engineering",
  auto: "autonomy",
  fin: "finance",
  ppl: "people",
  sec: "security",
  legal: "legal",
  mach: "machines",
};
// canonical moduleKey → short label (the "modules touched" column).
const MODULE_SHORT: Record<string, string> = {
  procurement: "Proc",
  manufacturing: "Mfg",
  inventory: "Inventory",
  fulfillment: "Ful",
  quality: "Quality",
  sales: "Sales",
  marketing: "Marketing",
  fleet: "Fleet",
  "field-service": "Field Svc",
  engineering: "Eng",
  autonomy: "Autonomy",
  finance: "Finance",
  people: "People",
  security: "Security",
  legal: "Legal",
  machines: "Machines",
};
const moduleLabel = (key: string) =>
  MODULE_LABEL[key] ??
  key.replace(/(^|-)([a-z])/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());
const moduleOfCode = (code: string) =>
  PREFIX_TO_MODULE[code.replace(/-\d+$/, "")] ?? code.replace(/-\d+$/, "");
const shortOf = (moduleKey: string) =>
  MODULE_SHORT[moduleKey] ?? moduleLabel(moduleKey).split(" ")[0]!;

export interface LastRun {
  status: RunStatus;
  at: Date;
}
export interface WorkflowRow {
  id: string;
  moduleKey: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  stepCount: number; // total nodes in the graph (agents + gates + output)
  agentChain: string[]; // ordered agent-node codes → the glyph preview
  modulesTouched: string[]; // distinct short module labels the chain spans
  lastRun: LastRun | null; // latest persisted run (incl. AWAITING_APPROVAL)
}
export interface WorkflowGroup {
  moduleKey: string;
  module: string;
  count: number;
  workflows: WorkflowRow[];
}
export interface WorkflowsRollup {
  total: number;
  active: number;
  runs: number; // total persisted runs
  agentsOrchestrated: number; // distinct agent codes across every chain
}
export interface WorkflowsData {
  groups: WorkflowGroup[];
  rollup: WorkflowsRollup;
}

const WORKFLOW_SELECT = {
  id: true,
  moduleKey: true,
  name: true,
  description: true,
  status: true,
  steps: true,
  runs: {
    orderBy: { startedAt: "desc" },
    take: 1,
    select: { status: true, startedAt: true },
  },
} as const;

function shape(w: {
  id: string;
  moduleKey: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  steps: unknown;
  runs: { status: RunStatus; startedAt: Date }[];
}): WorkflowRow {
  const parsed = safeParseGraph(w.steps);
  const nodes = parsed.success ? parsed.data.nodes : [];
  const agentChain = nodes
    .filter(
      (n): n is Extract<typeof n, { type: "agent" }> => n.type === "agent",
    )
    .map((n) => n.agentCode);

  // modules the chain touches: the workflow's own module first, then each agent
  // node's module (canonicalised + deduped, in order).
  const seen = new Set<string>();
  const modulesTouched: string[] = [];
  for (const key of [w.moduleKey, ...agentChain.map(moduleOfCode)]) {
    const short = shortOf(key);
    if (!seen.has(short)) {
      seen.add(short);
      modulesTouched.push(short);
    }
  }

  const run = w.runs[0];
  return {
    id: w.id,
    moduleKey: w.moduleKey,
    name: w.name,
    description: w.description,
    status: w.status,
    stepCount: nodes.length,
    agentChain,
    modulesTouched,
    lastRun: run ? { status: run.status, at: run.startedAt } : null,
  };
}

/**
 * The Workflows list (WFL.1 screen): workflows grouped module-separated, each
 * with its agent-chain preview, step count, modules touched, status, and last
 * run, plus a rollup. Org-scoped and read-only.
 */
export async function getWorkflowsData(orgId: string): Promise<WorkflowsData> {
  const rows = await dbForOrg(orgId).workflow.findMany({
    orderBy: { name: "asc" },
    take: WORKFLOW_CAP,
    select: WORKFLOW_SELECT,
  });
  const workflows = rows.map(shape);

  const byModule = new Map<string, WorkflowRow[]>();
  for (const w of workflows) {
    const list = byModule.get(w.moduleKey) ?? [];
    list.push(w);
    byModule.set(w.moduleKey, list);
  }
  const groups: WorkflowGroup[] = [...byModule.entries()]
    .map(([moduleKey, ws]) => ({
      moduleKey,
      module: moduleLabel(moduleKey),
      count: ws.length,
      workflows: ws,
    }))
    .sort((a, b) => a.module.localeCompare(b.module));

  const agents = new Set<string>();
  for (const w of workflows) for (const c of w.agentChain) agents.add(c);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const runs = await dbForOrg(orgId).workflowRun.count({
    where: { startedAt: { gte: since } },
  });

  return {
    groups,
    rollup: {
      total: workflows.length,
      active: workflows.filter((w) => w.status === "ACTIVE").length,
      runs,
      agentsOrchestrated: agents.size,
    },
  };
}

/** Paginated workflow list (read-only), optionally filtered by module / status. */
export async function listWorkflows(
  orgId: string,
  opts: {
    moduleKey?: string;
    status?: string;
    cursor?: string;
    take?: number;
  } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).workflow.findMany({
    where: {
      ...(opts.moduleKey ? { moduleKey: opts.moduleKey } : {}),
      ...(opts.status ? { status: opts.status as WorkflowStatus } : {}),
    },
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: WORKFLOW_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map(shape), nextCursor };
}

// ---------------------------------------------------------------------------
// WFL.2 — Workflow detail (build-spec §4.6). The parsed step-flow + the ordered
// runs with their persisted traces, so the detail screen renders the flow canvas
// (trigger → agents → gates → output) and replays a run's trace through the
// TraceConsole. Read-only; running a workflow goes through WF.1's RBAC-gated
// enqueue API (guardrail gates park AWAITING_APPROVAL — never auto-executed).
// /// RBAC.4: approval/resume state machine. /// AUDIT.3: immutable run record.
// /// WF.2: live SSE streaming of an in-flight run replaces the replay-on-refetch.
// ---------------------------------------------------------------------------

export type StepKind =
  | "trigger"
  | "agent"
  | "decision"
  | "guardrail"
  | "output";
export interface WorkflowStep {
  id: string;
  kind: StepKind;
  title: string;
  module?: string; // short label (agent steps)
  action: string;
  branches?: string[]; // decision-gate branch labels
}
export interface DetailRun {
  id: string;
  status: RunStatus;
  at: Date;
  endedAt: Date | null;
  trace: TraceLine[];
}
export interface WorkflowDetail {
  id: string;
  moduleKey: string;
  module: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  triggerEvent: string;
  steps: WorkflowStep[];
  stats: {
    stepCount: number;
    moduleCount: number;
    avgRunMs: number | null;
    runs: number;
  };
  runs: DetailRun[]; // ordered newest-first
  latestRun: DetailRun | null;
}

/** One workflow's parsed step-flow + its runs (with traces). Org-scoped. */
export async function getWorkflowDetail(
  orgId: string,
  workflowId: string,
): Promise<WorkflowDetail | null> {
  const wf = await dbForOrg(orgId).workflow.findFirst({
    where: { id: workflowId },
    select: {
      id: true,
      moduleKey: true,
      name: true,
      description: true,
      status: true,
      steps: true,
      runs: {
        orderBy: { startedAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          trace: true,
        },
      },
    },
  });
  if (!wf) return null;

  const parsed = safeParseGraph(wf.steps);
  const graph = parsed.success ? parsed.data : null;

  const steps: WorkflowStep[] = [];
  if (graph) {
    steps.push({
      id: graph.trigger.id,
      kind: "trigger",
      title: graph.trigger.event,
      action: "Event that starts the orchestration.",
    });
    for (const n of graph.nodes) {
      if (n.type === "agent") {
        steps.push({
          id: n.id,
          kind: "agent",
          title: n.agentCode,
          module: shortOf(moduleOfCode(n.agentCode)),
          action: n.action,
        });
      } else if (n.type === "gate") {
        if (n.kind === "guardrail") {
          steps.push({
            id: n.id,
            kind: "guardrail",
            title: "Approval gate",
            action:
              "Money/safety/contract action — proposes and parks for human approval (RBAC.4); never auto-executed.",
          });
        } else {
          steps.push({
            id: n.id,
            kind: "decision",
            title: "Decision gate",
            action: n.condition
              ? `Branch on ${n.condition.field} ${n.condition.op} ${JSON.stringify(n.condition.value)}.`
              : "Branch on the run context.",
            branches: [
              `onTrue → ${n.onTrue ?? "—"}`,
              `onFalse → ${n.onFalse ?? "—"}`,
            ],
          });
        }
      } else {
        steps.push({
          id: n.id,
          kind: "output",
          title: n.label,
          action: "Terminal outcome of this branch.",
        });
      }
    }
  }

  const moduleShorts = new Set<string>([shortOf(wf.moduleKey)]);
  for (const s of steps) if (s.module) moduleShorts.add(s.module);

  const runs: DetailRun[] = wf.runs.map((r) => ({
    id: r.id,
    status: r.status,
    at: r.startedAt,
    endedAt: r.endedAt,
    trace: (r.trace as unknown as TraceLine[]) ?? [],
  }));
  const completed = runs.filter((r) => r.endedAt);
  const avgRunMs = completed.length
    ? completed.reduce(
        (n, r) =>
          n + (new Date(r.endedAt!).getTime() - new Date(r.at).getTime()),
        0,
      ) / completed.length
    : null;

  return {
    id: wf.id,
    moduleKey: wf.moduleKey,
    module: moduleLabel(wf.moduleKey),
    name: wf.name,
    description: wf.description,
    status: wf.status,
    triggerEvent: graph?.trigger.event ?? "",
    steps,
    stats: {
      stepCount: graph?.nodes.length ?? 0,
      moduleCount: moduleShorts.size,
      avgRunMs,
      runs: runs.length,
    },
    runs,
    latestRun: runs[0] ?? null,
  };
}
