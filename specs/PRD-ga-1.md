# PRD: GA.1 — General Axona agent (cross-module copilot) + global agent pane

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3–4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: GA.1 (E3 Platform · Track: Platform) · build-spec §5
**Mode**: Full CPRD (the always-on cross-module copilot; powers the Command Center copilot next)
**Dependency note:** original backlog listed ART.3 as a dep — **relaxed**. A read-only cross-module agent
runs on ART.2's core read tools; agent-to-agent orchestration (ART.3) isn't required and waits for Workflows.

---

## Problem Statement

Module agents (AGT.1) are scoped to one domain. What's missing is the **general Axona agent** — a
read-only copilot with cross-module scope that can answer "what's blocked across the company?", "what's
the status of the BMW order?", "which agents need attention?", always **citing the source objects** it
read. The right-side agent pane (a placeholder since FND.13) is the natural home: a copilot available on
every screen. This story defines that agent and wires the global pane to it via the ART.4 stream, with
citation rendering. It's also exactly what the Command Center copilot (CMD.2) will reuse.

## Success Metrics

| Metric | Target |
|---|---|
| A general Axona agent exists (scope "core", cross-module **read-only** tools, always-cite prompt) | yes |
| The global agent pane (FND.13) chats with it via `streamAgentChat` on every screen | yes |
| Answers cite the source objects/files they came from (clickable) | yes |
| It reads across modules but cannot draft/act — it routes ("open the Procurement agent to draft a PO") | enforced |
| Org-scoped; matches DS.1; a11y clean | 0 cross-tenant, 0 violations |
| Offline-verifiable | `pnpm verify:ga-1` green |

## User Stories

- As **any user**, from any screen I open the agent pane and ask the Axona agent a cross-module question;
  it answers with the reasoning streaming in and **cites** the objects it used.
- As **any user**, when I ask it to *do* something actionable (draft/send/release), it explains that's a
  module agent's job and points me there — it reads and routes, it doesn't act.
- As a **developer (CMD.2)**, I can reuse this general agent for the Command Center copilot.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | Define the general Axona agent: scope/moduleKey "core", system prompt = cross-module + read-only + **always cite sources** + route-don't-act | P0 | `buildAgentDef` already maps "core" → cross-module reads |
| R2 | Ensure it's reachable: seed (or ensure) a `core`/`axona` agent row so `runAgent`/the chat route can target it | P0 | id stable; add to FND.12 seed |
| R3 | Its toolset = **read-only** cross-module tools (`searchOperations`, `getModuleSummary`, and the read tools from every module) — **no draft/gated** tools | P0 | the general agent never acts |
| R4 | Wire the global `AgentPane` (FND.13) to chat with the general agent via `streamAgentChat` (ART.4) — works on every shell screen | P0 | replaces the placeholder body |
| R5 | Citations: tool results carry source refs (id/code + url); the agent cites them; the chat renders citation chips linking to the object | P0 | `Message.citations` |
| R6 | Trace streams into the pane (compact) or the TraceConsole; proposal events shouldn't occur (no gated tools) but render safely if they do | P1 | |
| R7 | Built on DS.1; matches `design/prototypes/` agent pane; a11y | P0 | fidelity gate |
| R8 | `verify-ga-1.ts` + `docs/manual-checks.md`; `tsc` clean; accessibility-review | P0 | DoD |

## Acceptance Criteria

- [ ] A general Axona agent (scope "core") exists and is reachable by `runAgent`/the chat route; its tools are read-only cross-module (no draft/gated present).
- [ ] The global agent pane chats with it on every shell screen; sending a message streams the trace and the answer.
- [ ] Answers **cite sources**: when the agent uses `searchOperations`/reads, its response references the objects (e.g. "NCR-118", "DLV-3312") and the chat renders citation chips that link to the object's route.
- [ ] Asking it to draft/send/release → it declines and routes to the relevant module agent (no tool acts; there are no gated tools in its set anyway).
- [ ] Org-scoped: it only reads the caller org's data.
- [ ] Matches DS.1 (agent pane, chat, citation chips); no emoji/raw hex; hairlines; lime = signal. accessibility-review 0 violations.
- [ ] `pnpm verify:ga-1` green; `tsc` clean; committed + pushed.

## Technical Requirements

### The general agent definition

