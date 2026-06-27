# PRD: ART.1 — AgentRuntime (Claude tool-use loop)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: L (5 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: ART.1 (E3 Platform · Track: Platform) · build-spec §5
**Mode**: Full CPRD (THE MOAT — the runtime every agent surface depends on; held to the moat invariants)

---

## Problem Statement

Axona's moat is the intelligence layer: specialized agents that **assemble context → propose an action →
get a human approval → execute → log → learn**, under guardrails, per tenant. None of that exists yet —
the seed has 90 agent rows, but they're inert data. This story builds the `AgentRuntime`: a Claude
tool-use loop where an agent is `{ systemPrompt, tools[], scope }`, every step is captured as a persisted
trace (`AgentRun`), tools are typed and tenant-scoped, and money/safety/contract tools **propose rather
than auto-execute**. It's invisible on screen but it's what makes the Agents chat (ART.4), the Command
Center copilot (GA.1), and Workflows (WF.1) real — built once here, with the moat invariants baked in
from the start (CLAUDE.md "Architecture spine & moat invariants").

## Success Metrics

| Metric | Target |
|---|---|
| A tool-use loop that calls Claude, executes tool calls, and returns a final answer | works end-to-end |
| Every run persisted as an `AgentRun` with `input · trace · model · status` | 100% of runs |
| Tools are Zod-validated and tenant-scoped via `dbForOrg(orgId)` | 100% |
| Gated (money/safety/contract) tools **never auto-execute** — they emit a proposal | enforced, tested |
| Deterministic verification without an API key (injectable model client) | `pnpm verify:art-1` green offline |
| Per-tenant isolation in tool execution | 0 cross-tenant access |
| Typecheck | `tsc --noEmit` clean (workspace + root) |

## User Stories

- As a **developer (ART.4 / GA.1 / WF.1)**, I want `runAgent(agentId, input, ctx)` that runs the loop and
  returns `{ text, trace, runId }`, so I can wire chat, the copilot, and workflows on one engine.
- As a **platform engineer**, I want every run logged as an `AgentRun` with model + trace + status so the
  trace console (ART.5) and audit (AUDIT.3) have a real record.
- As a **buyer/security reviewer (eventually)**, I want money/safety/contract actions to be *proposed*,
  never auto-executed — "AI proposes, human approves" enforced in code, not prose.
- As a **tool author (ART.2)**, I want a typed `Tool` contract (Zod in/out, scoped `ctx`) so the full
  registry plugs into this runtime without touching the loop.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `AgentRuntime` — the tool-use loop over Claude (Anthropic SDK), capped at N turns | P0 | `packages/agents` |
| R2 | `ModelClient` interface (DI) with a real Anthropic impl + a `FakeModelClient` for tests | P0 | makes the loop testable offline |
| R3 | `Tool` contract: `{ name, description, inputSchema (Zod), gated?, handler(input, ctx) }` | P0 | the ART.2 plug point |
| R4 | `AgentContext`: `orgId`, `userId`, `agentId`, scoped `db = dbForOrg(orgId)`, a `trace` collector | P0 | every tool runs tenant-scoped |
| R5 | Persist each run as `AgentRun` (`input`, `trace` = timestamped lines, `status`, model on the trace) | P0 | §3.2 AgentRun |
| R6 | Trace lines typed: `scan · correlate · draft · policy-check · tool · tool-result · result` (+ optional `confidence`) | P0 | feeds ART.5 console + AUDIT.3 |
| R7 | Gating: a tool marked `gated: true` (money/safety/contract) does NOT execute — the runtime records a **proposal** (`AWAITING_APPROVAL`) instead | P0 | guardrails.config invariant |
| R8 | Tool-permission hook `canUseTool(role, tool)` — permissive default, the RBAC.3 seam | P0 | don't fully build RBAC here |
| R9 | A small set of example **read-only** tools to prove the loop (e.g. `searchOperations`, `getPartStatus`, `listOpenNcrs`) | P0 | full registry is ART.2 |
| R10 | Model name from env (`ANTHROPIC_MODEL`), never hardcoded stale; key from `ANTHROPIC_API_KEY` | P0 | `.env.example` |
| R11 | `verify-art-1.ts` (uses `FakeModelClient`, no API key) + `docs/manual-checks.md` (a real run) | P0 | DoD |

