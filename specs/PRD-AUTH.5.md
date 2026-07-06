# PRD — AUTH.5 · Invite + accept-invite (join an existing org)

**Story:** AUTH.5 — Invite + accept-invite flow (email token → join org with a role).
**Spec ref:** `specs/axona-build-spec.md` §8; backlog E1 row 20.
**Priority / size:** P0 · M (3 dev-days). **Track:** Platform (E1). **Depth:** Full CPRD (token-based
public join → provisions a real user into a tenant; security-load-bearing).
**Dependencies:** AUTH.1 (session, bcrypt, `/invite/*` already public in middleware), AUTH.4 (org provisioning
pattern), AUTH.6 (the onboarding "team" step, currently collect-only, gets wired here). Design:
`design/prototypes/axona-v2/Accept Invite.dc.html` (imported).

**Security note.** `/invite/:token` is **public** and creates a user inside an existing org at a chosen role.
Tokens must be unguessable, single-use, and expiring; the new user gets **exactly the invited role** (never ADMIN
unless invited as ADMIN); email stays globally unique.

---

## 1. Context — what exists

- **AUTH.1:** session, `verifyCredentials`, bcrypt hasher, `/invite/*` public route. **AUTH.4:** `createWorkspace`
  provisioning pattern (Zod + one-txn create). **AUTH.6:** the onboarding **team step** collects email+role rows but
  does NOT create live invites yet (`/// AUTH.5` seam).
- **Models:** `User { orgId, name, email @unique, role, passwordHash }`, `Org`. **No `Invite` model** — added here.
- **No email delivery yet** (EMAIL.1). Invites will surface as a **copyable link** for now.

## 2. Goals

1. An **`Invite`** model + a **`createInvites`** action (an org member with rights invites email+role).
2. **Wire AUTH.6's team step** to `createInvites` (replace collect-only) and surface the **invite links** to copy.
3. `/invite/:token` **accept screen** (1:1 to `Accept Invite.dc.html`): shows who invited them + the role, they set
   name + password → **join the org at the invited role**, auto sign-in → `/core`.
4. A minimal **pending-invites list** + **revoke** (the full members-admin screen is SET.2).

## 3. Non-goals (explicit)

- **Emailing the invite** → EMAIL.1 (Resend). For now the inviter copies the link and sends it manually (flag).
- **The members & roles admin screen** → SET.2 (AUTH.5 gives create/list/revoke + accept; SET.2 is the full UI).
- **Changing an existing member's role / deactivation** → SET.2.
- **SSO-based join** → AUTH.2.

## 4. Data model

New model via `prisma migrate dev` (NEVER db push):
```
enum InviteStatus { PENDING ACCEPTED REVOKED EXPIRED }

model Invite {
  id         String       @id @default(cuid())
  orgId      String
  email      String                       // invited address (lowercased)
  role       Role                         // the role they'll join at
  token      String       @unique         // crypto-random, unguessable (e.g. 32-byte base64url)
  status     InviteStatus @default(PENDING)
  invitedById String                      // the user who created it
  invitedByLabel String                   // denormalized for the accept screen ("M. Osei")
  createdAt  DateTime     @default(now())
  expiresAt  DateTime                     // e.g. now + 7 days
  acceptedAt DateTime?
  @@index([orgId])
  @@index([token])
  @@index([email])
}
```
`prisma migrate status` clean; FTS/pgvector intact.

## 5. Invite creation (`apps/web/lib/invites.ts` + an action)

`createInvites(orgId, rows: {email, role}[], invitedBy)` — server-only, **role-gated** (ADMIN, and optionally OPS —
per the RBAC rule for who can invite; default ADMIN):
- Validate emails (Zod, lowercase); dedupe within the batch.
- **Skip/flag** an email that is already a `User` (globally unique — they already have an account) or already has a
  PENDING invite for this org (return a per-row status rather than erroring the whole batch).
