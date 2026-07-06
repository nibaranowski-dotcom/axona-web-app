# PRD — AUTH.4 · Signup + org provisioning

**Story:** AUTH.4 — Signup + org provisioning (create Org, seat the creator as ADMIN, sign them in).
**Spec ref:** `specs/axona-build-spec.md` §8; backlog E1 row 19.
**Priority / size:** P0 · M (3 dev-days). **Track:** Platform (E1). **Depth:** Full CPRD (real provisioning + a
public entry point that creates a tenant — get isolation + validation right).
**Dependencies:** AUTH.1 (Auth.js credentials + session + User.passwordHash — landed). Design:
`design/prototypes/axona-v2/Signup.dc.html` (imported).

**Security note.** This is a **public, unauthenticated** endpoint that mints a new tenant + its first ADMIN.
Validate hard, hash the password, and make the new org fully isolated. A new org starts **empty** — that's correct.

---

## 1. Context — what exists

- **AUTH.1:** Auth.js Credentials + JWT session (`orgId`+`role`), `User.passwordHash` (bcryptjs), `verifyCredentials`,
  middleware. `/signup` is already a **public** route in the middleware allowlist.
- **Models:** `Org { id, name, createdAt, …back-relations }` — **minimal, no slug/industry**. `User { orgId, name,
  email @unique, role, passwordHash }`. **`Module` is GLOBAL** (no orgId — seeded once, idempotent by key), so a new
  org automatically sees the full module nav; only *domain data* (agents, POs, projects, …) is per-org.
- **Design:** `Signup.dc.html` — "your account" (name, work email, password) + "your workspace" (org name,
  auto-suggested URL slug, industry), primary "Create workspace".

## 2. Goals

1. `/signup` built 1:1 to `Signup.dc.html` (full-screen, no shell), wired to a **provisioning server action**.
2. `createWorkspace({ name, email, password, orgName, industry })` — validate, create the **Org**, create the first
   **User as ADMIN** (bcrypt-hashed password), then **auto sign-in** and redirect.
3. **New-org isolation:** the creator lands in their own empty org; nothing from the demo (or any other) org is visible.

## 3. Non-goals (explicit — later stories)

- **SSO signup** → AUTH.2. **Invite/accept-invite** (joining an *existing* org) → AUTH.5. **Onboarding wizard**
  (profile → invite team → enable modules) → AUTH.6. **Post-auth new→onboarding routing** → AUTH.3.
- **Per-org module enablement** (turning modules off for an org) and **default per-org agent provisioning** — later
  (SET.1 / a provisioning story). A new org sees all global modules with empty domain data; that's expected here.
- **Email verification** → AUTH.7 (the account is usable immediately on signup for now; flag).
- **Billing / plan selection at signup** → BILL.* (new orgs start on the default/pilot plan implicitly).

## 4. Data model

Re-use Org + User. **Bounded additions to Org** via `prisma migrate dev` (NEVER db push):
- `Org.slug String @unique` — the workspace URL slug (e.g. `axona-demo-co`); derived from orgName, uniqueness enforced.
- `Org.industry String?` — Humanoid / Mobility / Industrial / … (nullable; from the signup select).
`prisma migrate status` clean; FTS/pgvector intact.

## 5. Provisioning action (`apps/web/app/signup/actions.ts` or a route handler)

`createWorkspace(input)` — **public** (no session), runs on the server only:
1. **Validate:** name + orgName non-empty; email is a valid work email; password meets a min strength (length ≥ 8,
   documented rule); industry from the allowed set. Zod-validate the whole input.
