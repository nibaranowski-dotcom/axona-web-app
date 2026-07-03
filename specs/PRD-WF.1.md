# PRD — WF.1 · Workflow DAG model + BullMQ run engine

**Story:** WF.1 — Workflow DAG model + BullMQ run engine (steps, gates, branches).
**Spec ref:** `specs/axona-build-spec.md` §5 (agent runtime & multi-agent architecture); backlog E3 row 34.
**Priority / size:** P0 · L (5 dev-days). **Track:** Platform (E3). **Depth:** Full CPRD (moat-load-bearing).
**Dependencies:** FND.6 (Workflow/WorkflowRun models — landed), FND.11 (`dbForOrg`, migrations — landed),
ART.1/ART.2 (AgentRuntime + typed tool registry — landed), FND.3 (Redis via docker-compose — landed).
**Soft dep — reconciled:** backlog lists ART.3 (module orchestrator) as a dep. ART.3 is **not** landed. WF.1
does not need it: the engine executes agent steps by invoking the existing `runAgent` + `registry`
(ART.1/ART.2) directly. ART.3's cross-module *event routing* layers on later and re-uses this engine. This
PRD proceeds without ART.3 and flags the seam.

**Moat-load-bearing.** This is the workflow spine of the multi-agent layer (§5). Hold to the higher bar:
propose→approve→audit is the product; `guardrails.config` is enforced (never auto-execute money/safety/
contract); every run persists its trace + the model used; per-tenant isolation of data. The learning loop
stays stubbed, but shape the capture correctly now (retrofitting is the top risk).

---

## 1. Context — what already exists (build ON this, do not reinvent)

- **Models (FND.6, `packages/db/prisma/schema.prisma`):**
  - `Workflow { orgId, moduleKey, name, description, status: WorkflowStatus(DRAFT|ACTIVE|PAUSED), trigger: Json, steps: Json, runs[] }`
  - `WorkflowRun { workflowId, status: RunStatus(RUNNING|SUCCEEDED|FAILED), trace: Json, startedAt, endedAt }`
  - `Workflow.steps` is already documented as "ordered nodes: agent steps, decision gates, output".
  - `WorkflowRun.trace` is already documented as the freeform run trace (scan/correlate/draft/policy-check/result); the immutable-event-log + `confidence` + `approver` columns are explicitly deferred to ONT.1/CONF.1/AUDIT.3 — **do not add them here.**
- **Agent runtime (ART.1/ART.2, `packages/agents`):** `runAgent`, `runLoop`, `canUseTool`, `TraceCollector`,
  `TraceLine`/`TraceKind`, `registry`, `buildAgentDef`, per-module tool sets, `ModelClient` DI with
  `AnthropicModelClient` + `FakeModelClient` (offline/deterministic). Money/safety/contract tools already
  **propose, never auto-execute.**
- **Worker (`apps/worker/src/index.ts`):** a stub whose own comment says "queues wired in WF.1". This is the
  home for the BullMQ queue + DAG executor.
- **Screen renderer:** `apps/web/components/shell/TraceConsole.tsx` exists — WFL.2 will render `WorkflowRun.trace`
  through it. WF.1 only needs to **persist** a well-shaped trace; live SSE streaming is WF.2.

## 2. Goals

1. A **typed DAG schema** for `Workflow.steps` + `Workflow.trigger` (Zod), covering trigger · agent step ·
   decision gate · guardrail/approval gate · output nodes, with branches.
2. A **run engine** in `apps/worker` on **BullMQ (Redis)** that: consumes a run job, walks the DAG from the
   trigger, executes agent nodes via `runAgent`, evaluates gate nodes, and **persists a `WorkflowRun`** with
   an incrementally-built `trace`, correct `status`, and `startedAt`/`endedAt`.
3. **Propose-not-execute at guardrail/approval gates** — a node that would perform a money/safety/contract
   action emits a "proposed — AWAITING_APPROVAL (RBAC.4)" trace line and **halts that branch**; the run parks
   in `AWAITING_APPROVAL`. No auto-execution, ever.
4. An **enqueue API** (`POST /api/workflows/:id/run`) that RBAC-checks the caller, enqueues the job, returns
   the `runId`.
5. **Seed** enough workflows + at least one **completed run** per a couple of them so WFL.1/WFL.2 render
   populated (the seeded/replayable run — matches how every screen renders seeded agent traces today).

## 3. Non-goals (explicit — do not build here)

- **Live SSE streaming** of an in-flight run → WF.2. WF.1 persists the full trace; the screen replays it.
- **Decision-gate DSL hardening** (e.g. `<$50k auto-route else escalate` as a rich expression language) → WF.2.
- **Guardrail gate tools as first-class DAG nodes / approval resume** → WF.3 + RBAC.4. WF.1 parks the run at
  the gate; RBAC.4 later resumes it.
- **ART.3 module-orchestrator event routing** (auto-triggering workflows from module events). WF.1 is triggered
  explicitly via the API.