```ts
// packages/agents/src/agents/axona.ts
export const AXONA_AGENT_CODE = "axona-00";

export function axonaSystemPrompt(): string {
  return [
    "You are the Axona agent — a cross-module copilot for a robotics company's operating system.",
    "You READ across every module and you ALWAYS cite the source objects you used (by code/id), via the tools.",
    "You do NOT draft, place, send, release, or pay. Those are module agents' jobs — if asked to act,",
    "explain which module agent does it and point the user there. Read and route; never claim a result",
    "you did not get from a tool.",
  ].join(" ");
}
```

Ensure `buildAgentDef` recognizes scope/moduleKey `"core"` → `coreReadTools()` + every module's **read**
tools (not draft/gated). Add a `readToolsAcrossModules()` helper to the registry (filter `category === "read"`).

### Seed the agent (R2)

In FND.12's `agents.ts` (or a small migration-free ensure step), add one `Agent` row: `moduleKey "core"`,
`code "axona-00"`, `role "AXONA"`, `name "Axona agent"`, `description "Cross-module copilot — reads
everything, cites sources, routes actions."`, `state LIVE`. Re-seed is idempotent. The chat route targets
it by id (resolve once, e.g. a helper `getAxonaAgent(orgId)`).

### Citations (R5)

- Read tools return, alongside data, a compact `sources: { label, url }[]` (e.g. `searchOperations` maps
  its hits → `{ label: hit.title, url: hit.url }`).
