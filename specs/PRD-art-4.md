# PRD: ART.4 — Agent chat endpoint (SSE streaming + trace)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3–4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: ART.4 (E3 Platform · Track: Platform) · build-spec §5, §6 (`POST /api/agents/:id/chat`)
**Mode**: Full CPRD (the live agent surface; also lands the trace-streaming seam ART.5/OBS.1 build on)

---

## Problem Statement

The runtime (ART.1) and tools (ART.2) work, but they're only callable from a script — nothing in the
product can talk to an agent. This story exposes `POST /api/agents/:id/chat` as an **SSE stream** that
runs the agent and streams its trace lines *as they happen* (scan → correlate → tool → result) plus the
final answer, persists the conversation (`Chat`/`Message`) and the `AgentRun`, and surfaces gated
**proposals** in the stream. It also introduces the trace **sink** seam so the same trace can later feed
the console (ART.5) and Langfuse (OBS.1) without a rewrite. AGT.1 then renders this in the Agents screen.

## Success Metrics

| Metric | Target |
|---|---|
| `POST /api/agents/:id/chat` streams trace events + final message over SSE | works end-to-end |
| Trace lines stream live (as the runtime pushes them), not all at once at the end | yes |
| Conversation persisted: `Chat` (created/continued) + user & agent `Message` rows | yes |
| Gated proposals surface as a distinct stream event (UI can show "awaiting approval") | yes |
| Org-scoped: an agent in org A is unreachable/empty from org B | enforced |
| Offline-testable (FakeModelClient) + a real keyed manual run | `pnpm verify:art-4` green offline |

## User Stories

- As a **user (via AGT.1 next)**, I send a message to an agent and watch its reasoning stream in (trace
  lines), then its answer — like Linear/Harvey, not a spinner then a wall of text.
- As a **user**, when the agent proposes a gated action (send PO), I see a clear "proposed — awaiting
  approval" event rather than a silent no-op.
- As a **developer (AGT.1 / GA.1 / Command Center copilot)**, I have one streaming endpoint + a client
  helper to consume it.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `POST /api/agents/:id/chat` (App Router route handler) returns an SSE stream (`text/event-stream`) | P0 | §6 |
| R2 | Body: `{ message, chatId? }`; resolve org via `getCurrentUser()` (stub → AUTH.1); 404 if agent not in org | P0 | scoped |
| R3 | Extend `TraceCollector` with an optional **sink** (`onLine` callback); `runAgent` accepts an `onTrace` emitter | P0 | the ART.5/OBS.1 seam |
| R4 | Stream event types: `trace` (each line), `proposal` (gated), `message` (final text), `done`, `error` | P0 | typed SSE events |
| R5 | Persist: create/continue a `Chat` (by `chatId`), store the user `Message` and the agent `Message` (with citations if any); the `AgentRun` is persisted by `runAgent` already | P0 | §3.2 |
| R6 | Abort handling: client disconnect aborts the run; partial trace persisted | P1 | |
| R7 | A client helper `streamAgentChat()` (fetch + ReadableStream reader) usable by AGT.1 | P0 | not the UI itself |
| R8 | `verify-art-4.ts` (offline: FakeModelClient drives a run; assert ordered trace events + final message + persisted Chat/Message; gated → proposal event, no side effect) + `docs/manual-checks.md`; `tsc` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `POST /api/agents/:id/chat` with `{ message }` opens an SSE stream that emits `trace` events as the runtime pushes lines, then a `message` event with the final answer, then `done`.
- [ ] A new `Chat` is created when no `chatId`; passing `chatId` continues it; user + agent `Message` rows are persisted with the chat.
- [ ] When the model calls a gated tool, the stream emits a `proposal` event (tool + inputs) and the run ends `AWAITING_APPROVAL`; no gated side effect occurs.
- [ ] `TraceCollector` accepts an `onLine` sink; with no sink it behaves exactly as ART.1 (back-compat); `runAgent({ onTrace })` streams lines live.
- [ ] An agent id not in the caller's org returns 404 (scoped lookup); the stream for org A never leaks org B data.
- [ ] `streamAgentChat()` client helper parses the SSE events into a typed async iterator/callback.
- [ ] `pnpm verify:art-4` green offline (FakeModelClient); `tsc` clean; committed + pushed.

## Technical Requirements

### Trace sink seam — extend `TraceCollector` (`packages/agents/src/runtime/trace.ts`)

```ts
export class TraceCollector {
  lines: TraceLine[] = [];
  constructor(private onLine?: (line: TraceLine) => void) {}
  push(kind: TraceKind, text: string, data?: unknown, confidence?: number) {
    const line = { ts: new Date().toISOString(), kind, text, data, confidence };
    this.lines.push(line);
    this.onLine?.(line);          // live sink — SSE now, console (ART.5) + Langfuse (OBS.1) later
    return line;
  }
}
```

