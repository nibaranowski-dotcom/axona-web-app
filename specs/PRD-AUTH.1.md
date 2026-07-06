# PRD — AUTH.1 · Real authentication (Auth.js email/password + session + protected routes)

**Story:** AUTH.1 — Auth.js email/password + session + protected-route middleware; replace the `getCurrentUser` stub.
**Spec ref:** `specs/axona-build-spec.md` §8; backlog E1 row 16. **First story of the platform / "true app" track.**
**Priority / size:** P0 · M (3–4 dev-days). **Track:** Platform (E1). **Depth:** Full CPRD (the security spine —
every screen, every `dbForOrg`, and all of RBAC now depend on a real session).
**Dependencies:** FND.5 (User/Org/Role models — landed), FND.11 (dbForOrg — landed), RBAC.1 (requireRole — landed).
Design: `design/prototypes/axona-v2/Login.dc.html` (just imported).

**Security-load-bearing.** This is where multi-tenant isolation stops being stubbed: the session's `orgId` becomes
the real tenant boundary for every query. Passwords are hashed, never plaintext. Get this right — it's the trust root.

---

## 1. Context — what exists

- **Stub:** `apps/web/lib/session.ts` — `getCurrentUser()` returns `prisma.user.findFirst({ where: { role: "ADMIN" }})`.
  Every screen + `dbForOrg(user.orgId)` + `requireRole(user, …)` currently runs against this single seeded ADMIN.
- **Models (FND.5):** `User { id, orgId, org, name, email @unique, role, createdAt }` — **no passwordHash**. 7-role
  `Role` enum. `Org`. Seed users cover all 7 roles: `admin@axona-demo.test` … `viewer@axona-demo.test` (no passwords).
- **RBAC.1:** `requireRole` / `hasRole` (`apps/web/lib/rbac.ts`). **No auth deps, no middleware** exist.

## 2. Goals

1. **Auth.js (NextAuth)** with a **Credentials provider** (email + password) verifying against `User.passwordHash`.
2. A **session** carrying `{ userId, orgId, role, name, email }` (JWT strategy — no adapter tables needed for
   credentials-only).
3. **Replace `getCurrentUser()`** with the real server-side session read — everything downstream (shell, screens,
   `dbForOrg`, `requireRole`) now runs against the logged-in user, unchanged in shape.
4. **Protected-route middleware** — unauthenticated app requests redirect to `/login`; auth routes are public.
5. A functional **Login screen** at `/login`, built 1:1 to `Login.dc.html`, wired to Auth.js; plus **sign-out**.
6. **Seed** a known dev password for all 7 role users so the demo can log in as any role (default: the ADMIN).

## 3. Non-goals (explicit — later stories)

- **SSO / SAML / OIDC** → AUTH.2 (the "Continue with SSO" button on the login design is present but disabled/flagged).
- **Signup + org provisioning** → AUTH.4 (`Signup.dc.html`). Login only assumes existing users here.
- **Invite / accept-invite** → AUTH.5 (`Accept Invite.dc.html`).
- **Password reset / email verification** → AUTH.7 (`Reset Password.dc.html`) — the "Forgot password?" link is present
  but routes to a stub/"coming soon" for now (flag it).
- **Post-auth new-user → onboarding routing** → AUTH.3/AUTH.6. AUTH.1 lands a logged-in user on `/` (→ `/core`).
- **Rate-limiting / lockout / 2FA** — flag as future hardening; not built here.

## 4. Data model

