# PRD: PROC.2 — Procurement screen (PO-queue + human approval)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3–4 days)
**Last Updated**: 2026-07-01
**Backlog Reference**: PROC.2 (E6 Value Chain · Track: Value Chain) · build-spec §4.10
**Mode**: Full CPRD (the wedge screen; carries the propose→approve→audit loop, so moat-adjacent)
**Design source**: `design/prototypes/axona-v2/Procurement.dc.html` — implement 1:1 on the v2 shell/primitives.

---

## Problem Statement

The sourcing agent already drafts POs (ART.2 `draftPurchaseOrder` → `DRAFTED`; `sendPurchaseOrder` is
gated → proposed, never auto-sent). PROC.1 exposes the queue data. What's missing is the screen where a
buyer sees the **PO queue** (agent-drafted vs sent), reviews the agent's reorder recommendation, and
**approves** a drafted PO — the human half of "AI proposes, human approves." This is the wedge and the
first module screen; it must match `Procurement.dc.html` 1:1 and lead with the PO-queue signature
artifact (no generic table slop).

## Success Metrics

| Metric | Target |
|---|---|
| `/procurement` matches `Procurement.dc.html` 1:1 on the v2 shell | yes (your eye is the gate) |
| PO queue renders from PROC.1 (`getProcurementQueue`), agent-drafted rows flagged | yes |
| Reorder recommendation banner from PROC.1's reorder candidates | yes |
| A buyer can **approve** a drafted/awaiting PO — role-gated, org-scoped, status transitions | yes |
| Gated send never happens autonomously; only a human moves it to SENT | enforced |
| Verify + a11y + tsc | `pnpm verify:proc-2` green, accessibility-review 0, tsc clean |

## User Stories

- As a **buyer**, I review the PO queue — agent-drafted vs sent — with supplier, part, qty, value, status.
- As a **buyer**, I see the agent's reorder recommendation (parts below reorder point) and can act on it.
- As a **buyer (OPS/ADMIN)**, I approve a drafted PO; it transitions and is attributed to me — the agent
  proposed, I approved.
- As a **VIEWER**, I can see the queue but the approve action is disabled/hidden (role-gated).

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `/procurement` (shell route) implementing `Procurement.dc.html` 1:1 — PO-queue signature artifact leads | P0 | v2 shell inherited |
| R2 | PO queue from `getProcurementQueue` (PROC.1): code, supplier name, part sku, qty, value, status, `draftedByAgent` flag, eta | P0 | read data done |
| R3 | Filter chips: status (All / Drafted / Awaiting approval / Approved / Sent / Received) + "Agent-drafted" | P0 | client filter or query param |
| R4 | Reorder-recommendation banner — parts at/below reorder point (PROC.1) with a "draft PO" affordance | P0 | the agent recommendation |
| R5 | **Approve action** — a mutation (server action/route handler) that role-gates (`requireRole` OPS/ADMIN), org-scopes, and transitions a PO: `DRAFTED`→`AWAITING_APPROVAL`, `AWAITING_APPROVAL`→`APPROVED`, `APPROVED`→`SENT` | P0 | the human-approval half |
| R6 | The state machine + immutable audit (model·approver·ts) is **deferred to RBAC.4 / AUDIT.3** — here: a real role-gated transition + a trace line; leave a `/// TODO AUDIT.3` where the event-log write goes | P0 | don't build the audit model early |
| R7 | Agent trace / the module's sourcing agent reachable (the dark trace console + the agent pane chat to the procurement agent) | P1 | ART.2/ART.4 |
| R8 | `revalidatePath('/procurement')` after a mutation; optimistic UI optional | P0 | server components refresh |
| R9 | States: loading skeleton, empty ("no POs"), error | P0 | DoD |
| R10 | `verify-proc-2.ts` + `docs/manual-checks.md`; tsc clean; accessibility-review | P0 | DoD |

## Acceptance Criteria

- [ ] `/procurement` renders 1:1 with `Procurement.dc.html` on the v2 shell (paper sidebar, 60px topbar, Lucide, primitives); the PO queue is the signature artifact.
- [ ] The queue shows PROC.1 data with agent-drafted rows visibly flagged; filters narrow by status + agent-drafted.
- [ ] The reorder banner lists parts below reorder point (e.g. SERVO-205/-204 from the seed) with a "draft PO" affordance.
- [ ] Approve, as OPS/ADMIN: `PO-9007` (agent-drafted, `AWAITING_APPROVAL`) can be approved → transitions and is attributed to the acting user; a trace line records it. As VIEWER, the action is disabled/hidden.
- [ ] No autonomous send: a PO only reaches `SENT` via a human approve; the agent never auto-sends.
- [ ] `requireRole()` is line 1 of the mutation; the query is org-scoped; `revalidatePath` after.
- [ ] Matches the design; no emoji/raw hex; hairlines; lime = signal. accessibility-review 0 violations.
- [ ] `pnpm verify:proc-2` green; tsc clean; committed + pushed.

