# PRD — SET.3 · Your profile & security

**Story:** SET.3 — User settings (profile · password · sessions/devices).
**Spec ref:** §8; backlog E9 row 101. **Pri/size:** P1 · S–M. **Track:** Platform (E9). **Depth:** Full CPRD.
**Deps:** AUTH.1 (session, bcrypt, verifyCredentials), SET.2 (Settings sub-nav), AUDIT.1. Design:
`design/prototypes/axona-v2/Settings - Profile.dc.html`.

## Context
AUTH.1 uses a **JWT (stateless) session** — no server session table. `User { name, email, role, passwordHash }`.

## Goals
`/settings/profile` (1:1 to the design, in the shell + Settings sub-nav): **Profile** (name, avatar, email +
role read-only), **Password** (change), **Sessions & devices** (list + revoke). The signed-in user edits their own.

## Non-goals
Admin of *other* users → SET.2. Org config → SET.1. 2FA/passkeys → later (flag).

## Data model (via `prisma migrate dev`, never db push)
- `User.avatarKey String?` (avatar blob via FILE.1 storage, optional — defer if heavy, flag).
- `User.tokenVersion Int @default(0)` — bumped by "sign out everywhere"; the JWT carries it and the `session`
  callback rejects a token whose version ≠ `User.tokenVersion`.
- `LoginSession` model (for the device list): `{ id, userId, orgId, device, ip, lastSeenAt, createdAt }` — created/
  updated on successful login. (Per-session remote revoke is limited under JWT; the reliable control is
  "sign out everywhere" via tokenVersion — flag that in the UI.) migrate clean.

## Actions (`/settings/profile/actions.ts`) — own-user only, org-scoped, audited
- `updateProfile({ name, avatar? })` — Zod; avatar via FILE.1 storage. Audit `user.profile_change`.
- `changePassword({ current, next })` — verify `current` via bcrypt against the session user's hash; reject if wrong;
  set `passwordHash = bcrypt(next)` (min-strength); **bump tokenVersion** (invalidate other sessions). Audit
  `user.password_change` (never log the password).
- `signOutEverywhere()` — bump `tokenVersion`, clear the current cookie → `/login`. Audit `user.signout_all`.
- `revokeSession(id)` — best-effort: delete the LoginSession row; note full JWT revoke needs sign-out-everywhere (flag).
- Wire login (AUTH.1) to upsert a LoginSession + update lastSeenAt/lastSeenAt (SET.2's field) on each sign-in, and to
  put `tokenVersion` in the JWT + enforce it in the session callback.

## Guardrails
Own-user only (never edit another user here — that's SET.2); `changePassword` requires the current password;
tokenVersion enforced so a changed password invalidates stale tokens; bcrypt, no plaintext/logs; audited.

## Verify + gate (`src/scripts/verify-set-3.ts`)
1. avatarKey/tokenVersion + LoginSession exist; migrate clean.
2. changePassword rejects a wrong current password; on success re-hashes + bumps tokenVersion; a stale-version token
   is rejected by the session callback.
3. signOutEverywhere bumps tokenVersion (old tokens invalid); updateProfile updates + audits.
4. LoginSession is written on login; revokeSession removes its row.
5. A user can only edit their own record (cross-user/cross-org write rejected).
CI gate: install --frozen-lockfile · lint · typecheck · verify:all · **pnpm build** · migrate clean · a11y 0 on
/settings/profile; commit + push; Actions green.

## Review gate
Stop after SET.3; show: migration + the three actions, a password change invalidating other sessions, the device
list, and verify-set-3 output.