Re-use User. **One bounded schema addition** via `prisma migrate dev` (NEVER db push, per MIGRATE.1):
- `User.passwordHash String?` — nullable (SSO-only users, later, won't have one). Never returned to the client;
  never logged. `prisma migrate status` clean; FTS/pgvector intact.

## 5. Auth config (`apps/web` — Auth.js)

- Adopt **Auth.js v5** (`next-auth@5` / `@auth/core`) with the App-Router `auth()` helper (or v4 if v5 friction —
  your call, but keep it stable). **Credentials provider**: `authorize({ email, password })` → find the user by
  email, verify `password` against `passwordHash` with a hasher; return `{ id, orgId, role, name, email }` or null.
- **Hasher:** `bcryptjs` (pure-JS — avoids native-build breakage in CI; `argon2` is fine only if it builds in CI).
- **Session:** JWT strategy; the `jwt` callback copies `orgId` + `role` into the token; the `session` callback exposes
  `session.user = { id, orgId, role, name, email }`. `AUTH_SECRET` from env (add to `.env.example`). Secure,
  httpOnly cookies (Auth.js defaults).
- **Never** put the passwordHash in the token/session/logs.

## 6. Session read + RBAC (replace the stub)

- Rewrite `getCurrentUser()` to read the Auth.js server session (`auth()` / `getServerSession`) and return
  `{ id, orgId, role, name, email }` (or null). Keep the SAME return shape so the shell, screens, `dbForOrg`, and
  `requireRole` need no changes. Null (logged-out) → the middleware already redirected; server components treat it as
  unauthenticated.
- **RBAC becomes real:** `requireRole` now gates on the logged-in user's actual role — a VIEWER can no longer approve,
  etc. (This is the point.) Note in docs: the demo logs in as ADMIN by default; other role logins demonstrate gating.
- Multi-tenant: `dbForOrg(session.orgId)` is now the real tenant boundary — isolation is no longer stubbed.

## 7. Middleware (`apps/web/middleware.ts`)

- Protect all app routes. Unauthenticated → redirect to `/login` (preserve the intended path as a `?next=` param).
- **Public routes:** `/login`, `/signup`, `/reset`, `/invite/*`, Auth.js's own `/api/auth/*`, and static assets.
- Authenticated hitting `/login` → redirect to `/` (→ `/core`).

## 8. Login screen + sign-out

- `/login` built **1:1 to `Login.dc.html`** (full-screen, no shell): email + password, "Log in", the SSO button
  **present but disabled** (AUTH.2), "Forgot password?" (→ stub, flagged), a link to `/signup`. On submit → Auth.js
  `signIn("credentials", …)`; on success redirect to `?next` or `/`; on failure show the inline error in ink
  ("That email or password doesn't match."). v2 tokens; no invented reds.
- **Sign-out:** a `signOut()` action reachable from the shell (the account/wordmark area or a menu) → clears the
  session → `/login`.

## 9. Seed

- Give all 7 role users a **known dev password** (hashed with the chosen hasher; e.g. a single dev password documented
  in `docs/manual-checks.md`, NOT committed as plaintext anywhere else). Idempotent — set `passwordHash` on re-seed.
  So the demo can log in as `admin@axona-demo.test` (default) or any role to show RBAC.

## 10. Security invariants (DoD-blocking)

- **Passwords hashed** (bcrypt/argon2), never plaintext in DB, logs, token, or session. `passwordHash` never leaves
  the server.
- **Session = tenant boundary:** `orgId` comes from the session, NEVER the client; every `dbForOrg` uses it. No
  cross-tenant access via a forged param.
- **Least privilege:** RBAC now enforced on the real role. VIEWER can't mutate.
- **CSRF + secure cookies** (Auth.js defaults kept). `AUTH_SECRET` set; documented in `.env.example`.

## 11. CI-safety + verification

- `AUTH_SECRET` + any auth env added to `.env.example`; CI provides a dummy `AUTH_SECRET`. `bcryptjs` (pure JS) so
  `pnpm install --frozen-lockfile` + build succeed in CI with no native toolchain.
- `src/scripts/verify-auth-1.ts` (DB-gated; pure-logic always runs):
  1. `User.passwordHash` exists; seeded users have a hash; migrate status clean.
  2. `authorize()` returns the user for the correct email+password and **null** for a wrong password / unknown email.
  3. `getCurrentUser()` reads from the session (mock/inject a session) and returns `{ id, orgId, role }`; logged-out → null.
  4. Middleware config: an unauthenticated app route redirects to `/login`; `/login` + `/api/auth/*` are public.
  5. The session/JWT carries `orgId` + `role`; `passwordHash` is never present in the session object.
- `docs/manual-checks.md`: log in as admin@axona-demo.test (dev password) → lands on Command Center; log in as
  viewer → approve buttons are gated; sign out → `/login`; hitting a deep link while logged out → `/login?next=…`.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all`;
  **`pnpm build` must compile** (the middleware + auth routes — this is the FILE.2-class build check we flagged; run
  it here); verify:all green; migrate status clean; commit + push; confirm GitHub Actions green.

## 12. Review gate

**Stop after AUTH.1** and show me: (a) the Auth.js config + `authorize()` + the passwordHash migration, (b) the new
`getCurrentUser()` reading the session, (c) logging in on `/login` landing on the Command Center and a wrong password
showing the inline error, (d) a logged-out deep link redirecting to `/login?next=…`, and (e) verify-auth-1 output —
before continuing to the other auth screens (AUTH.4 signup / AUTH.5 invite / AUTH.7 reset).

---

### Completeness check (6-point)
1. Story + spec ref — AUTH.1, §8, E1 row 16. ✓
2. Every requirement — Auth.js credentials, session, session-read replacement, middleware, login screen + sign-out, seed. ✓
3. DoD — hashed passwords, session-as-tenant-boundary, real RBAC, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — FND.5/11, RBAC.1, Login.dc.html. ✓
5. Security/moat flagged — hashing, isolation, least-privilege, CSRF; SSO/signup/reset/onboarding scoped out to their stories. ✓
6. Review gate — §12. ✓