`runAgent` gains an optional `onTrace`:

```ts
export async function runAgent(agentId, message, opts: { orgId; userId; model?; onTrace?: (l: TraceLine) => void }) {
  const trace = new TraceCollector(opts.onTrace);   // live emit if provided
  // …unchanged otherwise; still persists AgentRun
}
```

Back-compat: no `onTrace` → no sink → identical to ART.1. (This is the seam OBS.1/Langfuse plugs into.)

### SSE route — `apps/web/app/api/agents/[id]/chat/route.ts`

```ts
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { message, chatId } = await req.json();
  const user = await getCurrentUser();                       // TODO AUTH.1
  if (!user) return new Response("unauthorized", { status: 401 });
  const db = dbForOrg(user.orgId);
  const agent = await db.agent.findFirst({ where: { id: params.id } });
  if (!agent) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        // continue or create the chat; persist the user message
        const chat = chatId
          ? await db.chat.findFirst({ where: { id: chatId } })
          : await db.chat.create({ data: { agentId: agent.id, userId: user.id, scope: agent.moduleKey } });
        await db.message.create({ data: { chatId: chat!.id, role: "USER", text: message } });

        const result = await runAgent(agent.id, message, {
          orgId: user.orgId, userId: user.id,
          onTrace: (line) => send(line.kind === "proposal" ? "proposal" : "trace", line),
        });

        await db.message.create({ data: { chatId: chat!.id, role: "AGENT", text: result.text } });
        send("message", { chatId: chat!.id, text: result.text, status: result.status, runId: result.runId });
        send("done", { runId: result.runId });
      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
```

(If `chatId` is passed but not found in the org, treat as a new chat or 404 — pick 404 for safety.)

### Client helper — `apps/web/lib/agent-chat.ts`

```ts
export interface ChatEvent { type: "trace" | "proposal" | "message" | "done" | "error"; data: any; }

/** POST to the SSE endpoint and yield parsed events. AGT.1 renders these. */
export async function* streamAgentChat(agentId: string, message: string, chatId?: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(`/api/agents/${agentId}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, chatId }), signal,
  });
  const reader = res.body!.getReader(); const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    // parse SSE frames separated by \n\n
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const ev = /event: (.*)/.exec(frame)?.[1] ?? "message";
      const data = /data: (.*)/s.exec(frame)?.[1];
      yield { type: ev as ChatEvent["type"], data: data ? JSON.parse(data) : null };
    }
  }
}
```

## UX Flow

```
client ──POST /api/agents/:id/chat {message, chatId?}──►
   persist user Message · create/continue Chat
   runAgent(onTrace = send SSE)
      trace line pushed ──► event: trace   {kind, text, data}   (streams live)
      gated tool       ──► event: proposal {tool, input}        (awaiting approval)
      final            ──► persist agent Message
                          event: message  {text, status, runId}
                          event: done
   error ──► event: error {message}
