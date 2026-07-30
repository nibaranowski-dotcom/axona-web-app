# PRD — AUTH.SSO (Phase 1) · Google Workspace sign-in

**Story:** AUTH.SSO — enable the (currently disabled) "Sign in with Google" on the login screen: an Auth.js
**Google provider** alongside the existing Credentials login, that **links to an existing user by
Google-verified email** and issues the same session. It's a **horizontal** adoption enabler — defense/EU/enterprise
buyers expect Google SSO to let their people in — and it satisfies the design partner's "full Google account +
SSO." Phase 1 is **Google OAuth sign-in for existing users**; enterprise SAML (the SET.5 config form) + domain
enforcement are later phases.
**Spec ref:** `specs/horizontal-prd-candidates.md` (Tier 2). **Pri/size:** P1 · M. **Track:** platform/auth
(security-sensitive). **Depth:** Full CPRD. **Deps:** Auth.js v5 (`apps/web/auth.ts` + `auth.config.ts`, JWT
strategy, trustHost), `verifyCredentials`/the JWT claim shape (orgId·role·tokenVersion), LoginSession (SET.3), the
`/login` SSO button (AUTH.2), the User model (`orgId` required, `email @unique`).

## Non-negotiable — BUILD ON THE EXISTING AUTH (do not reinvent)

Same discipline as the horizontals:
1. **Add the Google provider to the existing Auth.js instance** (`auth.ts`, Node runtime, next to Credentials) —
   do not stand up a second auth system. `providers: []` stays in `auth.config.ts` (edge); the Google provider is
   added where Credentials already is.
2. **Issue the identical session.** An SSO sign-in resolves to the **same JWT claims** a credentials login
   produces (`orgId · role · tokenVersion` for the matched user) — reuse the existing claim shape; **SSO grants no
   authz a password login wouldn't** (no privilege change via the login method).
3. **Reuse LoginSession + tokenVersion** — an SSO login records a `LoginSession` like credentials (SET.3), and a
   `tokenVersion` bump (password reset / sign-out-everywhere) invalidates SSO JWTs too. No parallel session path.
4. **Enable, don't rebuild, the `/login` SSO button** (AUTH.2) — wire it to `signIn("google")`; the Credentials
   form stays (dual sign-in).

## The security rule — link, never self-provision

- On Google sign-in, **match the Google-verified email to an existing `User`.**
  - **Match →** issue the session for that user (their `orgId`/`role`/`tokenVersion`).
  - **No match →** **DENY** with a clear message ("No Axona account for that email — ask your admin, or contact
    sales"). **Never auto-create a User or an Org** — Axona is invite-based / sales-led; SSO is an alternative
    *sign-in*, not a signup.
- **Require `email_verified` from Google** before linking (reject unverified Google emails).
- Email is globally unique + org-scoped, so a matched email deterministically resolves one user/org (no
  cross-org ambiguity). **Optional (flag, not required in P1):** a per-org Google-Workspace domain allowlist.

## Scope (Phase 1 only)

- Google provider in `auth.ts`; `signIn` callback enforces the link-by-verified-email + no-self-provision rule;
  the JWT/session callbacks reuse the existing claim shape.
- Enable the `/login` "Sign in with Google" button → `signIn("google")`; keep the Credentials form.
- Config: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` from env (secrets; set in Railway — see setup below); the
  callback URL is `<APP_URL>/api/auth/callback/google`.
- **Defer (do NOT build now):** enterprise SAML (the SET.5 IdP-metadata form) · org domain-enforcement · SCIM.

## Guardrails

Link-by-verified-email only; **no self-provision** of User/Org (unmatched → deny) · `email_verified` required ·
**same JWT claims + authz** as credentials (no escalation via login method) · **reuse LoginSession + tokenVersion**
(no parallel session) · Credentials login unchanged (dual sign-in) · secrets from env only (never committed) ·
trustHost/JWT strategy unchanged · additive (no schema change — `User.email` link is enough; a linking table only
if truly needed, additive) · migrate clean.

## Your setup (Nicolas — I'll guide step-by-step, like R2/Resend)

1. **Google Cloud Console → APIs & Services → OAuth consent screen** (Internal or External) + **Credentials →
   Create OAuth client ID → Web application.**
2. **Authorized redirect URI:** `https://app.axonahq.com/api/auth/callback/google` (+ a localhost one for dev).
3. Copy the **Client ID + Client Secret** → set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the Railway **web**
   service (never in chat/repo).
Code reads them from env; no keys in the code.

## Verify + gate (`src/scripts/verify-auth-sso.ts` — mock the Google profile)

1. **Build-on-top proof:** the Google provider is added to the existing Auth.js instance; no second auth system;
   the SSO path issues the **same JWT claim shape** as `verifyCredentials` (orgId·role·tokenVersion); Credentials
   login unchanged (`verify:auth-1` + auth verifies stay green).
2. **Link:** a Google profile whose `email_verified` email matches a seeded user → session issued for that user's
   org/role; a **LoginSession is recorded**; a `tokenVersion` bump invalidates the SSO JWT (reuse proof).
3. **No self-provision:** a Google email with **no matching user** → **denied**, and **no User/Org is created**
   (assert counts unchanged).
4. **Unverified Google email → denied.**
5. `/login` renders an **enabled** Google button that triggers `signIn("google")`; Credentials form still present.
6. a11y 0 on `/login`; existing auth/RBAC verifies green; migrate clean (no/additive schema).
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after AUTH.SSO; show: the enabled `/login` Google button; the link path (matched verified email → session
with the user's org/role + a LoginSession); the **no-self-provision** denial (unmatched email → denied, zero
User/Org created); unverified-email denial; and confirmation it's the same Auth.js instance / same JWT claims as
credentials (no second auth system, no privilege change), `verify:auth-*` green.