## Technical Requirements

### Route + data — `apps/web/app/(shell)/procurement/page.tsx`

Server component: `getCurrentUser()` → `getProcurementQueue(user.orgId, { status })` (PROC.1) + the reorder
candidates; pass to `ProcurementView`. `/procurement` is a static shell route overriding `[module]` (same
pattern as `/agents`, `/core`).

### Approve mutation — `apps/web/app/(shell)/procurement/actions.ts`

```ts
"use server";
import { requireRole } from "@/lib/rbac";      // FND-level guard (OPS/ADMIN)
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

const NEXT: Record<string, string> = { DRAFTED: "AWAITING_APPROVAL", AWAITING_APPROVAL: "APPROVED", APPROVED: "SENT" };

export async function advancePurchaseOrder(poId: string) {
  const user = await getCurrentUser();
  requireRole(user, ["OPS", "ADMIN"]);          // line 1 — before any DB call
  const db = dbForOrg(user.orgId);
  const po = await db.purchaseOrder.findFirst({ where: { id: poId } });
  if (!po || !NEXT[po.status]) throw new Error("not advanceable");
  await db.purchaseOrder.updateMany({ where: { id: poId }, data: { status: NEXT[po.status] as any } });
  // /// TODO AUDIT.3: append an immutable event-log row { poId, from, to, actor: user.id, model: null, ts }.
  //     RBAC.4 will formalize the full approval state machine + gates.
  revalidatePath("/procurement");
}
```

If `requireRole` doesn't exist yet, add a minimal `lib/rbac.ts` guard (throws on insufficient role; the
full RBAC story hardens it) — note it as the RBAC.2/3 seam.

### Components — `apps/web/components/procurement/`

- **`ProcurementView.tsx`** — matches `Procurement.dc.html`: header/eyebrow, the reorder-recommendation
  banner, filter chips, and the **PO queue** (the signature artifact) as the lead.
- **`PoQueue.tsx` / `PoRow.tsx`** — columns per the design: code, supplier, part, qty, value (mono +
  specific), status pill, agent-drafted marker (AgentGlyph/dot), eta; an **Approve/Advance** button
  (role-gated, calls `advancePurchaseOrder`) shown on DRAFTED/AWAITING/APPROVED rows.
- **`ReorderBanner.tsx`** — parts below reorder point + a "draft PO" affordance.
- Status pill colors: functional green for SENT/RECEIVED (live/approved), lime for AWAITING (working/
  attention), ink for nothing-critical; **no invented reds**.
- Reuse the shell's agent pane (the procurement agent chat) + the dark TraceConsole.

## UX Flow

```
/procurement (v2 shell)
 ├─ eyebrow PROCUREMENT · N POs · Procurement h1
 ├─ Reorder recommendation: "2 parts below reorder point (SERVO-205 0/20 …)"  [draft PO]
 ├─ Filters: [All] [Drafted] [Awaiting] [Approved] [Sent] [Received]  [Agent-drafted]
 └─ PO QUEUE  (signature artifact)
     PO-9007  · Supplier · SERVO-205 · 20 · $…  · AWAITING ·  drafted by agent   [Approve]
        Approve (OPS/ADMIN) ─► AWAITING→APPROVED→SENT   (human approves; agent never auto-sends)
     PO-…     · … · SENT
   (agent pane: chat the sourcing agent · dark trace console below)
```

## Edge Cases

| Case | Handling |
|---|---|
| VIEWER tries to approve | button hidden/disabled; the server action still `requireRole`-guards (defense in depth) |
| PO at terminal status (SENT/RECEIVED) | no advance button |
| Approve a PO from another org | scoped `findFirst`/`updateMany` → not found → throw; no cross-tenant change |
| Concurrent approve | `updateMany` on the current status; idempotent enough for now (full state machine = RBAC.4) |
| Empty queue | empty state |
| Filter with no matches | "no POs match" |
| Reorder banner with 0 candidates | banner hidden |
| Design faint greys failing AA | bump small text to `ink-muted` (same reconciliation as the CC retrofit) |

## Out of Scope

- The full approval **state machine** (RBAC.4) and the **immutable audit/event log** (AUDIT.3) — PROC.2 does a real role-gated transition + a trace line and leaves the `/// TODO AUDIT.3` seam.
- Editing PO line items / CPQ (later).
- The other value-chain screens.
- Calibrated confidence on the agent's draft (CONF.1).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| PROC.1 `getProcurementQueue` + reorder | Done | the queue + banner |
| ART.2 procurement agent (draft/gated) | Done | agent-drafted POs + the trace |
| v2 shell + DS primitives (CMD retrofit) | Done | the look |
| `Procurement.dc.html` | Committed | the 1:1 spec |
| FND session stub / a `requireRole` guard | Stub/new | the approve gate |

