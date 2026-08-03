# PRD — PRIV.1: data export + account/org deletion (data-subject rights)

*Go-live checklist §3/§6/§10 ("account deletion and data export exist and actually purge/produce data — a legal
requirement in most regions"), adapted to Axona: B2B multi-tenant, **orgId scoping + RBAC** (not Supabase RLS),
Railway Postgres. Reuses IO.2 export, ADMIN.1 provisioning (in reverse), and the AUDIT.1 immutable log. Moat
invariants apply: **per-tenant isolation is absolute** (a delete/export touches exactly one org's rows, never
another's), and **destructive/safety actions are human-gated + audited** — the app never silently purges.*

## Three capabilities

### 1. Org data export (portability)
An org **owner/admin** can export **all of the org's data** as a downloadable bundle — every org-scoped entity
(units · BOMs/bomLines · parts · inventory · POs · NCRs · ECOs/change orders · tests · configurations · file
metadata · audit trail), reusing **IO.2's `exportEntity`** across the org's entity set into a single archive
(per-entity CSV/xlsx in a zip, or a JSON bundle). Strictly org-scoped — the export contains only that org's rows,
proven by isolation test. This is the portability half of data-subject rights and doubles as tenant offboarding.

### 2. User deprovision / delete
Remove a user from an org (and delete the user account entirely if they belong to no other org) — the reverse of
ADMIN.1's provisioning. On removal: revoke all sessions (bump `tokenVersion`), drop org membership, and if
orphaned, delete the user record. RBAC-gated (owner/admin), **audited** (actor · target · result to AUDIT.1). A
user's own agent-drafted/approved history stays attributable via the immutable audit log (the log is the record
of who did what; removing the user doesn't rewrite history).

### 3. Org data deletion / purge
An org **owner** can request deletion of the org's data. Because this is irreversible and destructive, it is
**gated hard**:
- **Typed confirmation** (type the org name) + **RBAC owner-only** + **explicit audit entry** before anything runs.
- **Soft-delete first**: mark the org `deletedAt`, revoke all members' access immediately (tokenVersion), so the
  tenant is dark right away — but the data isn't gone yet (a grace window; recoverable).
- **Purge** as a separate, explicit admin/worker step after the window: hard-delete all org-scoped operational
  rows, org-scoped **EXACT** (a single `orgId` predicate per model; never a wildcard — the VERIFY.4 lesson).
- **Audit retained**: the record *that* the org was deleted (who · when · confirmation) is kept; the deletion is
  itself an audited event. (Operational data is purged; the meta-record of the erasure survives — standard for
  data-subject erasure.)

## Safety / gating (non-negotiable)
- Every destructive op requires: RBAC (owner/admin) · explicit confirmation · an AUDIT.1 entry with actor +
  inputs + result. The app **never** deletes without a human explicitly confirming — this is the "human approves
  safety" moat invariant applied to data.
- **Per-tenant isolation is the hard invariant**: export and delete resolve exactly one `orgId`'s rows; a
  cross-tenant leak or over-delete is a P0. Prove it (org B's data is untouched by org A's export/delete, and
  vice-versa).
- No `LIKE`/wildcard predicates on deletion (VERIFY.4) — exact `orgId` scoping only.

## DoD / verification
- Export: produces a bundle containing the org's entities and **only** that org's rows (isolation test: org B's
  rows absent); reuses IO.2, no parallel exporter.
- User delete: revokes sessions (old token rejected), drops membership, deletes an orphaned account; audited.
- Org delete: typed-confirmation + owner-RBAC enforced; soft-delete darkens the tenant immediately; purge removes
  exactly the org's rows and **nothing from another org** (the P0 isolation assertion); the deletion is audited
  and the meta-record survives the purge.
- `verify-priv-1.ts` asserts: export completeness + export isolation · user-delete revokes + audits · org purge
  is org-exact (2nd org fully intact after) · every destructive op wrote an AUDIT.1 entry · confirmation/RBAC gates
  reject an unauthorized/unconfirmed attempt.
- orgId-scoped; RBAC; tsc --noEmit clean; verify:all + eval green; additive migration (`deletedAt` flags) via
  `prisma migrate dev` — never `db push` (MIGRATE.1); docs/manual-checks.md entry.

## Guardrails
Destructive ops gated + confirmed + audited · exact `orgId` scoping, never a wildcard · per-tenant isolation is
P0 (prove other tenants untouched) · soft-delete + grace window before purge · reuse IO.2 export + ADMIN.1 +
AUDIT.1, no parallel systems · additive migration only, no db push · the agent never initiates a delete — a human
owner does.