## Acceptance Criteria

- [ ] `runAgent(agentId, input, ctx)` runs: build messages → call model → if `tool_use`, execute the tool(s) via their handlers and feed `tool_result` back → loop until a final text or the turn cap → return `{ text, trace, runId }`.
- [ ] The loop is driven by an injected `ModelClient`; `FakeModelClient` can script "emit tool_use, then final text" so the whole path is exercised with no network/API key.
- [ ] Each tool's `input` is parsed with its Zod schema before the handler runs; invalid input is caught and recorded as a trace error, not a crash (try/catch per tool call).
- [ ] Every tool handler receives `ctx.db = dbForOrg(ctx.orgId)`; a tool cannot read another tenant's rows (tested with two orgs).
- [ ] A `gated: true` tool is **not** executed by the loop; instead the run records a proposal trace line + `status` reflecting awaiting-approval, and returns the proposal (the human-approval state machine is RBAC.4/AUDIT.3).
- [ ] Each run persists an `AgentRun` row: `input`, `trace` (typed lines incl. the model used), `status` (`SUCCEEDED`/`FAILED`/awaiting), `agentId`.
- [ ] The turn cap prevents infinite tool loops; exceeding it ends the run `FAILED` with a clear trace line.
- [ ] `ANTHROPIC_MODEL` + `ANTHROPIC_API_KEY` read from env; no hardcoded model string in code.
- [ ] `pnpm verify:art-1` green offline; `pnpm typecheck` (workspace + root) clean; committed + pushed.

## Technical Requirements

### Package layout — `packages/agents/src/`

```
runtime/
  model-client.ts     // ModelClient interface + AnthropicModelClient + FakeModelClient
  types.ts            // Tool, AgentDef, AgentContext, TraceLine, RunResult
  trace.ts            // TraceCollector (push typed lines, timestamps)
  runtime.ts          // AgentRuntime: the loop
  run-agent.ts        // runAgent(agentId, input, ctx) — loads the Agent, builds ctx, persists AgentRun
tools/
  index.ts            // example read-only tools (full registry is ART.2)
index.ts              // exports
```

### Model client (DI) — `model-client.ts`

```ts
export interface ModelMessage { role: "user" | "assistant"; content: any; }
export interface ModelToolSpec { name: string; description: string; input_schema: object; }
export interface ModelResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  text: string;                          // concatenated text blocks
  toolUses: { id: string; name: string; input: unknown }[];
  model: string;
}
export interface ModelClient {
  createMessage(args: { system: string; messages: ModelMessage[]; tools: ModelToolSpec[] }): Promise<ModelResponse>;
}

// Real impl wraps @anthropic-ai/sdk; model + key from env.
export class AnthropicModelClient implements ModelClient {
  constructor(
    private model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",  // configurable; confirm current name in docs
    private apiKey = process.env.ANTHROPIC_API_KEY,
  ) {}
  async createMessage(args) {
    // const client = new Anthropic({ apiKey: this.apiKey });
    // const res = await client.messages.create({ model: this.model, max_tokens: 1024, system: args.system, messages: args.messages, tools: args.tools });
    // map res.content blocks → { stopReason, text, toolUses, model }
  }
}

// Deterministic, no network — for verify + unit tests.
export class FakeModelClient implements ModelClient {
  constructor(private script: ModelResponse[]) {}
  private i = 0;
  async createMessage() { return this.script[Math.min(this.i++, this.script.length - 1)]; }
}
```

### Tool contract + context — `types.ts`

