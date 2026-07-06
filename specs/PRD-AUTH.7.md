# PRD — AUTH.7 · Email verification + password reset

**Story:** AUTH.7 — Email verification + password reset.
**Spec ref:** §8; backlog E1 row 22. **Pri/size:** P0 · S–M. **Track:** Platform (E1). **Depth:** Full CPRD.
**Deps:** AUTH.1 (credentials, bcrypt, `/reset` public), EMAIL.1 (send), SET.3 (tokenVersion — reset bumps it).
Design: `Reset Password.dc.html` (request · confirmation · set-new · verified states).

## Goals
1. **Password reset:** `/reset` request (email → send reset link) → `/reset/:token` set-new-password → sign in.
2. **Email verification:** on signup (AUTH.4), send a verify email; a `/verify/:token` marks the email verified;
   surface an unverified banner (non-blocking for now — flag).
3. Wire the AUTH.1 "Forgot password?" stub → `/reset`.

## Non-goals
2FA → later. Forcing verification before use (hard gate) → later (flag; verification is soft here).

## Data model (via `prisma migrate dev`, never db push)
- `User.emailVerifiedAt DateTime?`.
- `PasswordResetToken` `{ id, userId, token @unique (crypto 32B), expiresAt (now+1h), usedAt?, createdAt }`.
- `EmailVerifyToken` `{ id, userId, token @unique, expiresAt (now+24h), usedAt?, createdAt }`. migrate clean.
- (Reuse SET.3's `User.tokenVersion` — a completed reset **bumps it** to invalidate existing sessions.)

## Flows (server actions; `/reset*` + `/verify*` are public)
- **Request reset** (`/reset`): email → if a user exists, create a single-use 1h `PasswordResetToken` +
  `sendEmail("reset", …)`. **Always** show the same "check your inbox" confirmation (don't reveal whether the email
  exists — anti-enumeration). Rate-limit note (flag).
- **Set new password** (`/reset/:token`): validate token (unused, unexpired) → set-new-password form → `bcrypt(next)`,
  mark token used, **bump tokenVersion**, sign in → `/core`. Invalid/expired → clean invalid state.
- **Verify email** (`/verify/:token`): validate → set `User.emailVerifiedAt`, mark token used → "Email verified" state.
- **On signup (AUTH.4):** create an EmailVerifyToken + `sendEmail("verify", …)`. An unverified user sees a soft
  banner + "resend" (non-blocking).

## Screen (`/reset`, `/reset/:token`, `/verify/:token`) — 1:1 to Reset Password.dc.html
Full-screen, matching /login's card + wordmark. Show the request, the confirmation, the set-new, and the verified
states per the design; inline ink errors, no invented reds.

## Guardrails
Tokens crypto-random, single-use, short-lived (reset 1h, verify 24h); **anti-enumeration** on request; reset bumps
tokenVersion (old sessions invalidated); bcrypt, no plaintext/logs; org isolation (token→user→org). FakeMailer in CI.

## Verify + gate (`src/scripts/verify-auth-7.ts`)
1. emailVerifiedAt + reset/verify token models; migrate clean.
2. Request reset creates a 1h token + sends (FakeMailer) for an existing email; a non-existent email produces the SAME
   confirmation + no token (anti-enumeration).
3. Set-new-password with a valid token re-hashes + marks used + bumps tokenVersion; the token can't be reused;
   expired/used → invalid.
4. Verify token sets emailVerifiedAt; signup creates a verify token + send.
5. A completed reset invalidates old sessions (tokenVersion).
CI gate: install·lint·typecheck·verify:all (FakeMailer)·**pnpm build**·migrate clean·a11y 0 on /reset + /reset/:token
+ /verify/:token; commit+push; green.

## Review gate
Stop after AUTH.7; show: the migration + the reset/verify actions; a reset (request → set-new → signed in, old
sessions invalid); anti-enumeration on an unknown email; email verification; verify-auth-7 output.
