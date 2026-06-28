# PRD: ART.2 — Typed tool registry over the data model

**Status**: Ready for Dev
**Priority**: P0
**Effort**: L (5 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: ART.2 (E3 Platform · Track: Platform) · build-spec §5
**Mode**: Full CPRD (moat-load-bearing — the agents' hands; the propose/draft/gated split is the guardrail made real)

---

## Problem Statement

ART.1 ships the runtime and a couple of example read-only tools. Agents can reason but can't *do* the
domain work — there's no `draftPurchaseOrder`, `openNCR`, `runSpcCheck`, `recognizeRevenue`. This story
builds the typed tool registry: the functions agents call to read and act on the data model, organized by
module, each Zod-typed and tenant-scoped, with the **propose / draft / gated** split that makes "AI
drafts, human approves" literal — agents can *draft* and *open* freely, but money/safety/contract actions
(send a PO, release an ECO, roll back a policy, issue a credit) are **gated** and only ever proposed.

## Success Metrics

| Metric | Target |
|---|---|
| A tool registry mapping module → tools; `buildAgentDef(agent)` assembles the right tools per agent | works |
| Every tool is Zod-typed (in/out), tenant-scoped via `ctx.db`, and categorized read / draft / gated | 100% |
| Draft tools create DRAFTED/proposed records autonomously; gated tools never auto-execute (ART.1 gate) | enforced |
| A meaningful tool set for the wedge + adjacent modules (Procurement, Quality, Engineering, Field Service, Finance, Inventory) | shipped |
| Offline verification (FakeModelClient) + real handler tests against seeded data | `pnpm verify:art-2` green |
| Per-tenant isolation across every tool | 0 cross-tenant access |

## User Stories

- As a **sourcing agent**, I can read a part's status and *draft* a PO when it's below reorder point — but
  I cannot *send* it; that's proposed for human approval.
- As an **SPC/quality agent**, I can run an SPC check and *open an NCR* when a measurement breaches control
  limits.
- As a **developer (ART.4/GA.1/WF.1)**, I want `buildAgentDef(agent)` to return an agent wired with the
  right tools for its module/role, so chat and workflows just run it.
- As a **security reviewer**, I want gated tools (send PO, release ECO, rollback policy, credit note) to be
  un-runnable by the autonomous loop — proposals only.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | A `ToolRegistry`: tools grouped by module + a `coreTools` set; lookup by name | P0 | `packages/agents/src/tools` |
| R2 | Three tool categories: **read** (queries), **draft** (create DRAFTED/proposed records — non-gated), **gated** (money/safety/contract — `gated: true`) | P0 | the guardrail model |
| R3 | `buildAgentDef(agent)` assembles `{ systemPrompt, tools, scope }` from the agent's `moduleKey`/`role` (core agent → cross-module read tools) | P0 | replaces the ART.1 stub |
| R4 | Tool set — Procurement: `getPartStatus`, `listReorderCandidates`, `draftPurchaseOrder` (→DRAFTED), `sendPurchaseOrder` (**gated**), `getSupplierRisk` | P0 | the wedge |
| R5 | Tool set — Quality: `runSpcCheck`, `listOpenNcrs`, `openNcr` (draft), `getCertStatus` | P0 | |
| R6 | Tool set — Engineering: `getEco`, `draftEco` (draft), `releaseEco` (**gated**), `getCompatMatrix` | P1 | |
| R7 | Tool set — Field Service: `getWorkOrder`, `findCertifiedTech`, `routeTechnician` (draft assignment), `getSlaCountdown` | P1 | |
| R8 | Tool set — Finance: `getUnitEconomics`, `getArAging`, `recognizeRevenue` (**gated**), `issueCreditNote` (**gated**) | P1 | |
| R9 | Tool set — Inventory + core: `getStock`, `searchOperations` (cross-module FTS via SRCH), `getModuleSummary` | P1 | core agent reads |
| R10 | Every gated tool, if ever invoked outside the autonomous loop (human-approved path), writes through the approval state machine seam (RBAC.4) — for now its handler is defined but the loop never calls it | P0 | propose→approve→audit |
| R11 | `verify-art-2.ts` (offline loop + real read/draft handlers on seeded data; gated proves no side-effect) + `docs/manual-checks.md`; `tsc` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `ToolRegistry` exposes tools by module + core; `buildAgentDef(agent)` returns an agent wired with its module's tools (a Procurement agent gets the Procurement set + core reads).
- [ ] Every tool: Zod `inputSchema`, typed output, `ctx.db` (`dbForOrg`) access, a category (read/draft/gated), and `gated: true` on money/safety/contract.
- [ ] A **read** tool (e.g. `listReorderCandidates`) returns real rows from the seeded demo org.
- [ ] A **draft** tool (e.g. `draftPurchaseOrder`) creates a PO in `DRAFTED` status (proposing is the agent's job; this is safe and non-gated) and is reflected in the trace.
- [ ] A **gated** tool (e.g. `sendPurchaseOrder`) is never executed by the autonomous loop — ART.1's gate proposes it; the verify proves no `SENT` PO is created from an autonomous run.
- [ ] Every tool runs tenant-scoped; a tool invoked in org A cannot touch org B's rows (tested).
- [ ] `pnpm verify:art-2` green offline (FakeModelClient + real handlers on the seeded DB); `tsc` clean; committed + pushed.

## Technical Requirements

### Registry shape — `packages/agents/src/tools/`

```
tools/
  registry.ts        // ToolRegistry: byModule + core; getToolsForAgent(agent)
  core.ts            // searchOperations, getModuleSummary (cross-module reads)
  procurement.ts     // getPartStatus, listReorderCandidates, draftPurchaseOrder, sendPurchaseOrder (gated), getSupplierRisk
  quality.ts         // runSpcCheck, listOpenNcrs, openNcr, getCertStatus
  engineering.ts     // getEco, draftEco, releaseEco (gated), getCompatMatrix
  field-service.ts   // getWorkOrder, findCertifiedTech, routeTechnician, getSlaCountdown
  finance.ts         // getUnitEconomics, getArAging, recognizeRevenue (gated), issueCreditNote (gated)
  inventory.ts       // getStock
  index.ts
```

### Tool category model

```ts
// extends the ART.1 Tool contract
export type ToolCategory = "read" | "draft" | "gated";
export interface Tool<I = any, O = any> {
  name: string;
  description: string;          // tells the model when to use it
  category: ToolCategory;       // read | draft | gated
  gated?: boolean;              // === (category === "gated"); ART.1 gate keys on this
  inputSchema: z.ZodType<I>;
  outputSchema?: z.ZodType<O>;
  handler: (input: I, ctx: AgentContext) => Promise<O>;
}
```

- **read** — pure queries via `ctx.db`. Run in-loop freely.
- **draft** — create *not-yet-final* records (PO `DRAFTED`, a new `NCR`, a draft `ECO`, a proposed tech
  assignment). This is the agent's drafting job — safe, reversible, non-gated. The model can call them.
- **gated** — the irreversible money/safety/contract action (`sendPurchaseOrder`, `releaseEco`,
  `rollbackPolicy`, `recognizeRevenue`, `issueCreditNote`). `gated: true` → ART.1's loop **proposes and
  stops**; the handler exists for the human-approved path (RBAC.4) but the autonomous loop never invokes it.

> The line: **drafting/opening is allowed; placing/releasing/paying is gated.** "Never auto-place an
> order" = `sendPurchaseOrder` is gated; `draftPurchaseOrder` (→ DRAFTED) is not.

### Representative tools

```ts
// procurement.ts
export const listReorderCandidates: Tool = {
  name: "listReorderCandidates", category: "read",
  description: "Parts at or below their reorder point.",
  inputSchema: z.object({}),
  handler: async (_in, ctx) => ctx.db.part.findMany({ where: { onHand: { lte: ctx.db.part.fields?.reorderPoint as any } } })
    // (use a raw/compare query: onHand <= reorderPoint)
};

export const draftPurchaseOrder: Tool = {
  name: "draftPurchaseOrder", category: "draft",
  description: "Draft a purchase order (status DRAFTED) for a part from a supplier. Does NOT send it.",
  inputSchema: z.object({ partId: z.string(), supplierId: z.string(), qty: z.number().int().positive() }),
  handler: async (i, ctx) => ctx.db.purchaseOrder.create({ data: { code: genCode("PO"), partId: i.partId, supplierId: i.supplierId, qty: i.qty, value: 0, status: "DRAFTED", draftedByAgentId: ctx.agentId } }),
};

export const sendPurchaseOrder: Tool = {
  name: "sendPurchaseOrder", category: "gated", gated: true,
  description: "Send/place a drafted purchase order with a supplier (commits spend).",
  inputSchema: z.object({ poId: z.string() }),
  // Handler is the human-approved path (RBAC.4). The autonomous loop NEVER calls this — ART.1 proposes it.
  handler: async (i, ctx) => ctx.db.purchaseOrder.update({ where: { id: i.poId, orgId: ctx.orgId }, data: { status: "SENT" } }),
};
```

(Apply the same pattern across modules. `runSpcCheck` reads `SpcSample` and flags UCL/LCL breaches;
`openNcr` drafts an NCR; `releaseEco` is gated; `recognizeRevenue`/`issueCreditNote` are gated.)

### Agent assembly — `buildAgentDef(agent)`

```ts
export function buildAgentDef(agent: { moduleKey: string; role: string; description: string }): AgentDef {
  const moduleTools = registry.byModule[agent.moduleKey] ?? [];
  const tools = agent.moduleKey === "core"
    ? registry.coreReadTools()                      // the Axona agent: cross-module reads only
    : [...moduleTools, ...registry.coreReadTools()]; // module agent: its tools + core reads
  return {
    systemPrompt: systemPromptFor(agent),            // role + description + "propose, don't place; cite"
    tools,
    scope: agent.moduleKey,
  };
}
```

The core/Axona agent gets **read-only cross-module** tools (it reads everything, acts on nothing
directly — it routes/cites). Module agents get their module's draft/gated tools plus core reads.

## UX Flow

```
buildAgentDef(agent) ─► tools = module set + core reads
   │
runLoop (ART.1) ─► model wants a tool
   read  ──► run handler (ctx.db) ──► tool-result ──► continue
   draft ──► run handler ──► creates DRAFTED/NCR/draft-ECO ──► tool-result ──► continue
   gated ──► PROPOSE + stop (handler NOT called) ──► AWAITING_APPROVAL ──► human approves later (RBAC.4)
```

## Edge Cases

| Case | Handling |
|---|---|
| Draft tool called with a part/supplier not in the org | scoped `ctx.db` → not found → handler throws → trace error, run continues |
| Gated tool reached autonomously | proposed + stop; handler never runs; no side effect (tested) |
| `onHand <= reorderPoint` comparison | Prisma can't compare two columns directly — use `$queryRaw` or fetch+filter; document |
| Unknown module agent | falls back to core read tools only (never zero tools) |
| Tool output large | return summarized/limited rows (cap list tools, e.g. take 50) |
| Two orgs | every handler uses `ctx.db`; cross-tenant access impossible (tested) |
| A draft creates duplicate records on retry | draft tools generate a fresh code; idempotency is a workflow concern (WF.1), noted |

## Out of Scope

- The module orchestrator + cross-module agent-to-agent calls (ART.3).
- The chat SSE endpoint (ART.4) and trace console wiring (ART.5).
- The approval state machine that lets a human actually approve a gated proposal (RBAC.4) — gated handlers exist but the approval UI/flow is later.
- Tools for every one of the 24 modules — ship the wedge + adjacent set; remaining modules' tools land with their screens or a follow-up.
- Calibrated confidence (CONF.1), memory-backed context (MEM.2).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| ART.1 runtime + Tool contract + gate | Done | the registry plugs in |
| FND.11 `dbForOrg` | Done | scoped handlers |
| FND.12 seeded data | Done | real rows for read/draft tools |
| SRCH.2 `search` | Done | `searchOperations` core tool |

## Implementation Plan

**Day 1** — registry + category model + `buildAgentDef` + `systemPromptFor` + core read tools.
**Day 2** — Procurement set (read/draft/gated) + the `onHand<=reorderPoint` query.
**Day 3** — Quality + Engineering sets.
**Day 4** — Field Service + Finance + Inventory sets.
**Day 5** — verify-art-2 (offline loop + real handlers + gated-no-side-effect + isolation) + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-art-2.ts` — offline loop via FakeModelClient + real handlers against the seeded DB:

```ts
// Run: pnpm verify:art-2   (data checks require seeded DB)
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying ART.2 — typed tool registry\n");

  await check("registry + module tool files exist", () => ["registry","procurement","quality","engineering","field-service","finance"].every((f) => fs.existsSync(`packages/agents/src/tools/${f}.ts`)));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { buildAgentDef, runLoop, FakeModelClient, TraceCollector, registry } = await import("@axona/agents");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    const db = dbForOrg(org!.id);

    await check("every tool is zod-typed + categorized + scoped", () => registry.all().every((t: any) => t.inputSchema && ["read","draft","gated"].includes(t.category) && (t.category !== "gated" || t.gated === true)));

    await check("buildAgentDef wires module tools for a procurement agent", async () => {
      const a = await db.agent.findFirst({ where: { moduleKey: "procurement" } });
      const def = buildAgentDef(a!);
      return def.tools.some((t: any) => t.name === "draftPurchaseOrder") && def.tools.some((t: any) => t.name === "searchOperations");
    });

    await check("read tool returns seeded rows (reorder candidates)", async () => {
      const tool = registry.byName("listReorderCandidates");
      const ctx = mkCtx(org!.id); const out = await tool.handler({}, ctx);
      return Array.isArray(out);
    });

    await check("draft tool creates a DRAFTED PO (non-gated)", async () => {
      const part = await db.part.findFirst({}); const sup = await db.supplier.findFirst({});
      const before = await db.purchaseOrder.count({ where: { status: "DRAFTED" } });
      const ctx = mkCtx(org!.id);
      await registry.byName("draftPurchaseOrder").handler({ partId: part!.id, supplierId: sup!.id, qty: 5 }, ctx);
      const after = await db.purchaseOrder.count({ where: { status: "DRAFTED" } });
      return after === before + 1;
    });

    await check("gated tool is proposed, NOT executed by the loop (no SENT PO)", async () => {
      const a = await db.agent.findFirst({ where: { moduleKey: "procurement" } });
      const fake = new FakeModelClient([{ stopReason: "tool_use", text: "", model: "fake", toolUses: [{ id: "t", name: "sendPurchaseOrder", input: { poId: "x" } }] }]);
      const before = await db.purchaseOrder.count({ where: { status: "SENT" } });
      const ctx = { orgId: org!.id, userId: "u", agentId: a!.id, db, trace: new TraceCollector() } as any;
      const r = await runLoop(buildAgentDef(a!), "send it", ctx, fake);
      const after = await db.purchaseOrder.count({ where: { status: "SENT" } });
      return r.status === "AWAITING_APPROVAL" && after === before;
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## ART.2 — Typed tool registry
**Automated**
- `pnpm verify:art-2` — registry/files; every tool zod-typed+categorized+scoped; buildAgentDef wiring; read returns rows; draft creates DRAFTED PO; gated proposed-not-executed (no SENT PO); isolation.
- `pnpm typecheck` clean.

**Manual (real key — ANTHROPIC_API_KEY set, docker up)**
- [ ] runAgent(<procurement agent>, "any parts below reorder point? draft POs for them") → drafts DRAFTED POs, cites parts, does NOT send.
- [ ] runAgent(<procurement agent>, "send PO <id> to the supplier") → run awaits approval; no PO moves to SENT.
- [ ] runAgent(<quality agent>, "is the SERVO-204 torque in spec?") → runs SPC check, references NCR-118.
- [ ] Two orgs: a tool in org A never returns/touches org B rows.
```

## Common Mistakes to Avoid

1. **Making draft tools gated** — drafting/opening is the agent's job and must run autonomously; only the irreversible place/release/pay actions are gated. Over-gating makes agents useless.
2. **Letting a gated handler run in the loop** — ART.1's gate stops before the handler; never bypass it. Verify proves no side effect.
3. **Tools using bare `prisma`** — always `ctx.db` (`dbForOrg`); a bare client leaks tenants.
4. **Column-to-column compares in Prisma** (`onHand <= reorderPoint`) — Prisma can't; use `$queryRaw` or fetch+filter.
5. **Unbounded list tools** — cap results (take 50) so the model context doesn't blow up.
6. **No output schema/shape discipline** — return compact, typed results the model can reason over, not raw fat rows.
7. **Forgetting core reads on module agents** — a module agent still needs `searchOperations`/summaries to correlate across modules.

## Cursor Rules for This Story

- Three categories: read (run), draft (create DRAFTED/proposed — non-gated), gated (money/safety/contract — propose only).
- Every tool: Zod input, `ctx.db` scoped handler, a category; `gated: true` ⇔ category gated.
- `buildAgentDef` wires module tools + core reads; the core agent gets cross-module reads only.
- Gated handlers exist for the human-approved path (RBAC.4); the autonomous loop never calls them.
- Cap list results; use `$queryRaw` for column compares; cite sources in tool outputs where relevant.

## Rollback Plan

Revert the ART.2 commit (`packages/agents/src/tools/*`, the `buildAgentDef` replacement, verify script).
ART.1 still runs with its example tools. No schema change; draft tools created only `DRAFTED` rows in the
dev DB (re-seed clears them). Zero production data risk.