2. **Email uniqueness:** if `User.email` already exists → return a clean field error ("An account with this email
   already exists — log in instead.") — never 500, never leak whether it's the same org.
3. **Slug:** derive from orgName (kebab-case); if taken, auto-suffix (`-2`, `-3`) until unique (or surface an editable
   slug field per the design).
4. **Provision (one transaction):** create `Org { name, slug, industry }`, then create `User { orgId, name, email,
   role: ADMIN, passwordHash: bcrypt(password) }`. The creator is the org's first ADMIN.
5. **Auto sign-in:** establish the Auth.js session for the new user (signIn credentials / issue the JWT) so they're
   logged in immediately.
6. **Redirect:** to `/onboarding` (AUTH.6). Until AUTH.6/AUTH.3 land, `/onboarding` may be a thin redirect to `/core`
   — so a fresh signup reaches the Command Center. Flag that the onboarding step slots in here later.

## 6. Signup screen (`/signup`, 1:1 to Signup.dc.html)

- Full-screen, no shell; the `axona` wordmark + dotted-grid, matching `/login`. Two logical groups (account +
  workspace) per the design, with the live-suggested workspace URL. Primary "Create workspace"; a link to `/login`.
- On submit → `createWorkspace`; on a field error (email taken, weak password) show the **inline ink error** (no
  invented reds); on success the action redirects. v2 tokens, no emoji, Lucide icons.
- Reassurance line per the design ("Free while in pilot · no card required").

## 7. The empty-org reality (flag, don't fabricate)

A newly-provisioned org has **no seeded domain data** — agents, POs, projects, etc. are all per-org and empty. Every
screen must render its existing **empty state** gracefully for a fresh org (they already have "no data — run the seed"
style states; ensure they read sensibly for a real new org, not a dev-seed hint). Global modules populate the nav.
Default per-org agent/module provisioning is a later story — record it in the deferred-ledger; do NOT auto-copy the
demo org's data.

## 8. Security · isolation (DoD-blocking)

- **Public but hardened:** Zod validation, password bcrypt-hashed (reuse AUTH.1's hasher), never plaintext; no
  password in logs. Consider a light anti-abuse note (rate-limit is deferred/flagged — not built here).
- **Isolation:** the new session's `orgId` is the new Org; the user sees only their org (dbForOrg). No path to read or
  join another org via signup (joining is AUTH.5 invite-only).
- **First user = ADMIN of their own org only** — not a global admin.

## 9. CI-safety + verification

- `src/scripts/verify-auth-4.ts` (DB-gated; pure-logic always runs):
  1. `Org.slug` unique + `industry` exist; migrate status clean.
  2. `createWorkspace` with valid input creates an Org + an ADMIN User with a **bcrypt hash** (not plaintext); the
     password verifies via `verifyCredentials`.
  3. Duplicate email → a clean field error, no new Org/User created, no 500.
  4. Slug collision → a unique slug is produced (suffix), no crash.
  5. Isolation: the new ADMIN's `dbForOrg(newOrgId)` sees an empty org and cannot read the demo org's data.
  6. Zod rejects weak password / bad email / empty org name.
- `docs/manual-checks.md`: sign up → lands logged-in on Command Center (empty org); an existing email shows the inline
  error; `/signup` reachable while logged out; a second signup makes a separate isolated org.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all` +
  **`pnpm build` compiles** (the `/signup` route + action — the build-in-CI check AUTH.1 added). migrate status clean;
  commit + push; confirm GitHub Actions green.

## 10. Review gate

**Stop after AUTH.4** and show me: (a) the Org.slug/industry migration + `createWorkspace` action, (b) a signup
creating an isolated org with an ADMIN (hashed password) and landing logged-in on the Command Center, (c) the
duplicate-email inline error, (d) proof the new org can't see the demo org's data, and (e) verify-auth-4 output —
before continuing.

---

### Completeness check (6-point)
1. Story + spec ref — AUTH.4, §8, E1 row 19. ✓
2. Every requirement — signup screen, provisioning action, Org creation, ADMIN seating, auto sign-in + redirect. ✓
3. DoD — validation, hashed password, isolation, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — AUTH.1, Signup.dc.html. ✓
5. Security/moat flagged — public-endpoint hardening, isolation, ADMIN-of-own-org, empty-org reality, deferred rate-limit/verify/provisioning. ✓
6. Review gate — §10. ✓
