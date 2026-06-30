# PRD: AGT.1 — Agents screen (roster + live chat)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M–L (4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: AGT.1 (E5 Core · Track: Core) · build-spec §4.4
**Mode**: Full CPRD (first agent-bearing screen; match DS.1 1:1; brings ART.1/2/4 to life on screen)

---

## Problem Statement

The runtime works (ART.1/2) and streams over SSE (ART.4), but there's no way to *use* an agent in the
product. This story builds `/agents`: the roster of every module's agents grouped by module, each a DS.1
card with the dot-ring glyph, a live status dot, and a one-line description — and clicking one opens a
chat where you co-work with the agent and watch its reasoning stream into the trace console (scan →
correlate → tool → result), with gated actions surfaced as "proposed — awaiting approval." This is the
first screen where the moat is visible and interactive.

## Success Metrics

| Metric | Target |
|---|---|
| `/agents` lists all ~90 seeded agents grouped by module, each card with glyph + status dot + description | yes |
| "Needs attention" filter shows only CRITICAL-state agents | yes |
| Clicking an agent opens a live chat; sending a message streams trace lines + the answer | yes |
| Gated proposals render as a distinct "awaiting approval" affordance | yes |
| Matches DS.1 (`design/prototypes/`) — cards, chat, trace console | 1:1 |
| Org-scoped; a11y clean | 0 cross-tenant, accessibility-review 0 violations |

## User Stories

- As **any user**, I browse all agents grouped by module, each card showing what it does, and I open any
  one into a chat to co-work.
- As **any user**, I filter to "needs attention" to see only agents in a CRITICAL state.
- As **any user**, when I message an agent I watch its reasoning stream into the trace console, then its
  answer; if it proposes a gated action I see it flagged for approval.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `/agents` (shell route) — server-load agents grouped by module via `dbForOrg`, ordered by module | P0 | ~90 seeded |
| R2 | `AgentCard` (DS.1) — `AgentGlyph` (static 12-dot ring) + status dot (state→color) + name + role + one-line description | P0 | FND.15 primitive |
| R3 | Status dot color from `AgentState`: LIVE→success green · WORKING→lime · CRITICAL→ink · OFFLINE→muted | P0 | no invented reds |
| R4 | "Needs attention" filter (CRITICAL only) + module grouping headers | P0 | |
| R5 | Open an agent → chat panel: `ChatThread` (messages) + composer; uses `streamAgentChat` (ART.4) | P0 | live |
| R6 | Live `TraceConsole` (FND.13) renders streamed `trace` events as they arrive | P0 | the reasoning stream |
| R7 | `proposal` events render as a distinct "Proposed <tool> — awaiting approval" affordance (approval itself is RBAC.4) | P0 | surface only |
| R8 | Continue a thread (pass `chatId` back); loading/empty/error states; abort on close | P1 | |
| R9 | Built on DS.1 primitives; matches `design/prototypes/`; a11y (roles, focus, contrast) | P0 | fidelity gate |
| R10 | `verify-agt-1.ts` + `docs/manual-checks.md`; `tsc` clean; accessibility-review | P0 | DoD |

## Acceptance Criteria

- [ ] `/agents` shows all seeded agents grouped by module; each card has the AgentGlyph, a status dot in the correct state color, name, role, and one-line description.
- [ ] The "needs attention" filter narrows to CRITICAL-state agents; clearing it restores all.
- [ ] Clicking an agent opens its chat; typing a message and sending streams `trace` lines into the TraceConsole live, then the agent's answer into the ChatThread.
- [ ] Asking for a gated action (e.g. "send PO X") shows a `proposal` affordance ("awaiting approval"); no gated side effect occurs.
- [ ] The conversation persists (Chat + Messages); reopening continues the thread.
- [ ] Org-scoped: only the caller org's agents are listed/reachable.
- [ ] Matches DS.1 (cards, chat bubbles, trace console, the agent pane treatment); no emoji, no raw hex, hairlines; lime only as signal. accessibility-review 0 violations.
- [ ] `pnpm verify:agt-1` green; `tsc` clean; committed + pushed.

## Visual Spec (DS.1 — match 1:1)

Build from DS.1 primitives and reference `design/prototypes/` (the Agents screen / agent pane). Use the
DS.1 card, the `AgentGlyph` (static 12-dot ring — never animated), the chat bubble/thread treatment, the
composer input, and the dark `TraceConsole`. Status dot uses functional green (LIVE/approved), lime
(working), ink (critical — never red), muted (offline). Lime stays the single signal. JetBrains Mono for
the agent `code`/status labels/trace; Archivo for names/messages. If DS.1 lacks a chat/thread primitive,
compose from its existing pieces and register it — don't invent off-system styling.