- **Immutable event log / `confidence` / `approver` columns** → ONT.1/CONF.1/AUDIT.3. Leave `///` seams only.
- Workflow authoring UI (WFL.2 canvas edits) — read/run only for now.

## 4. Data model

Re-use `Workflow` + `WorkflowRun`. **Two bounded schema additions** (tenancy pattern; live migration is fine
post-FND.11) — called out and justified, nothing more:

1. `WorkflowRun.orgId String` + `@@index([orgId])` — the engine writes it; lets run queries org-scope without
   a join and matches the scalar-`orgId` tenancy pattern used everywhere. (`WorkflowRun` currently scopes only
   via `workflowId → Workflow.orgId`.)
2. `enum RunStatus` gains **`AWAITING_APPROVAL`** — a run parked at an approval/guardrail gate is neither
   succeeded nor failed; this mirrors RBAC.4's `AWAITING_APPROVAL` return.

Add `/// RBAC.4` (resume-from-gate) and `/// AUDIT.3` (inputs·output·model·confidence·approver) pointer
comments on `WorkflowRun`. **Do not** add event-log/confidence/approver columns now. `prisma validate` +
`prisma format` clean; run the migration (post-FND.11 live migrations are allowed).

## 5. The DAG schema (Zod — put in `packages/agents/src/workflow/graph.ts`, export from the package)

`Workflow.trigger` and `Workflow.steps` are validated by these Zod schemas (single source of truth; the engine
and the seed both import them):

```
TriggerNode   = { id, type: "trigger", event: string }                    // e.g. "procurement.reorder_point_hit"
AgentNode     = { id, type: "agent", agentCode: string, action: string,   // action = a registry tool name
                  next?: string }
GateNode      = { id, type: "gate", kind: "decision" | "guardrail",
                  condition: { field: string, op: "lt"|"lte"|"gt"|"gte"|"eq"|"in", value: Json },
                  onTrue?: string, onFalse?: string }                      // branch targets (node ids)
OutputNode    = { id, type: "output", label: string }
WorkflowGraph = { trigger: TriggerNode, nodes: (AgentNode|GateNode|OutputNode)[] }
```

- `kind:"decision"` = a data branch (e.g. `value lt 50000 → onTrue else onFalse`).
- `kind:"guardrail"` = a money/safety/contract checkpoint: the engine treats a `true` outcome that would
  execute a gated action as **propose-only** → park `AWAITING_APPROVAL`.
- Reject malformed graphs at validation time (unknown node ids in `next/onTrue/onFalse`, cycles that don't
  terminate, missing trigger).

## 6. Run engine (`apps/worker`)

- **Queue:** BullMQ `Queue("workflow-runs")` on the FND.3 Redis (`REDIS_URL`). Worker consumes
  `{ workflowId, orgId, triggerPayload }`.
- **Executor** (`apps/worker/src/workflow/executor.ts`): load the `Workflow` via `dbForOrg(orgId)`, parse
  `steps` with `WorkflowGraph`, create a `WorkflowRun { orgId, status: RUNNING, trace: [] }`, then walk from
  `trigger`:
  - **agent node:** assemble the agent via `buildAgentDef(agentCode)` + `runAgent({ ..., db: dbForOrg(orgId), model })`;
    append the agent's `TraceLine`s (re-use `TraceCollector`/`TraceLine` — do **not** invent a second trace
    shape) into `WorkflowRun.trace`; follow `next`.
  - **decision gate:** evaluate `condition` against the accumulated run context; append a `policy-check`/gate
    trace line; follow `onTrue`/`onFalse`.
  - **guardrail gate (or any agent action tagged money/safety/contract):** append a
    `proposed — AWAITING_APPROVAL (RBAC.4)` trace line, set `status = AWAITING_APPROVAL`, **halt** — no execution.
  - **output node:** append the final result line; set `status = SUCCEEDED`, `endedAt = now()`.
  - **error:** any throw → `status = FAILED`, `endedAt`, error captured in the trace. Persist trace
    incrementally (so a partial/failed run is still renderable).
- **Model client:** use `AnthropicModelClient` when `ANTHROPIC_API_KEY` is set, else `FakeModelClient`
  (deterministic) — same DI as ART.1. The engine must run to completion offline with `FakeModelClient`.
- **Idempotency & isolation:** job ids keyed so a re-enqueue doesn't double-run; every DB touch goes through
  `dbForOrg(orgId)` — no cross-tenant read/write. One tenant's run never sees another's data.

## 7. API surface (`apps/web`)

- `POST /api/workflows/:id/run` — `requireRole()` (line 1; who-can-run per the workflow's module; VIEWER
  cannot); load the workflow org-scoped; enqueue `{ workflowId, orgId, triggerPayload }`; return `{ runId }`.