- The runtime/trace already carries tool results; surface the union of `sources` from the run as
  `Message.citations` when persisting the agent message (extend ART.4's agent-message persistence to
  attach citations gathered from the trace's `tool-result` data).
- `ChatThread` renders `citations` as small DS.1 chips under the agent message, each a link to `url`.

### Wire the global agent pane (R4) — `apps/web/components/shell/AgentPane.tsx`

Replace the placeholder body with an embedded chat against the Axona agent: a compact `ChatThread` +
composer using `streamAgentChat(axonaAgentId, message, chatId)`. Trace lines render compactly in the pane
(or toggle the TraceConsole). The pane stays resizable/collapsible (FND.13 behavior unchanged). The
current screen's module can be passed as light context in the message (optional: "on /quality" hint).

## UX Flow

```
[any shell screen] ─ right agent pane ▸ "Axona agent"
   user ▸ "what's blocking the BMW order?"
   stream: scan → tool searchOperations("BMW") → tool-result {hits, sources}
           → tool getModuleSummary(...) → result
   agent ◂ "The BMW 24-unit order (DLV-3312) is held at Osaka customs (EAR99) and at-risk +3w
            from ECO-318. The autonomy regression also puts the 99.5% SLA at risk."
        citations: [DLV-3312] [ECO-318] [NCR-118]   ← DS.1 chips, link to the object
   user ▸ "place the replacement PO"
   agent ◂ "I read and route — I can't place orders. Open the Procurement agent to draft/send it."
```

## Edge Cases

| Case | Handling |
|---|---|
| Asked to act (draft/send/release) | declines + routes; its toolset has no draft/gated tools anyway |
| No `ANTHROPIC_API_KEY` (real) | stream errors clearly; pane still renders; manual-check notes the key |
| Tool returns no sources | answer without chips; don't fabricate citations |
| General agent row missing | `getAxonaAgent` ensures/creates it (idempotent) or the route 404s with a clear message |
| Long answer / many citations | dedupe citations; cap chips (e.g. 8) with "+N more" |
| Pane collapsed | FND.13 rail behavior unchanged; expanding resumes the thread |
| Cross-tenant | `dbForOrg` everywhere; reads only the caller org |

## Out of Scope

- The Command Center screen + rollups (CMD.1/CMD.2) — they reuse this agent.
- Module orchestrator / agent-to-agent calls (ART.3).
- Draft/gated actions from the general agent — intentionally none (read + route only).
- Memory-backed context (MEM.2), calibrated confidence (CONF.1).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| ART.2 core/cross-module read tools + buildAgentDef | Done | the agent's hands |
| ART.4 streamAgentChat + chat route | Done | the pane chat |
| SRCH.2 search | Done | `searchOperations` citations |
| FND.13 AgentPane + FND.15 ChatThread | Done | the surface |
| FND.12 seed | Done | add the axona agent row |

## Implementation Plan

**Day 1** — `axona.ts` (prompt) + `readToolsAcrossModules()` + `getAxonaAgent` + seed the agent row.
**Day 2** — citations: tool `sources` + attach to `Message.citations` in the chat route + `ChatThread` chips.
**Day 3** — wire the global `AgentPane` to chat the Axona agent (compact trace) + DS.1 fidelity.
**Day 4** — a11y + verify-ga-1 + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-ga-1.ts`:

```ts
// Run: pnpm verify:ga-1
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying GA.1 — general Axona agent\n");

  await check("axona agent def + readToolsAcrossModules exist", () => fs.existsSync("packages/agents/src/agents/axona.ts") && /readToolsAcrossModules/.test(read("packages/agents/src/tools/registry.ts")));
  await check("agent pane wired to streamAgentChat", () => /streamAgentChat/.test(read("apps/web/components/shell/AgentPane.tsx")));
  await check("ChatThread renders citations", () => /citations/.test(read("apps/web/components/agents/ChatThread.tsx")));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { buildAgentDef, getAxonaAgent } = await import("@axona/agents");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });

    await check("axona agent exists (scope core)", async () => { const a = await getAxonaAgent(org!.id); return !!a && a.moduleKey === "core"; });
    await check("axona agent has read tools only (no draft/gated)", async () => {
      const a = await getAxonaAgent(org!.id);
      const def = buildAgentDef(a!);
      return def.tools.length > 0 && def.tools.every((t: any) => t.category === "read");
    });
    await check("read tools span multiple modules", async () => {
      const a = await getAxonaAgent(org!.id);
      const def = buildAgentDef(a!);
      return def.tools.some((t: any) => t.name === "searchOperations") && def.tools.some((t: any) => t.name === "listOpenNcrs");
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## GA.1 — General Axona agent + global pane
**Automated**
- `pnpm verify:ga-1` — axona def + readToolsAcrossModules; pane wired to streamAgentChat; ChatThread citations; axona agent exists (core, read-only, multi-module).
- `pnpm typecheck` clean.

**Manual (real key, ./dev.sh)**
- [ ] On any shell screen, open the right agent pane → it's the "Axona agent".
- [ ] Ask "what's blocking the BMW order?" → reasoning streams, answer cites DLV-3312 / ECO-318 (chips link to the objects).
- [ ] Ask "place the replacement PO" → it declines and routes you to the Procurement agent (no action taken).
- [ ] Citations are real (link to existing routes); no fabricated refs.
- [ ] Matches design/prototypes/ agent pane; no emoji; hairlines; lime = signal. accessibility-review 0 violations.
```

## Common Mistakes to Avoid

1. **Giving the general agent draft/gated tools** — it's read-and-route only; its set is read tools across modules. Acting is a module agent's job.
2. **Fabricated citations** — only cite sources that came back from a tool (`sources`); never invent object refs.
3. **Hardcoding the axona agent id** — resolve via `getAxonaAgent(orgId)` (scoped); ensure it's seeded idempotently.
4. **Breaking the pane's resize/collapse** — keep FND.13 behavior; only the body becomes a chat.
5. **Unscoped reads** — `dbForOrg` everywhere; cross-module ≠ cross-tenant.
6. **Off-system chat/citation styling** — DS.1 primitives; citation chips are DS.1 chips.

## Cursor Rules for This Story

- General agent: scope "core", read-only cross-module tools, system prompt = cite-always + read-and-route.
- Resolve the agent via `getAxonaAgent(orgId)`; seed it idempotently in FND.12's agent seed.
- Citations come from tool `sources` → `Message.citations` → DS.1 chips linking to the object route.
- Wire the global `AgentPane` to `streamAgentChat` (ART.4); keep FND.13 resize/collapse.
- DS.1 fidelity; no emoji/raw hex; lime = signal; run accessibility-review.

## Rollback Plan

Revert the GA.1 commit (`packages/agents/src/agents/axona.ts`, the `readToolsAcrossModules`/`getAxonaAgent`
additions, the AgentPane chat wiring, ChatThread citations, the seed agent row, verify script). The pane
reverts to its FND.13 placeholder. The seeded axona agent row clears on re-seed. No schema change. Zero
data risk.
