# PRD — RBAC.4 · Approval state machine for gated actions

**Story:** RBAC.4 — Approval state machine for gated actions (PO approve, ECO release, policy rollback, credit note,
workflow-gate resume) → AWAITING_APPROVAL, then human approve/reject, audited.
**Spec ref:** `specs/axona-build-spec.md` §5/§8; backlog E2 row 26. **Second story of the propose→approve→audit epic.**
**Priority / size:** P0 · M (4 dev-days). **Track:** Platform (E2). **Depth:** Full CPRD (the moat's human-in-the-loop core).
**Dependencies:** RBAC.1 (requireRole — landed), AUDIT.1 (writeAudit + AuditLog — landed just prior), WF.1 (parked
runs — landed), the existing gated surfaces (PROC.2 PO advance, POStatus chain).

**Moat-load-bearing.** This is where "AI proposes; a human approves money/safety/contract" becomes real and clickable.
One reusable primitive, every transition audited (AUDIT.1), never an auto-execute of a gated action. Confidence-gated
auto-approval is the TRUST.1/CONF.1 future — leave the seam.

---

## 1. Context — what exists

- **RBAC.1:** `requireRole` / `hasRole` (`apps/web/lib/rbac.ts`), 7 roles.
- **AUDIT.1:** `writeAudit(db, …)` + append-only `AuditLog`.
- **Gated surfaces already partly there:** `POStatus { DRAFTED, AWAITING_APPROVAL, APPROVED, SENT, RECEIVED }` and a
  role-gated PO advance in `apps/web/app/(shell)/procurement/actions.ts` (ad-hoc, per-surface). WF.1's guardrail gate
  parks a `WorkflowRun` at `RunStatus.AWAITING_APPROVAL` but **nothing can resume it** (the `/// RBAC.4` seam).
- **Other gated entities** carry `/// RBAC.4` seams but no approve path: ECO release (Engineering), policy rollback
  (Autonomy), credit note (Finance).

## 2. Goals

1. A **reusable approval primitive** — a typed registry of gated action kinds, each declaring: the entity + status
   field, the legal transition (AWAITING_APPROVAL → APPROVED | REJECTED), the required role(s), and the **effect** to
   run on approve (e.g. PO → SENT; workflow run → resume; ECO → RELEASED).
2. **approve/reject server actions** that: `requireRole` (per kind), load the target org-scoped, assert it is
   AWAITING_APPROVAL, transition it, run the effect, and **write an AUDIT.1 entry** (actor = the human approver).
3. **Refactor the existing PO advance** onto the primitive (one path, not ad-hoc).
4. **Resume a parked workflow** on approval — WF.1's guardrail-gate run continues past the gate (or completes) and is
   audited — closing the WF.1 loop end-to-end.
5. **Wire approve/reject onto the two already-parked surfaces** in the UI: the Procurement PO queue (exists — move it
   onto the primitive) and the Workflow detail's parked run (WFL.2). ECO/policy/credit-note wiring = follow-up stories.

## 3. Non-goals (explicit)

- **Confidence-gated / progressive-trust auto-approval** → TRUST.1 + CONF.1. Every approval here is an explicit human click.
- **model · confidence · approver** enrichment on the audit entry → AUDIT.3 (adds the columns; RBAC.4 passes the approver
  through writeAudit's actor, but the dedicated columns come in AUDIT.3).
- **ECO release / policy rollback / credit-note UI** — the primitive supports them (register the kinds), but wiring
  those screens is a fan-out follow-up. RBAC.4 ships PO + Workflow.
- **A notification on approval** → NOTIF.* (leave the seam).

## 4. The primitive (`apps/web/lib/approvals.ts` + shared kinds)

```
type ApprovalKind = "po.approve" | "eco.release" | "policy.rollback" | "creditnote.issue" | "workflow.gate";

interface ApprovalDef<T> {
  kind: ApprovalKind;
  roles: Role[];                                   // who may decide
  load(db, orgId, id): Promise<T | null>;          // org-scoped
  isPending(t: T): boolean;                         // must be AWAITING_APPROVAL
  onApprove(db, orgId, t, approver): Promise<{ output: Json; summary: string }>;  // the effect
  onReject(db, orgId, t, approver): Promise<{ output: Json; summary: string }>;
}

decide(kind, targetId, decision: "APPROVE"|"REJECT", user): Promise<Result>
// requireRole(user, def.roles) FIRST → load org-scoped → assert isPending → run onApprove/onReject
// → writeAudit({ action: `${kind}.${decision.toLowerCase()}`, actor: HUMAN(user), target, output, summary })
```
- **Registry** of `ApprovalDef`s. `po.approve`: DRAFTED/AWAITING_APPROVAL → APPROVED then SENT; roles OPS/ADMIN.
  `workflow.gate`: resume the parked `WorkflowRun` (continue the DAG from the gate node, or mark APPROVED→SUCCEEDED)
  and append a trace line; roles per the workflow's module. Register ECO/policy/credit-note kinds (effects wired, UI later).
- **Idempotent + guarded:** a non-pending target → a clear "already decided" result, never a double-execute. Only the
  server action mutates; never from a client component.

## 5. Workflow resume (close the WF.1 loop)

- On `workflow.gate` approve: load the parked `WorkflowRun`; using WF.1's `WorkflowGraph` + executor, **continue from
  the guardrail gate** down the approved branch to the output (or, minimally, transition AWAITING_APPROVAL → SUCCEEDED
  with a "approved by <user>" trace line appended). Persist the updated trace + status. Reject → FAILED/REJECTED + trace line.
- This must respect WF.1's engine (reuse the executor path; don't fork it) and remain org-scoped + audited.

## 6. UI wiring (the two parked surfaces)

- **Procurement PO queue** (`ProcurementView` + `procurement/actions.ts`): the existing advance button now calls
  `decide("po.approve", id, "APPROVE"|"REJECT")`. Reject is added. Role-gated in UI via `hasRole`; enforced server-side.
- **Workflow detail** (WFL.2): on a run reading AWAITING_APPROVAL, show **Approve / Reject** (role-gated); on decide,
  call `decide("workflow.gate", runId, …)`, then refetch — the run console now shows the resumed/completed trace.
- Buttons in ink (no invented reds); a rejected/parked state renders in ink. No emoji, v2 tokens.

## 7. Tenancy · moat invariants (DoD-blocking)

- **Never auto-execute** a gated action — a human with the right role must click; the primitive has no auto path.
- **Every decision audited** via AUDIT.1 (actor = approver, action, target, output). No decision escapes the log.
- **Isolation:** load + mutate through `dbForOrg(orgId)`; a cross-org decide is rejected.
- **Least privilege:** `requireRole(def.roles)` is line 1 of `decide`; VIEWER can never approve.

## 8. Verification + gate

- `src/scripts/verify-rbac-4.ts` (DB-gated; pure-logic always runs):
  1. `decide("po.approve", …, APPROVE)` by an OPS/ADMIN user transitions the PO to APPROVED→SENT and writes a
     `po.approve.approve` AuditLog entry with the approver; by a VIEWER it throws forbidden (no state change, no audit
     of success).
  2. Reject transitions correctly and audits; a second decide on a non-pending target is a no-op "already decided".
  3. `decide("workflow.gate", runId, APPROVE)` resumes the parked run (status leaves AWAITING_APPROVAL, trace gains an
     "approved by" line) and audits; the seeded procurement-reorder run is the fixture.
  4. Cross-org decide is blocked.
  5. The PO advance now goes exclusively through the primitive (no ad-hoc path remains).
- `docs/manual-checks.md` entry (approve a PO on /procurement; approve a parked run on /workflows/:id → console updates).
- **CI gate:** frozen install · lint · typecheck · verify:all green (incl. verify-audit-1, verify-wf-1 self-clean
  still holds), tsc clean, `prisma migrate status` clean; commit + push; confirm GitHub Actions on `main` green.

## 9. Review gate

**Stop after RBAC.4** and show me: (a) the ApprovalDef registry + `decide`, (b) a PO approved on /procurement with its
AuditLog entry, (c) a parked workflow run resumed to completion on /workflows/:id after approval, and (d) verify-rbac-4
output — before AUDIT.3.

---

### Completeness check (6-point)
1. Story + spec ref — RBAC.4, §5/§8, E2 row 26. ✓
2. Every requirement — primitive, approve/reject actions, PO refactor, workflow resume, UI on the two parked surfaces. ✓
3. DoD — requireRole first, org isolation, every decision audited, verify + manual-checks, tsc clean, CI gate, migrate clean. ✓
4. Real deps — RBAC.1, AUDIT.1, WF.1, PROC.2 surfaces. ✓
5. Moat flagged — never auto-execute, human-in-the-loop, audited, TRUST.1/CONF.1 seam for auto-approval. ✓
6. Review gate — §9. ✓
