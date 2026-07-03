import { z } from "zod";

// WF.1 — the typed DAG schema for `Workflow.trigger` + `Workflow.steps` (§5).
// Single source of truth: the engine and the seed both import + validate against
// these. A workflow is a graph of a trigger + nodes (agent steps, gates, output),
// connected by `next` / `onTrue` / `onFalse` edges.

const OP = z.enum(["lt", "lte", "gt", "gte", "eq", "in"]);
export type GateOp = z.infer<typeof OP>;

const Condition = z.object({
  field: z.string().min(1),
  op: OP,
  value: z.unknown(), // scalar for lt/…/eq; array for `in`
});
export type GateCondition = z.infer<typeof Condition>;

// The trigger points to the first executable node via `next` (the entry edge).
export const TriggerNode = z.object({
  id: z.string().min(1),
  type: z.literal("trigger"),
  event: z.string().min(1), // e.g. "procurement.reorder_point_hit"
  next: z.string().optional(),
});
export type TriggerNode = z.infer<typeof TriggerNode>;

// An agent step: run `agentCode`'s agent with `action` (a registry tool / prompt).
export const AgentNode = z.object({
  id: z.string().min(1),
  type: z.literal("agent"),
  agentCode: z.string().min(1), // resolves to Agent.code (org-scoped)
  action: z.string().min(1),
  next: z.string().optional(),
});
export type AgentNode = z.infer<typeof AgentNode>;

// A gate: `decision` = a data branch (onTrue/onFalse); `guardrail` = a money/
// safety/contract checkpoint — the engine treats it as propose-only and parks
// the run AWAITING_APPROVAL (never auto-executes).
export const GateNode = z.object({
  id: z.string().min(1),
  type: z.literal("gate"),
  kind: z.enum(["decision", "guardrail"]),
  condition: Condition.optional(), // required for decision gates (refined below)
  onTrue: z.string().optional(),
  onFalse: z.string().optional(),
});
export type GateNode = z.infer<typeof GateNode>;

export const OutputNode = z.object({
  id: z.string().min(1),
  type: z.literal("output"),
  label: z.string().min(1),
});
export type OutputNode = z.infer<typeof OutputNode>;

export const WorkflowNode = z.discriminatedUnion("type", [
  AgentNode,
  GateNode,
  OutputNode,
]);
export type WorkflowNode = z.infer<typeof WorkflowNode>;

export const WorkflowGraph = z
  .object({
    trigger: TriggerNode,
    nodes: z.array(WorkflowNode).min(1),
  })
  .superRefine((g, ctx) => {
    const ids = new Set(g.nodes.map((n) => n.id));
    if (ids.size !== g.nodes.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate node id",
      });

    const ref = (target: string | undefined, where: string) => {
      if (target != null && !ids.has(target))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown node ref "${target}" from ${where}`,
        });
    };
    ref(g.trigger.next, `trigger ${g.trigger.id}`);
    for (const n of g.nodes) {
      if (n.type === "agent") ref(n.next, `agent ${n.id}`);
      if (n.type === "gate") {
        ref(n.onTrue, `gate ${n.id}.onTrue`);
        ref(n.onFalse, `gate ${n.id}.onFalse`);
        // A decision gate must be able to branch on data.
        if (n.kind === "decision" && (!n.condition || !n.onTrue || !n.onFalse))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `decision gate ${n.id} needs condition + onTrue + onFalse`,
          });
      }
    }
  });
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;

/** Parse + validate `Workflow.steps` (throws on a malformed graph). */
export function parseGraph(steps: unknown): WorkflowGraph {
  return WorkflowGraph.parse(steps);
}

/** Non-throwing validation (for verify / authoring checks). */
export function safeParseGraph(steps: unknown) {
  return WorkflowGraph.safeParse(steps);
}

/** Evaluate a decision-gate condition against the accumulated run context. */
export function evalCondition(
  cond: GateCondition,
  context: Record<string, unknown>,
): boolean {
  const a = context[cond.field];
  const b = cond.value;
  switch (cond.op) {
    case "lt":
      return typeof a === "number" && typeof b === "number" && a < b;
    case "lte":
      return typeof a === "number" && typeof b === "number" && a <= b;
    case "gt":
      return typeof a === "number" && typeof b === "number" && a > b;
    case "gte":
      return typeof a === "number" && typeof b === "number" && a >= b;
    case "eq":
      return a === b;
    case "in":
      return Array.isArray(b) && b.includes(a);
    default:
      return false;
  }
}
