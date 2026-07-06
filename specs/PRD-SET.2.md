# PRD — SET.2 · Members & roles administration

**Story:** SET.2 — Member & role administration (invite, change role, deactivate) — ADMIN-gated.
**Spec ref:** `specs/axona-build-spec.md` §8 (RBAC); backlog E9 row 100.
**Priority / size:** P0 · M (3 dev-days). **Track:** Platform (E9). **Depth:** Full CPRD (RBAC admin surface +
the first Settings screen; establishes the settings sub-nav shell).
**Dependencies:** AUTH.1 (session/RBAC), AUTH.5 (Invite model + createInvites/listInvites/revokeInvite),
AUDIT.1 (writeAudit). Design: `design/prototypes/axona-v2/Settings - Members.dc.html` (imported).

**This is the "user management" surface** — it turns the RBAC we've built all session into a visible, audited
admin screen, and it's the first screen in the **Settings** area (establish the sub-nav here; SET.1/3/4/5 plug in).

---

## 1. Context — what exists

- **User** { orgId, name, email @unique, role, passwordHash } — **no active/deactivated flag, no lastSeen**.
- **AUTH.5:** `Invite` (PENDING/ACCEPTED/REVOKED/EXPIRED) + `createInvites` / `listInvites` / `revokeInvite`.
- **AUTH.1:** `verifyCredentials` (login), `requireRole`/`hasRole`, session. **AUDIT.1:** `writeAudit`.
- **Shell:** 240px sidebar + 60px topbar. No settings sub-nav yet.

## 2. Goals

1. `/settings/members` built 1:1 to `Settings - Members.dc.html`, inside the app shell, with a **Settings sub-nav**
   (Organization · Members · Your profile · Notifications · Integrations · Billing) — establish it here.
2. The **members roster** (the signature artifact): every member (name · email · role · status · last active) +
   **pending invites**, with ADMIN actions: **invite**, **change role**, **deactivate/reactivate**, **revoke invite**.
3. Every member-management action is **ADMIN-gated, org-scoped, and audited** (AUDIT.1).

## 3. Non-goals (explicit)

- **Org profile / branding / module enablement** → SET.1. **Your profile & security** → SET.3. **Notification prefs**
  → SET.4. **Integrations / SSO / API keys** → SET.5. (Their sub-nav items are present but link to a placeholder /
  "coming soon" until built — flag.)
- **Emailing the invite** → EMAIL.1 (still a copyable link here).
- **SSO provisioning / SCIM** → AUTH.2 / later.

## 4. Data model

Bounded additions to User via `prisma migrate dev` (NEVER db push):
- `User.deactivatedAt DateTime?` — set = deactivated (can't log in, not an active seat). Null = active.
- `User.lastSeenAt DateTime?` — updated on successful login (in `verifyCredentials`/the auth callback) to power the
  "last active" column. (If the design doesn't show last-active, this is optional — but include it; it's cheap.)
`prisma migrate status` clean; FTS/pgvector intact.

## 5. Read model (`apps/web/lib/members.ts`)

- `getMembers(orgId)` — org-scoped: the org's Users (id, name, email, role, status = ACTIVE | DEACTIVATED from
  `deactivatedAt`, lastSeenAt) **plus** the PENDING invites (email, role, invitedByLabel, createdAt) rendered as
  "Invited" rows. Rollup for the header: active member count, pending count, counts by role, seat usage.
- A small **role → capability** summary for the legend (what each of the 7 roles can do) — static, from RBAC.

## 6. Actions (`apps/web/app/(shell)/settings/members/actions.ts`) — ALL ADMIN-gated + org-scoped + audited

Each is a server action; `requireRole(user, ["ADMIN"])` is line 1; loads/mutates via `dbForOrg(user.orgId)`; and
calls `writeAudit(...)` on success.
- **inviteMembers(rows)** → reuse AUTH.5 `createInvites` (returns copyable links; per-row skip). Audit `member.invite`.
- **changeRole(userId, newRole)** → guard: the target is in this org; **cannot remove the last ADMIN** (if the target
  is the only ADMIN and newRole ≠ ADMIN → reject with a clear message). Audit `member.role_change` (from→to, target).