```ts
import { z } from "zod";
import type { OrgScopedDb } from "@axona/db";

export interface AgentContext {
  orgId: string;
  userId: string;
  agentId: string;
  db: OrgScopedDb;            // = dbForOrg(orgId) — every tool is tenant-scoped
  trace: TraceCollector;
}

export interface Tool<I = any, O = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  gated?: boolean;           // money/safety/contract — propose, never auto-execute
  handler: (input: I, ctx: AgentContext) => Promise<O>;
}

export type TraceKind = "scan" | "correlate" | "draft" | "policy-check" | "tool" | "tool-result" | "result" | "error" | "proposal";
export interface TraceLine { ts: string; kind: TraceKind; text: string; data?: unknown; confidence?: number; }

export interface AgentDef { systemPrompt: string; tools: Tool[]; scope: string; }
export interface RunResult { runId: string; text: string; trace: TraceLine[]; status: "SUCCEEDED" | "FAILED" | "AWAITING_APPROVAL"; }
```

### The loop — `runtime.ts`

```ts
const MAX_TURNS = 8;

export async function runLoop(def: AgentDef, input: string, ctx: AgentContext, model: ModelClient): Promise<{ text: string; status: RunResult["status"] }> {
  const toolSpecs = def.tools.map((t) => ({ name: t.name, description: t.description, input_schema: zodToJsonSchema(t.inputSchema) }));
  const messages: ModelMessage[] = [{ role: "user", content: input }];
  ctx.trace.push("scan", `agent ${ctx.agentId} · scope ${def.scope}`);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await model.createMessage({ system: def.systemPrompt, messages, tools: toolSpecs });
    ctx.trace.push("correlate", `model ${res.model} · stop ${res.stopReason}`, { model: res.model });

    if (res.stopReason !== "tool_use") {
      ctx.trace.push("result", res.text);
      return { text: res.text, status: "SUCCEEDED" };
    }

    messages.push({ role: "assistant", content: assistantBlocks(res) });
    const toolResults: any[] = [];
    for (const call of res.toolUses) {
      const tool = def.tools.find((t) => t.name === call.name);
      if (!tool) { ctx.trace.push("error", `unknown tool ${call.name}`); toolResults.push(toolError(call.id, "unknown tool")); continue; }

      // permission seam (RBAC.3 enforces later)
      if (!canUseTool(ctx, tool)) { ctx.trace.push("policy-check", `denied ${tool.name} for role`); toolResults.push(toolError(call.id, "not permitted")); continue; }

      // gating: money/safety/contract → propose, do NOT execute
      if (tool.gated) {
        ctx.trace.push("proposal", `proposed ${tool.name} (awaiting human approval)`, call.input);
        return { text: `Proposed ${tool.name}; awaiting approval.`, status: "AWAITING_APPROVAL" };
      }

      const parsed = tool.inputSchema.safeParse(call.input);
      if (!parsed.success) { ctx.trace.push("error", `invalid input for ${tool.name}: ${parsed.error.message}`); toolResults.push(toolError(call.id, "invalid input")); continue; }

      ctx.trace.push("tool", `${tool.name}(${JSON.stringify(parsed.data)})`);
      try {
        const out = await tool.handler(parsed.data, ctx);
        ctx.trace.push("tool-result", `${tool.name} ok`, out);
        toolResults.push(toolOk(call.id, out));
      } catch (e) {
        ctx.trace.push("error", `${tool.name} failed: ${(e as Error).message}`);
        toolResults.push(toolError(call.id, "tool error"));
      }
    }
    messages.push({ role: "user", content: toolResults });
  }
  ctx.trace.push("error", `turn cap (${MAX_TURNS}) reached`);
  return { text: "Run exceeded the turn limit.", status: "FAILED" };
}
```

### Entry point — `run-agent.ts`

