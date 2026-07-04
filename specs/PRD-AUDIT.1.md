# PRD — AUDIT.1 · Immutable event log + writer

**Story:** AUDIT.1 — Audit-log model + writer on every mutation & agent action.
**Spec ref:** `specs/axona-build-spec.md` §5/§8; backlog E2 row 27. **First story of the propose→approve→audit epic.**
**Priority / size:** P0 · M (3 dev-days). **Track:** Platform (E2). **Depth:** Full CPRD (moat-load-bearing —
this is the first brick of ONT.1's immutable event log; the substrate the learning loop reads).
**Dependencies:** FND.11 (dbForOrg, migrations — landed), RBAC.1 (requireRole — landed in apps/web/lib/rbac.ts).
Note: backlog lists RBAC.2 (per-route authZ) as a dep; RBAC.2 is a seam — AUDIT.1 proceeds on the existing
requireRole enforcement + orgId scoping and does not block on it.

**Moat-load-bearing.** "Propose→approve→audit is the product." Every agent action + human decision must land in an
**append-only** log — inputs · output · actor · action · target. AUDIT.3 enriches each entry with model · confidence ·
approver; ONT.1 later hardens this exact table into the ontology event log. Get the shape and the immutability right now.

---

## 1. Context — what exists

- **RBAC.1 (`apps/web/lib/rbac.ts`):** `requireRole(user, roles)` (throws) + `hasRole` — the enforcement point every
  mutation already calls. 7 roles: ADMIN/OPS/ENGINEER/SALES/FINANCE/TECH/VIEWER.
- **Mutation points that must log (today, all carrying `/// AUDIT.3` seams):** the PO advance in
  `apps/web/app/(shell)/procurement/actions.ts`; the WF.1 workflow run (executor writes WorkflowRun.trace); MTX.1
  column extraction (writes File.extracted); FILE.1 upload/delete. These are where the writer gets wired.
- **No AuditLog model or writer exists.** MIGRATE.1 rule holds: schema via `prisma migrate dev`, NEVER `db push`.

## 2. Goals

1. An **append-only `AuditLog`** model + migration (org-scoped, indexed for the trail viewer).
2. A single **`writeAudit()`** helper — the only way anything writes the log — capturing actor · action · target ·
   inputs · output · summary, org-scoped, never throwing into the caller's critical path.
3. **Wire it** into the existing mutation + agent-action points so the log fills from real activity.
4. **Seed** a handful of historical entries so a future trail viewer (AUDIT.2) and the demo render populated.

## 3. Non-goals (explicit)

- **model · confidence · approver** columns → AUDIT.3 (next story). AUDIT.1's entries are the base shape.
- **The approval state machine** (transitions, resume parked runs) → RBAC.4.
- **The audit-trail viewer screen** → AUDIT.2.
- **Cross-tenant / ontology graph** (ONT.1) — leave the seam; this is a flat append-only table for now.
- Retention/rotation policy — out of scope.

## 4. Data model (via `prisma migrate dev`)

```
enum AuditActor { HUMAN AGENT SYSTEM }

model AuditLog {
  id           String      @id @default(cuid())
  orgId        String
  actorType    AuditActor
  actorId      String?     // userId or agentId (null for SYSTEM)
  actorLabel   String      // denormalized display ("M. Osei" / "Sourcing agent" / "system")
  action       String      // dotted verb: "po.advance", "workflow.run", "column.extract", "file.upload"
  targetType   String      // "PurchaseOrder" | "WorkflowRun" | "MatrixColumn" | "File" | …
  targetId     String
  summary      String      // one line, human-readable
  inputs       Json?       // what the actor/agent saw
  output       Json?       // what resulted (e.g. { status: "AWAITING_APPROVAL" })
  correlationId String?    // ties a chain together (a run, an approval thread)
  createdAt    DateTime    @default(now())
  /// AUDIT.3 adds: model · confidence · approver (populate there, don't add now).
  /// ONT.1 hardens this table into the immutable ontology event log — don't fork it.
  @@index([orgId, createdAt])
  @@index([targetType, targetId])
}
```
- **Append-only (immutability):** the writer only INSERTs. There is no update/delete code path, no API to mutate a
  row, and the migration adds a rule to block UPDATE/DELETE (`CREATE RULE audit_no_update AS ON UPDATE TO "AuditLog"
  DO INSTEAD NOTHING` + same for DELETE) — captured as committed raw SQL (MIGRATE.1 invariant, re-asserted in the
  ensure-raw-sql migration). `prisma migrate status` clean.

## 5. Writer (`apps/web/lib/audit.ts` + a db-package export for the worker)

```
writeAudit(db, {
  orgId, actor: { type, id?, label }, action, target: { type, id },
  summary, inputs?, output?, correlationId?
}): Promise<void>
```
- The ONLY way to write the log. Org-scoped (writes through the same `dbForOrg(orgId)` the mutation used).
- **Never throws into the caller's critical path** — wrap the insert in try/catch; a logging failure must not roll back
  the business mutation (but is itself logged to the server console). Logging is best-effort *durability*, mandatory
  *intent*: every gated mutation calls it.
- Usable from both `apps/web` (server actions/routes) and `apps/worker` (the executor) — put the core in the db package.

## 6. Wire-up (make the log fill from real activity)

Add a `writeAudit` call at each existing mutation/agent point (base entry now; AUDIT.3 enriches):
- **PO advance** (`procurement/actions.ts`): `action:"po.advance"`, actor = the acting user, target = the PO,
  output = the new status. (This replaces the `/// AUDIT.3` seam with a real base entry.)
- **Workflow run** (WF.1 executor): `action:"workflow.run"`, actor = AGENT (the orchestrator) / SYSTEM, target = the
  WorkflowRun, output = final status incl. AWAITING_APPROVAL; `correlationId = runId`.
- **Column extraction** (MTX.1 job): `action:"column.extract"`, actor = AGENT, target = the MatrixColumn.
- **File upload/delete** (FILE.1): `action:"file.upload"|"file.delete"`, actor = the user.
- Keep each call one line at the mutation site — do not restructure the actions.

## 7. Seed — richness = mock richness

Seed ~15–25 historical AuditLog entries across the through-line so a trail renders populated: agent drafts (Sourcing
agent → PO-9001 drafted, AWAITING_APPROVAL), the NCR-118→ECO-318 workflow run, a file upload, a column extraction.
Realistic timestamps over the last few days. Idempotent.

## 8. Tenancy · moat invariants (DoD-blocking)

- **Isolation:** every entry carries `orgId`; every read filters by the session org. One tenant's trail never leaks.
- **Immutability is the point** — append-only, enforced at the writer AND the DB rule. An audit you can edit is not an audit.
- **Feeds-the-loop:** this table is the capture ONT.1/MEM.1/LOOP consume; shape it right, leave the `/// ONT.1` seam.
- **guardrails.config:** the log records intent + output for every gated action — the evidence trail behind
  never-auto-execute.

## 9. Verification + gate

- `src/scripts/verify-audit-1.ts` (DB-gated; pure-logic checks always run):
  1. `writeAudit` inserts an org-scoped row with the expected shape; a forced insert failure does NOT throw into the
     caller (returns, logs to console).
  2. Append-only: an attempted UPDATE and DELETE on an AuditLog row are no-ops (the rule holds); the row is unchanged.
  3. A PO advance writes a `po.advance` entry; a workflow run writes a `workflow.run` entry with the runId correlationId.
  4. Cross-org read isolation: org A's entries are invisible via org B's dbForOrg.
  5. Seed produced the historical entries (count > 0, spans the through-line targets).
- `docs/manual-checks.md` entry.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all`;
  tsc clean; verify:all green; `prisma migrate status` clean; commit + push; confirm GitHub Actions on `main` green.

## 10. Review gate

**Stop after AUDIT.1** and show me: (a) the AuditLog model + the append-only rule, (b) `writeAudit` and one wired call
site (the PO advance), (c) proof an UPDATE/DELETE on a row is a no-op, and (d) verify-audit-1 output — before RBAC.4.

---

### Completeness check (6-point)
1. Story + spec ref — AUDIT.1, §5/§8, E2 row 27. ✓
2. Every requirement — model, writer, wire-up, seed, append-only. ✓
3. DoD — org isolation, verify + manual-checks, tsc clean, CI gate, migrate clean, raw-SQL rule in a migration. ✓
4. Real deps — FND.11, RBAC.1; RBAC.2 seam noted. ✓
5. Moat flagged — immutable log, ONT.1 seam, feeds-the-loop, AUDIT.3 enrichment deferred. ✓
6. Review gate — §10. ✓