- `GET /api/workflows/:id/runs` and `GET /api/workflow-runs/:runId` — org-scoped reads of run status + trace
  (feeds WFL.1/WFL.2). **No** SSE here (WF.2).
- All mutations only through route handlers; `orgId` from the session, never the client.

## 8. Seed (`packages/db/prisma/seed/*`) — richness = mock richness

Idempotent. Seed **workflows across a few modules** with real `WorkflowGraph` steps, tied to the cross-module
through-line, plus **≥1 completed `WorkflowRun`** on a couple of them (so WFL.1 shows last-run status and WFL.2
replays a real trace):

- **Procurement reorder** (the wedge): trigger `reorder_point_hit` → sourcing agent → RFQ agent → decision gate
  `value lt 50000` → (onTrue) reorder agent drafts PO → **guardrail gate → AWAITING_APPROVAL** (PO approve is
  RBAC.4-gated) ; (onFalse) escalate. Seed one run that parks at the approval gate.
- **NCR→ECO** (quality→engineering): trigger `ncr_opened` (NCR-118) → root-cause agent → change agent drafts
  ECO-318 → output. Seed one **SUCCEEDED** run with a full scan→correlate→draft→result trace.
- One more (e.g. fleet predictive-maintenance → field-service dispatch, SN-2196) so WFL.1's module-separated
  list isn't thin.

Each seeded run's `trace` uses the real `TraceLine` shape so `TraceConsole` renders it unchanged.

## 9. Tenancy · RBAC · guardrails · moat invariants (DoD-blocking)

- **Org scoping:** every query via `dbForOrg(orgId)`; `WorkflowRun.orgId` set on create; reads filter by it.
  No cross-tenant leak (isolation of data — ISO.1 invariant).
- **RBAC:** `requireRole()` is line 1 of the run endpoint; agent steps already filter tools by role
  (`canUseTool`, ART.2/RBAC.3) — pass the acting role through.
- **`guardrails.config` enforced:** never auto-place an order / auto-execute a money/safety/contract action;
  the guardrail gate is the enforcement point. Never claim stock without a source / invent a supplier/lead
  time (inherited from the tool layer).
- **Propose→approve→audit:** the run persists model used + full trace; the gate produces the AWAITING_APPROVAL
  state RBAC.4 will resume. `/// AUDIT.3` seam for the immutable inputs·output·model·confidence·approver record.
- **Feeds-the-loop:** the persisted run trace is the substrate the learning loop (LOOP.*) consumes later —
  shape it right now even though the loop is stubbed.

## 10. Verification + gate

- `src/scripts/verify-wf-1.ts` (gated on env like the sibling verifies — skip live checks without
  `DATABASE_URL`/`REDIS_URL`, but always run the pure-logic checks):
  1. `WorkflowGraph` Zod validates a good graph and rejects malformed ones (bad node ref, missing trigger).
  2. Executor runs a seeded workflow end-to-end with `FakeModelClient` and reaches `SUCCEEDED` with a
     non-empty `TraceLine[]` trace.
  3. The procurement-reorder run **parks at the guardrail gate** → `status = AWAITING_APPROVAL`, no PO written
     (assert no mutation to PurchaseOrder beyond a drafted/proposed record).
  4. A forced error yields `status = FAILED` with the partial trace persisted.
  5. Org scoping: a run created for org A is not readable via org B's `dbForOrg`.
  6. Decision gate branches correctly (`value lt 50000` onTrue vs onFalse).
- `docs/manual-checks.md` entry (how to enqueue a run locally + expected trace).
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all`;
  `tsc --noEmit` clean; `verify:all` green (all siblings stay green); then commit + push and confirm the
  GitHub Actions run on `main` is green. The engine must not require live Redis in CI (mirror the DB-gated
  skip: exercise the executor in-process / with an in-memory queue when `REDIS_URL` is unset).

## 11. Review gate

**Stop after WF.1** and show me: (a) the `WorkflowGraph` schema, (b) a completed seeded run's persisted trace,
(c) the procurement-reorder run parked at `AWAITING_APPROVAL` (proof of propose-not-execute), and (d) `verify-wf-1`
output — before continuing to WFL.1.

---

### Completeness check (6-point, per CLAUDE.md)
1. **Names story + spec ref** — WF.1, §5, E3 row 34. ✓
2. **Every requirement carried** — DAG schema, BullMQ engine, gates/branches, propose-not-execute, enqueue API,
   seed with runs. ✓
3. **DoD enforced** — orgId scoping, RBAC on the run endpoint, guardrails enforced, v2 n/a (backend), verify
   script + manual-checks, `tsc` clean, CI gate. ✓
4. **Real dependencies stated** — FND.6/11, ART.1/2, FND.3; ART.3 soft-dep reconciled. ✓
5. **Moat concerns flagged** — propose→approve→audit, guardrails.config, per-tenant isolation, feeds-the-loop,
   trace as the learning substrate. ✓
6. **Review gate** — §11 stop-and-show. ✓