```ts
export async function runAgent(agentId: string, input: string, opts: { orgId: string; userId: string; model?: ModelClient }): Promise<RunResult> {
  const db = dbForOrg(opts.orgId);
  const agent = await db.agent.findFirst({ where: { id: agentId } });
  if (!agent) throw new Error("agent not found in org");
  const def = buildAgentDef(agent);                 // systemPrompt from agent.role/description; tools by module (ART.2 expands)
  const trace = new TraceCollector();
  const ctx: AgentContext = { orgId: opts.orgId, userId: opts.userId, agentId, db, trace };
  const model = opts.model ?? new AnthropicModelClient();

  let status: RunResult["status"] = "FAILED"; let text = "";
  try { const r = await runLoop(def, input, ctx, model); text = r.text; status = r.status; }
  catch (e) { trace.push("error", (e as Error).message); }

  const run = await db.agentRun.create({ data: { agentId, input: { input }, trace: trace.lines as any, status: status === "AWAITING_APPROVAL" ? "RUNNING" : status } });
  return { runId: run.id, text, trace: trace.lines, status };
}
```

(`AgentRun.status` is the §3.2 `RunStatus` enum `RUNNING|SUCCEEDED|FAILED`; map `AWAITING_APPROVAL` onto
`RUNNING` for now and carry the real proposal state in the trace — the approval state machine + a richer
status are RBAC.4/AUDIT.3. Note this mapping in code.)

### Example tools (read-only) — `tools/index.ts`

Ship 2–3 to prove the loop; the full typed registry (`draftPurchaseOrder`, `openNCR`, `routeTechnician`,
`runSpcCheck`, `recognizeRevenue`, …) is ART.2. Example: `searchOperations` (wraps `@axona/db` `search`),
`getPartStatus({ sku })`, `listOpenNcrs()`. Include one **gated** example stub (e.g. `draftPurchaseOrder`,
`gated: true`) so the gating path is testable without implementing the real mutation.

### Env (`.env.example`)

```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6   # configurable; confirm the current model name at docs.claude.com
```

## UX Flow

```
runAgent(agentId, input, {orgId, userId})
   │  load Agent (scoped) → buildAgentDef(systemPrompt, tools, scope)
   ▼
 ┌────────────── loop (≤ MAX_TURNS) ──────────────┐
 │ model.createMessage(system, messages, tools)   │
 │   stop=end_turn ─► trace"result" ─► SUCCEEDED ──┼─► persist AgentRun
 │   stop=tool_use ─►                              │
 │      for each tool call:                        │
 │        canUseTool? ── no ─► policy-check/deny    │
 │        gated?      ── yes ─► proposal ─► AWAITING ┼─► persist (no execute)
 │        zod parse   ── bad ─► error               │
 │        handler(input, ctx.db=dbForOrg) ─► tool-result
 │      feed tool_results back → next turn          │
 └─────────────── cap reached ─► FAILED ───────────┘
   trace lines: scan · correlate · draft · policy-check · tool · tool-result · proposal · result
```

## Edge Cases

| Case | Handling |
|---|---|
| Model never stops calling tools | `MAX_TURNS` cap → end `FAILED` with a trace line |
| Unknown tool name from model | record error, return a `tool_result` error block, continue |
| Tool input fails Zod | record error trace line, return error result, don't crash the run |
| Tool handler throws | try/catch per tool; record error; the run can still complete |
| Gated tool requested | propose + stop; never execute money/safety/contract |
| Agent not in caller's org | `findFirst` scoped → not found → throw before any model call |
| No `ANTHROPIC_API_KEY` (real client) | `AnthropicModelClient` throws a clear error; verify uses `FakeModelClient` so CI is unaffected |
| Large trace | store as-is for now; truncation/retention is a later concern |
| Concurrent runs | each builds its own `ctx`/`TraceCollector`; no shared mutable state |

## Out of Scope