- Create `Invite` rows with a crypto-random `token`, `expiresAt = now + 7d`, `status = PENDING`, `invitedByLabel`.
- Return each invite's **link** `${APP_URL}/invite/${token}` for the caller to copy (until EMAIL.1 sends it).
- **Wire AUTH.6's team step** to call this on Finish/step-submit (replace the collect-only stub); surface the links.
- A `listInvites(orgId)` (PENDING) + `revokeInvite(orgId, id)` (role-gated → status REVOKED).

## 6. Accept flow (`/invite/:token`, 1:1 to Accept Invite.dc.html)

- **Public** (middleware already allows `/invite/*`). Load the invite by token:
  - invalid / REVOKED / ACCEPTED / `expiresAt < now` → a clean "this invite is no longer valid" state (offer /login).
- Valid PENDING → render 1:1 to the design: "**{invitedByLabel}** invited you to join **{Org.name}** as
  **{role}**" (role as a mono pill), fields: **name**, **set password** (email shown, locked). Primary "Join {Org.name}".
- On submit — server action, **one transaction**:
  - re-check the invite is still PENDING + unexpired (race-safe);
  - if the email now already has a User → error ("account already exists — log in");
  - create `User { orgId: invite.orgId, name, email: invite.email, role: invite.role, passwordHash: bcrypt(pw) }`;
  - mark the invite `ACCEPTED` + `acceptedAt`;
  - **auto sign-in** → redirect to `/core` (the org is already onboarded — no onboarding wizard for invitees).
- The new user gets **exactly `invite.role`** — never escalated.

## 7. Security · isolation (DoD-blocking)

- **Token:** crypto-random (≥ 32 bytes), unguessable, unique, **single-use** (PENDING→ACCEPTED), **expiring** (7d).
- **Least privilege:** invitee joins at the invited role only; creating invites is role-gated (ADMIN).
- **Isolation:** an invite binds one `orgId`; accepting only ever creates a user in that org. No cross-org escalation.
- **Email uniqueness** respected; no account takeover of an existing email via invite.
- Passwords bcrypt-hashed (reuse AUTH.1), never plaintext/logged.

## 8. Verification + gate

- `src/scripts/verify-auth-5.ts` (DB-gated; pure-logic always runs):
  1. `Invite` model + enum + token uniqueness; migrate status clean.
  2. `createInvites` (as ADMIN) creates PENDING invites with unique tokens + 7d expiry; a VIEWER is forbidden; an
     already-existing email / duplicate pending returns a per-row skip (batch not aborted).
  3. Accepting a valid token creates a User in the invite's org **at the invited role** (bcrypt hash verifies), marks
     the invite ACCEPTED, and the token can't be reused (second accept → invalid).
  4. Expired / revoked / already-accepted tokens → the invalid state, no user created.
  5. Isolation: the accepted user's `dbForOrg` sees the inviting org, not others; role is exactly as invited (no ADMIN
     unless invited ADMIN).
  6. AUTH.6 team step now creates real invites (not collect-only) and returns links.
- `docs/manual-checks.md`: ADMIN invites `ops2@…` as OPS → copy link → open in a private window → set name/password →
  lands in the org on /core as OPS (approve buttons gated per OPS); a reused link shows invalid.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all` +
  **`pnpm build` compiles**; migrate status clean; commit + push; confirm GitHub Actions green.

## 9. Review gate

**Stop after AUTH.5** and show me: (a) the Invite migration + `createInvites`, (b) the onboarding team step creating
real invites with copyable links, (c) accepting an invite → a new user joining the org at the invited role, landing on
/core, (d) a reused/expired token showing the invalid state, and (e) verify-auth-5 output — before continuing.

---

### Completeness check (6-point)
1. Story + spec ref — AUTH.5, §8, E1 row 20. ✓
2. Every requirement — Invite model, create/list/revoke, wire AUTH.6, accept screen + join. ✓
3. DoD — token security, role-gating, isolation, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — AUTH.1/4/6, Accept Invite.dc.html. ✓
5. Security flagged — unguessable single-use expiring token, least-privilege role, isolation, email-uniqueness; email delivery/members-screen scoped out. ✓
6. Review gate — §9. ✓