- **setActive(userId, active: boolean)** → deactivate/reactivate. Guards: **cannot deactivate the last ADMIN**, and
  **cannot deactivate yourself**. Sets/clears `deactivatedAt`. Audit `member.deactivate` / `member.reactivate`.
- **revokeInvite(inviteId)** → reuse AUTH.5 `revokeInvite`. Audit `member.invite_revoke`.
- **Login enforcement:** update `verifyCredentials` (AUTH.1) to **reject a user whose `deactivatedAt` is set** (return
  null / the same "can't sign in" path) — a deactivated member can't authenticate.

## 7. Screen (`/settings/members`, 1:1 to Settings - Members.dc.html)

- In the shell; a **Settings sub-nav** on the left of the content pane (or per the design) with the six sections;
  Members active. Build the sub-nav as a reusable piece the other SET.* screens reuse.
- **Members table** (signature artifact): Person (avatar + name + email) · Role (mono pill; **editable select** for
  ADMIN) · Status (Active / Invited / Deactivated) · Last active · row actions (change role · deactivate/reactivate ·
  revoke for invites). "Invite people" opens an email + role row → `inviteMembers` → shows the copyable link.
- **Role-gating in UI:** ADMIN sees the controls; non-ADMIN sees the roster **read-only** (or is redirected if the
  design/spec says members admin is ADMIN-only — default: read-only view for non-admins, controls hidden). Enforced
  server-side regardless.
- Ink for attention states (deactivated), functional green for active; no invented reds; v2 tokens; no emoji.

## 8. Tenancy · guardrails (DoD-blocking)

- **ADMIN-gated** writes (requireRole line 1); **org isolation** (only your org's members/invites); the **last-ADMIN
  and self-deactivation guards** must hold. Deactivated users can't log in.
- **Audited:** every role change / (de)activation / invite / revoke writes an AUDIT.1 entry (actor = the ADMIN,
  target = the member) → visible on `/audit`.

## 9. Verification + gate

- `src/scripts/verify-set-2.ts` (DB-gated; pure-logic always runs):
  1. `User.deactivatedAt`/`lastSeenAt` exist; migrate clean.
  2. `getMembers` returns users + PENDING invites with correct status; rollup counts right; org-scoped (no other org).
  3. `changeRole` by ADMIN updates the role + writes `member.role_change`; a VIEWER is forbidden; **last-ADMIN demotion
     is rejected**.
  4. `setActive(false)` deactivates + audits; a **deactivated user fails `verifyCredentials`**; **can't deactivate the
     last ADMIN or yourself**; reactivate restores login.
  5. `inviteMembers` (ADMIN) creates invites (reusing AUTH.5) + audits; `revokeInvite` audits.
  6. Non-ADMIN cannot perform any write (server-side), and cross-org targets are rejected.
- `docs/manual-checks.md`: as ADMIN, invite `ops2@…`, change a member OPS→ENGINEER, deactivate a member (they can no
  longer log in), and see all four actions in `/audit` with you as approver/actor.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all` +
  **`pnpm build` compiles**; migrate status clean; accessibility-review = 0 on `/settings/members`; commit + push;
  confirm GitHub Actions green.

## 10. Review gate

**Stop after SET.2** and show me: (a) the migration + the members read model, (b) `/settings/members` with the roster
(members + pending invites) and the settings sub-nav, (c) a role change and a deactivation each landing in `/audit`
with the last-ADMIN guard proven, (d) a deactivated user failing login, and (e) verify-set-2 output — before continuing.

---

### Completeness check (6-point)
1. Story + spec ref — SET.2, §8, E9 row 100. ✓
2. Every requirement — roster + invites, invite/change-role/deactivate/revoke, settings sub-nav. ✓
3. DoD — ADMIN-gated, org isolation, last-ADMIN/self guards, audited, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — AUTH.1/5, AUDIT.1, Settings - Members.dc.html. ✓
5. Guardrails flagged — least-privilege, isolation, last-ADMIN protection, deactivated-can't-login, audit; email/other-settings scoped out. ✓
6. Review gate — §10. ✓