- The full typed tool registry over the data model (ART.2).
- The module orchestrator + cross-module agent calls (ART.3).
- The SSE chat endpoint + streaming (ART.4) and the trace console wiring (ART.5 — the component exists from FND.13).
- RBAC tool-permission enforcement (RBAC.3) — only the `canUseTool` seam here.
- The approval state machine + immutable event log + model·confidence·approver columns (RBAC.4 / AUDIT.3).
- Calibrated confidence (CONF.1) — the trace carries an optional `confidence` field, uncalibrated.
- BullMQ queueing / workflow DAG (WF.1) — the runtime is transport-agnostic and callable directly.
- Operational memory / context assembly from memory (MEM.1/MEM.2).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.6 Agent/AgentRun models | Done | load agent + persist run |
| FND.11 `dbForOrg` | Done | tenant-scoped tool execution |
| FND.12 seeded agents | Done | real agents to run |
| `@anthropic-ai/sdk` + `zod-to-json-schema` | Add | model calls + tool schemas |

## Implementation Plan

**Day 1** — `ModelClient` interface + `AnthropicModelClient` + `FakeModelClient`; `types.ts`; `TraceCollector`.
**Day 2** — `runLoop` (turn cap, tool dispatch, Zod parse, error handling) with the `FakeModelClient`.
**Day 3** — gating + `canUseTool` seam + `runAgent` (load agent, build ctx, persist `AgentRun`).
**Day 4** — example read-only tools + one gated stub; wire `@anthropic-ai/sdk` real path; env config.
**Day 5** — `verify-art-1` (offline, FakeModelClient) + isolation test + manual-checks (a real keyed run) + commit/push.

## Verification Script

`src/scripts/verify-art-1.ts` — fully offline via `FakeModelClient` (no API key, CI-safe):

```ts
// Run: pnpm verify:art-1
async function run() {
  let passed = 0, failed = 0;
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying ART.1 — AgentRuntime\n");

  const fs = await import("fs");
  await check("runtime files exist", () => ["runtime","types","model-client","trace","run-agent"].every((f) => fs.existsSync(`packages/agents/src/runtime/${f}.ts`)));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { runLoop, FakeModelClient, TraceCollector } = await import("@axona/agents");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });

    // 1. loop: tool_use then final text → SUCCEEDED, trace has tool + result lines
    await check("loop executes a read-only tool then finishes", async () => {
      const fake = new FakeModelClient([
        { stopReason: "tool_use", text: "", model: "fake", toolUses: [{ id: "t1", name: "listOpenNcrs", input: {} }] },
        { stopReason: "end_turn", text: "There is 1 open critical NCR (NCR-118).", model: "fake", toolUses: [] },
      ]);
      const trace = new TraceCollector();
      const ctx = { orgId: org!.id, userId: "u", agentId: "a", db: dbForOrg(org!.id), trace } as any;
      const r = await runLoop(testDef(["listOpenNcrs"]), "any open NCRs?", ctx, fake);
      return r.status === "SUCCEEDED" && trace.lines.some((l: any) => l.kind === "tool") && trace.lines.some((l: any) => l.kind === "result");
    });

    // 2. gating: a gated tool is proposed, NOT executed
    await check("gated tool is proposed, not executed", async () => {
      const fake = new FakeModelClient([{ stopReason: "tool_use", text: "", model: "fake", toolUses: [{ id: "t1", name: "draftPurchaseOrder", input: { sku: "X", qty: 1 } }] }]);
      const trace = new TraceCollector();
      const before = await dbForOrg(org!.id).purchaseOrder.count();
      const ctx = { orgId: org!.id, userId: "u", agentId: "a", db: dbForOrg(org!.id), trace } as any;
      const r = await runLoop(testDef(["draftPurchaseOrder"]), "buy one", ctx, fake);
      const after = await dbForOrg(org!.id).purchaseOrder.count();
      return r.status === "AWAITING_APPROVAL" && after === before && trace.lines.some((l: any) => l.kind === "proposal");
    });

    // 3. turn cap → FAILED
    await check("turn cap ends the run", async () => {
      const loop = { stopReason: "tool_use", text: "", model: "fake", toolUses: [{ id: "t", name: "listOpenNcrs", input: {} }] };
      const fake = new FakeModelClient(Array(20).fill(loop));
      const trace = new TraceCollector();
      const ctx = { orgId: org!.id, userId: "u", agentId: "a", db: dbForOrg(org!.id), trace } as any;
      const r = await runLoop(testDef(["listOpenNcrs"]), "loop", ctx, fake);
      return r.status === "FAILED";
    });

    // 4. persistence: runAgent writes an AgentRun
    await check("runAgent persists an AgentRun with trace + model", async () => {
      const { runAgent } = await import("@axona/agents");
      const agent = await dbForOrg(org!.id).agent.findFirst({});
      const fake = new FakeModelClient([{ stopReason: "end_turn", text: "ok", model: "fake-sonnet", toolUses: [] }]);
      const r = await runAgent(agent!.id, "hi", { orgId: org!.id, userId: "u", model: fake });
      const row = await dbForOrg(org!.id).agentRun.findFirst({ where: { id: r.runId } });
      return !!row && Array.isArray((row!.trace as any));
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

(`testDef`/`buildAgentDef` are test helpers exported for verification; keep the example tools importable.)

## Append to docs/manual-checks.md

```
## ART.1 — AgentRuntime
**Automated**
- `pnpm verify:art-1` — runtime files; offline loop (FakeModelClient): tool exec → SUCCEEDED, gated → proposal (no PO created), turn cap → FAILED, runAgent persists AgentRun.
- `pnpm typecheck` (workspace + root) clean.