## Technical Requirements

### Route + data — `apps/web/app/(shell)/agents/page.tsx`

```tsx
import { getCurrentUser } from "@/lib/session";
import { dbForOrg } from "@axona/db";
import { AgentsView } from "@/components/agents/AgentsView";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const agents = user ? await dbForOrg(user.orgId).agent.findMany({ orderBy: [{ moduleKey: "asc" }, { code: "asc" }] }) : [];
  // group by moduleKey for the view
  return <AgentsView agents={groupByModule(agents)} />;
}
```

### Components — `apps/web/components/agents/`

- **`AgentsView.tsx`** (client) — module-grouped roster + the "needs attention" filter; selecting an agent
  opens `AgentChat` (in the right agent pane, or a panel). Empty/loading/error.
- **`AgentCard.tsx`** — DS.1 card: `AgentGlyph` + status dot (state color) + name (Archivo) + role/`code`
  (JetBrains Mono, muted) + one-line description; hover/focus; selectable.
- **`AgentChat.tsx`** (client) — header (which agent) + `ChatThread` + composer; on send, calls
  `streamAgentChat(agentId, message, chatId)` (ART.4) and routes events:
  - `trace` / `proposal` → push into the `TraceConsole` (and render `proposal` distinctly);
  - `message` → append the agent message to the thread, capture `chatId` for continuation;
  - `error` → inline error.
- **`ChatThread.tsx`** — user/agent message bubbles (DS.1); cites sources where present (Message.citations).
- Reuse **`TraceConsole`** (FND.13) for the live stream; **`AgentGlyph`** (FND.15).

### Streaming wire

```ts
async function onSend(text: string) {
  setSending(true); appendUser(text); const ctrl = new AbortController();
  try {
    for await (const ev of streamAgentChat(agent.id, text, chatId, ctrl.signal)) {
      if (ev.type === "trace") pushTrace(ev.data);
      else if (ev.type === "proposal") { pushTrace(ev.data); markProposal(ev.data); }
      else if (ev.type === "message") { appendAgent(ev.data.text); setChatId(ev.data.chatId); }
      else if (ev.type === "error") showError(ev.data.message);
    }
  } finally { setSending(false); }
}
```

## UX Flow

```
/agents (shell)
   ├─ CORE / VALUE CHAIN / ROBOTICS / BACK OFFICE  ── [ Needs attention ▢ ]
   │   ▭ AgentCard (glyph · ● state · name · role · "what it does")  ×~90
   │        click ─►
   └─ AgentChat (agent pane / panel)
         ChatThread:  user ▸ "any parts below reorder point?"
                      agent ◂ "3 parts below reorder; drafted POs…"
         TraceConsole (live): scan → correlate → tool listReorderCandidates → tool-result → result
         proposal:  "Proposed sendPurchaseOrder — awaiting approval"   (RBAC.4 acts later)
         [ composer …………………………… send ]
```

## Edge Cases