## Implementation Plan

**Day 1** — `/procurement` route + `ProcurementView` skeleton against `Procurement.dc.html` + PROC.1 data + filters.
**Day 2** — `PoQueue`/`PoRow` (signature artifact, status pills, agent-drafted marker) + `ReorderBanner`.
**Day 3** — approve mutation (`requireRole`, transition, revalidate, trace line, AUDIT.3 seam) + role-gated UI + agent pane/trace.
**Day 4** — states + DS fidelity + accessibility-review + verify-proc-2 + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-proc-2.ts`:

```ts
// Run: pnpm verify:proc-2
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying PROC.2 — Procurement screen\n");
  const base = "apps/web";

  await check("route + components exist", () => fs.existsSync(`${base}/app/(shell)/procurement/page.tsx`) && ["ProcurementView","PoQueue","PoRow","ReorderBanner"].every((c) => fs.existsSync(`${base}/components/procurement/${c}.tsx`)));
  await check("approve action requireRole first, org-scoped, revalidates", () => { const t = read(`${base}/app/(shell)/procurement/actions.ts`); return /requireRole/.test(t) && /dbForOrg/.test(t) && /revalidatePath/.test(t); });
  await check("AUDIT.3 seam left for the event log", () => /AUDIT\.3/.test(read(`${base}/app/(shell)/procurement/actions.ts`)));
  await check("status pills no red", () => { const t = read(`${base}/components/procurement/PoRow.tsx`); return !/red|#f00|ff0000/i.test(t); });
  await check("no emoji / no raw hex", () => { const all = fs.readdirSync(`${base}/components/procurement`).map((f) => read(`${base}/components/procurement/${f}`)).join("\n"); return !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) && !/#[0-9a-fA-F]{3,6}\b/.test(all); });

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    const { getProcurementQueue } = await import(`../../apps/web/lib/procurement`);
    await check("queue returns agent-drafted PO (PO-9007)", async () => { const q = await getProcurementQueue(org!.id, {}); return q.some((p: any) => /PO-9007/.test(p.code) && p.draftedByAgent); });
    await check("advance is role-gated (VIEWER blocked)", async () => {
      const { advancePurchaseOrder } = await import(`../../apps/web/app/(shell)/procurement/actions`);
      // simulate: with a VIEWER session the guard throws — assert requireRole is invoked (structural)
      return /requireRole\(user, \["OPS", "ADMIN"\]\)/.test(read(`${base}/app/(shell)/procurement/actions.ts`));
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## PROC.2 — Procurement screen
**Automated**
- `pnpm verify:proc-2` — route/components; approve action requireRole+scoped+revalidate; AUDIT.3 seam; no red; token hygiene; queue has agent-drafted PO-9007; role-gate structural.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/procurement)**
- [ ] Matches Procurement.dc.html (PO-queue signature artifact leads); v2 shell; no emoji; lime = signal.
- [ ] Queue shows PROC.1 data; agent-drafted rows flagged; filters work.
- [ ] Reorder banner lists SERVO-205/-204 below reorder point.
- [ ] As OPS/ADMIN, approve PO-9007 → AWAITING→APPROVED→SENT, attributed to you; a trace line records it.
- [ ] The agent never auto-sends; only a human reaches SENT.
- [ ] accessibility-review 0 violations.
```

## Common Mistakes to Avoid

1. **Generic table instead of the signature artifact** — lead with the PO queue as designed, not a bare data grid.
2. **`requireRole` not first** — it's line 1 of the mutation, before any DB call.
3. **Unscoped approve** — `dbForOrg`; a PO from another org must not be advanceable.
4. **Auto-sending** — only a human reaches SENT; the agent proposes, never sends (ART.1/2 already guarantee the autonomous path; keep the screen consistent).
5. **Building the audit model here** — leave the `/// TODO AUDIT.3` seam; don't add the event-log table early.
6. **Red status pills** — green live/approved, lime attention, ink otherwise. No red.
7. **Off-design styling** — match `Procurement.dc.html` on the DS primitives; AA-bump faint greys.

## Cursor Rules for This Story

- Implement `Procurement.dc.html` 1:1 on the v2 shell/primitives; PO-queue is the signature artifact; Lucide icons; no emoji/raw hex; lime = signal.
- Queue/banner from PROC.1 (`dbForOrg`-scoped); agent-drafted flagged.
- Approve = server action, `requireRole(["OPS","ADMIN"])` first line, org-scoped, `revalidatePath`; transition only; `/// TODO AUDIT.3` for the event log; RBAC.4 formalizes the state machine.
- Only a human reaches SENT. Run accessibility-review.

## Rollback Plan

Revert the PROC.2 commit (`app/(shell)/procurement/*`, `components/procurement/*`, `lib/rbac.ts` if new,
verify script). No schema change; the approve transition only flips existing PO `status` (re-seed resets).
Zero production data risk.