**Manual (real model — needs ANTHROPIC_API_KEY + ANTHROPIC_MODEL set, docker up)**
- [ ] In a node script: runAgent(<a procurement agent id>, "is any part below reorder point?", {orgId, userId}) returns a sensible answer and an AgentRun row with a trace (scan/correlate/tool/result).
- [ ] Ask something that would trigger a gated tool ("place a PO for 50 of SKU X") → run status awaits approval, NO PurchaseOrder row created.
- [ ] Confirm the trace records the model name used and timestamps.
- [ ] Two orgs: an agent in org A cannot read org B's rows via any tool.
```

## Common Mistakes to Avoid

1. **Hardcoding the model string** — read `ANTHROPIC_MODEL` from env; model names change, and a stale literal silently breaks calls. Confirm the current name at docs.claude.com.
2. **Letting a gated tool execute** — money/safety/contract tools must propose and stop; never auto-place an order. This is the `guardrails.config` invariant, tested in verify.
3. **No turn cap** — a model that keeps calling tools loops forever; cap and fail cleanly.
4. **Tools using the bare `prisma`** — every tool must use `ctx.db` (`dbForOrg(orgId)`) or it leaks across tenants.
5. **Parsing tool input without Zod** — validate with the tool's schema before the handler; the schema is the contract.
6. **One thrown tool aborting the whole run** — try/catch per tool; record the error in the trace and continue.
7. **Coupling the loop to the Anthropic SDK directly** — go through `ModelClient` so `FakeModelClient` keeps verify offline and CI deterministic.
8. **Storing nothing on failure** — persist the `AgentRun` (with the error trace) even when the run fails.

## Cursor Rules for This Story

- The loop depends on `ModelClient` (DI), never the SDK directly; `FakeModelClient` keeps verify offline.
- Every tool: Zod-validated input, `ctx.db = dbForOrg(orgId)`, try/catch, typed trace lines.
- Gated tools propose, never execute; `canUseTool` is the RBAC.3 seam (permissive now).
- `ANTHROPIC_MODEL`/`ANTHROPIC_API_KEY` from env; no hardcoded model.
- Persist an `AgentRun` for every run (success, failure, or proposal); trace carries the model used.
- Keep ART.2's full registry out — ship only the example read-only tools + one gated stub.

## Rollback Plan

Revert the ART.1 commit (`packages/agents/src/*`, the `@anthropic-ai/sdk`/`zod-to-json-schema` deps, the
`.env.example` additions, verify script). No schema change (uses the existing `AgentRun`); no data
migration. Nothing else imports the runtime yet (ART.4/GA.1/WF.1 are future), so removal is isolated.
Zero data risk.