| Case | Handling |
|---|---|
| Agent in CRITICAL state | status dot = ink; surfaces under "needs attention" |
| No `ANTHROPIC_API_KEY` (real chat) | the stream errors clearly; roster still renders; manual-check notes the key |
| Gated proposal | distinct affordance; no side effect; approving is RBAC.4 (out of scope) |
| Long trace stream | TraceConsole scrolls; collapsible |
| Switching agents mid-stream | abort the in-flight stream, start fresh for the new agent |
| Continue thread | pass the captured `chatId`; messages persist |
| Org with no agents | empty state ("No agents — run the seed") |
| Reduced motion | no animated glyph (it's static anyway), no decorative transitions |

## Out of Scope

- Approving/executing a gated proposal (RBAC.4) — surface only.
- The general cross-module Axona agent / Command Center copilot (GA.1/CMD.2) — this is the per-agent roster + chat.
- Token-by-token streaming of the final message (ART.4 streams trace live + the whole final message).
- Editing agent definitions/prompts (admin surface, later).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| ART.4 SSE + `streamAgentChat` | Done | live chat |
| ART.1/2 runtime + tools | Done | agents that do something |
| FND.15 AgentGlyph / AgentCard / ChatThread | Done/parallel | primitives (compose from DS.1 if missing) |
| FND.13 TraceConsole + shell | Done | the trace stream + layout |
| DS.1 | Done | the look |
| FND.12 seeded agents | Done | the roster |

## Implementation Plan

**Day 1** — route + grouped roster + `AgentCard` (glyph, status dot, description) + filter + states.
**Day 2** — `AgentChat` + `ChatThread` + composer wired to `streamAgentChat`; live trace into TraceConsole.
**Day 3** — proposal affordance + thread continuation + abort/switch + empty/error.
**Day 4** — DS.1 fidelity pass + accessibility-review + verify-agt-1 + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-agt-1.ts` (static + data; live chat is a manual check):

```ts
// Run: pnpm verify:agt-1
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying AGT.1 — Agents screen\n");
  const base = "apps/web";

  await check("agents route + components exist", () => fs.existsSync(`${base}/app/(shell)/agents/page.tsx`) && ["AgentsView","AgentCard","AgentChat","ChatThread"].every((c) => fs.existsSync(`${base}/components/agents/${c}.tsx`)));
  await check("chat uses streamAgentChat (ART.4)", () => /streamAgentChat/.test(read(`${base}/components/agents/AgentChat.tsx`)));
  await check("status dot maps AgentState (no red)", () => { const t = read(`${base}/components/agents/AgentCard.tsx`); return /CRITICAL/.test(t) && /ink/.test(t) && !/red|#f00|ff0000/i.test(t); });
  await check("proposal events surfaced", () => /proposal/.test(read(`${base}/components/agents/AgentChat.tsx`)));
  await check("no emoji / no raw hex in agents components", () => { const all = fs.readdirSync(`${base}/components/agents`).map((f) => read(`${base}/components/agents/${f}`)).join("\n"); return !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) && !/#[0-9a-fA-F]{3,6}\b/.test(all); });

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    await check("agents roster scoped + grouped (>= 60)", async () => (await dbForOrg(org!.id).agent.count()) >= 60);
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## AGT.1 — Agents screen
**Automated**
- `pnpm verify:agt-1` — route + components, streamAgentChat wiring, status-dot mapping (no red), proposal surfacing, token hygiene, scoped roster.
- `pnpm typecheck` clean.

**Manual (real key, ./dev.sh, http://localhost:3001/agents)**
- [ ] All ~90 agents listed, grouped by module; cards show glyph + status dot + description.
- [ ] "Needs attention" filters to CRITICAL agents.
- [ ] Open a procurement agent, ask "any parts below reorder point? draft POs" → trace streams live in the console, answer appears, POs drafted (DRAFTED).
- [ ] Ask "send PO <id>" → "awaiting approval" affordance; no PO becomes SENT.
- [ ] Matches design/prototypes/ (cards, chat, trace console); no emoji; hairlines; lime = signal only.
- [ ] accessibility-review: roles, focus, AA contrast — 0 violations.
```

## Common Mistakes to Avoid

1. **Animating the AgentGlyph** — it's a *static* 12-dot ring by spec; only the status dot color conveys state.
2. **Red for CRITICAL** — critical = ink; functional green for LIVE, lime for WORKING, muted for OFFLINE.
3. **Buffering the trace** — render `trace` events as they stream (ART.4 emits live); don't wait for `done`.
4. **Executing a gated proposal** — surface it as "awaiting approval"; acting is RBAC.4.
5. **Unscoped agent list** — `dbForOrg`; only the caller org's agents.
6. **Off-system chat styling** — compose the thread from DS.1 primitives; match `design/prototypes/`.
7. **Not aborting on agent switch** — cancel the in-flight stream before starting a new agent's chat.

## Cursor Rules for This Story

- Match DS.1 1:1 (`design/prototypes/`); DS.1 primitives only; no emoji/raw hex; lime = signal; AgentGlyph static.
- Roster + chat scoped via `getCurrentUser` → `dbForOrg`.
- Chat uses `streamAgentChat` (ART.4); render `trace`/`proposal` live into TraceConsole, `message` into ChatThread.
- Gated = "awaiting approval" affordance only (RBAC.4 acts).
- Status dot: LIVE→green, WORKING→lime, CRITICAL→ink, OFFLINE→muted. Run accessibility-review.

## Rollback Plan

Revert the AGT.1 commit (`app/(shell)/agents/*`, `components/agents/*`, verify script). No schema or data
change; chat rows are dev-only and clear on re-seed. The runtime/ART.4 endpoint stays. Zero data risk.