client (streamAgentChat) ──► AGT.1 renders trace in TraceConsole + answer in ChatThread
```

## Edge Cases

| Case | Handling |
|---|---|
| Agent not in org | 404 before streaming |
| `chatId` from another org | scoped lookup misses → 404 (don't leak/continue) |
| Client disconnects mid-run | `req.signal` aborts the run; partial AgentRun trace persisted |
| Gated proposal | `proposal` event; run `AWAITING_APPROVAL`; no side effect (ART.1/ART.2 guarantee) |
| Model/tool error | `error` event; partial trace persisted; stream closes cleanly |
| Long run near turn cap | streams trace until cap; final `message` says limit reached (ART.1) |
| No `ANTHROPIC_API_KEY` (real) | route errors clearly; verify uses FakeModelClient (offline) |
| SSE buffering by a proxy | set `Cache-Control: no-cache`; document that prod needs proxy buffering off |

## Out of Scope

- The Agents screen UI / ChatThread / TraceConsole wiring (AGT.1 — uses `streamAgentChat`).
- Token-by-token streaming of the final text (stream trace + whole final message now; token streaming is a later refinement needing a streaming ModelClient).
- The module orchestrator + cross-module agent calls (ART.3).
- Human approval of a gated proposal (RBAC.4) — the stream surfaces it; acting on it is later.
- Langfuse sink (OBS.1) — the seam exists; wiring is its own story.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| ART.1 runtime + TraceCollector | Done | extend with sink |
| ART.2 tool registry + buildAgentDef | Done | agents that do something |
| FND.6 Chat/Message models | Done | persistence |
| FND.13 session stub | Done | `getCurrentUser` |

## Implementation Plan

**Day 1** — extend `TraceCollector` (sink) + `runAgent({ onTrace })`, back-compat verified.
**Day 2** — the SSE route (`/api/agents/[id]/chat`) + Chat/Message persistence + event types.
**Day 3** — `streamAgentChat` client helper + abort handling.
**Day 4** — verify-art-4 (offline: ordered events, persisted chat, gated→proposal/no side effect, isolation) + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-art-4.ts` — offline via FakeModelClient (drive the route's `runAgent` path directly):

```ts
// Run: pnpm verify:art-4   (data checks require seeded DB)
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying ART.4 — agent chat SSE\n");

  await check("route + client helper exist", () => fs.existsSync("apps/web/app/api/agents/[id]/chat/route.ts") && fs.existsSync("apps/web/lib/agent-chat.ts"));
  await check("TraceCollector supports a sink", () => /onLine/.test(fs.readFileSync("packages/agents/src/runtime/trace.ts", "utf8")));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { runAgent, FakeModelClient } = await import("@axona/agents");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    const db = dbForOrg(org!.id);

    await check("onTrace streams lines live (sink fires before completion)", async () => {
      const agent = await db.agent.findFirst({ where: { moduleKey: "procurement" } });
      const seen: string[] = [];
      const fake = new FakeModelClient([{ stopReason: "end_turn", text: "ok", model: "fake", toolUses: [] }]);
      await runAgent(agent!.id, "hello", { orgId: org!.id, userId: "u", model: fake, onTrace: (l: any) => seen.push(l.kind) });
      return seen.includes("scan") && seen.includes("result");
    });

    await check("gated call streams a proposal kind, no side effect", async () => {
      const agent = await db.agent.findFirst({ where: { moduleKey: "procurement" } });
      const before = await db.purchaseOrder.count({ where: { status: "SENT" } });
      const seen: string[] = [];
      const fake = new FakeModelClient([{ stopReason: "tool_use", text: "", model: "fake", toolUses: [{ id: "t", name: "sendPurchaseOrder", input: { poId: "x" } }] }]);
      const r = await runAgent(agent!.id, "send it", { orgId: org!.id, userId: "u", model: fake, onTrace: (l: any) => seen.push(l.kind) });
      const after = await db.purchaseOrder.count({ where: { status: "SENT" } });
      return seen.includes("proposal") && r.status === "AWAITING_APPROVAL" && after === before;
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

(The end-to-end SSE HTTP path — Chat/Message persistence over a live request — is covered in manual-checks
with the dev server; verify exercises the `runAgent`/sink contract the route depends on, offline.)

## Append to docs/manual-checks.md

```
## ART.4 — Agent chat SSE
**Automated**
- `pnpm verify:art-4` — route + client helper exist; TraceCollector sink; onTrace streams live; gated → proposal kind + no SENT PO.
- `pnpm typecheck` clean.

**Manual (real key, docker up, ./dev.sh)**
- [ ] curl -N -X POST localhost:3001/api/agents/<id>/chat -d '{"message":"any parts below reorder point?"}' → streams `event: trace` lines, then `event: message`, then `event: done`.
- [ ] Ask it to "send PO <id>" → an `event: proposal` appears; no PO becomes SENT.
- [ ] A Chat row + user/agent Message rows persisted; pass the chatId back to continue the thread.
- [ ] Agent id from another org → 404.
```

## Common Mistakes to Avoid

1. **Collecting the whole trace then sending it at the end** — defeats the point; the sink must emit each line live as `push` is called.
2. **Breaking ART.1 back-compat** — `TraceCollector` with no sink must behave exactly as before; `onTrace` is optional.
3. **Unscoped chat/agent lookups** — use `dbForOrg`; a `chatId`/agent from another org must 404, not continue.
4. **Letting a gated tool slip through the stream** — the `proposal` path comes from ART.1's gate; never execute gated handlers here.
5. **Forgetting SSE framing** — `event:`/`data:` lines, `\n\n` between frames; set `text/event-stream` + `no-cache`.
6. **Not persisting on error/abort** — store the partial AgentRun + whatever messages exist so the thread isn't lost.

## Cursor Rules for This Story

- The trace sink is the seam for ART.5 (console) and OBS.1 (Langfuse) — keep emission generic, no Langfuse/console specifics in the runtime.
- SSE route is org-scoped via `getCurrentUser` → `dbForOrg`; agent + chat lookups scoped; 404 on miss.
- Stream events typed: `trace` / `proposal` / `message` / `done` / `error`.
- Gated actions surface as `proposal`, never execute (ART.1/ART.2 guarantee).
- Offline verify via FakeModelClient; the live HTTP path is a manual check.

## Rollback Plan

Revert the ART.4 commit (the `[id]/chat` route, `lib/agent-chat.ts`, the `TraceCollector` sink +
`runAgent` `onTrace` additions, verify script). The sink param is optional, so reverting it doesn't break
ART.1/ART.2. No schema change. Dev-only chat rows clear on re-seed. Zero production data risk.
