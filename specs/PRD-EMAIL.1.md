# PRD — EMAIL.1 · Transactional email (Resend + React Email)

**Story:** EMAIL.1 — Transactional email service (invites · verify · reset · receipts) — Resend + React Email.
**Spec ref:** §gap; backlog E11 row 109 (P0 — AUTH.5/7 depend on it). **Pri/size:** P0 · M. **Track:** Platform (E11).
**Depth:** Full CPRD. **Deps:** AUTH.5 (invites), FND.1. Adopt **Resend** (research: buy the plumbing).

**Infra note:** Resend is the chosen transactional-email provider. It needs a verified sending domain + API key. For
the demo/CI it runs behind a **FakeMailer** (logs the email, no send) exactly like the ModelClient/Embedder DI, so
everything is testable without a key or a verified domain.

## Goals
1. A `Mailer` interface with **ResendMailer** (real) + **FakeMailer** (offline/CI default, records sends).
2. **React Email templates**: invite, email-verification, password-reset, receipt (billing) — branded (Axona:
   Archivo/mono, paper/ink, lime accent, no emoji).
3. `sendEmail(kind, to, props)` — renders the template + sends via the mailer; retriable; failures don't crash the caller.
4. **Wire AUTH.5 invites** to send the invite email (in addition to the copyable link).

## Non-goals
Password-reset/verify *flows* → AUTH.7 (this provides the send capability + templates; AUTH.7 wires the flow).
Per-preference routing → NOTIF.3. Marketing/bulk email → out of scope. Digest → EMAIL.2.

## Config / DI (`packages/email` or `apps/web/lib/email`)
- `interface Mailer { send({to, subject, react, replyTo?}): Promise<{id}|{skipped}> }`.
- `ResendMailer` — `resend` SDK, `RESEND_API_KEY` + `EMAIL_FROM` (e.g. `Axona <no-reply@axonahq.com>`) from env.
- `FakeMailer` — records to an in-memory/log sink; used when `RESEND_API_KEY` unset (dev/CI). `getMailer()` picks by env.
- **Human-approved sends only** for anything non-transactional (backlog rule) — transactional (invite/verify/reset/
  receipt) are system-triggered by an explicit user action, which is fine; no autonomous bulk sends.

## Templates (`packages/email/templates/*` — React Email)
`InviteEmail` ({inviterName, orgName, role, acceptUrl}), `VerifyEmail` ({verifyUrl}), `ResetEmail` ({resetUrl}),
`ReceiptEmail` ({orgName, amount, invoiceUrl}). Branded, plain, accessible; a shared layout. `EMAIL_FROM` + a footer.

## API surface
- `sendEmail(kind, to, props)` — server-only; render template → `getMailer().send`; try/catch (log, don't throw into
  the caller); optional idempotency key. Add `.env.example` entries (RESEND_API_KEY, EMAIL_FROM, APP_URL).
- Wire `createInvites` (AUTH.5): after creating each PENDING invite, `sendEmail("invite", email, {acceptUrl,…})`
  (still return the copyable link as a fallback).

## Guardrails
No secrets/logs of the key; FakeMailer in CI (no live send, no key); transactional-only (no autonomous bulk);
per-tenant correctness (the right org/user in each email). CI must pass with no RESEND_API_KEY.

## Verify + gate (`src/scripts/verify-email-1.ts`)
1. `getMailer()` returns FakeMailer without a key; ResendMailer only with a key.
2. Each template renders to HTML with the right props (invite acceptUrl present, branded, no emoji).
3. `sendEmail("invite", …)` via FakeMailer records a send with the correct to/subject; a mailer failure does NOT throw
   into the caller.
4. `createInvites` now triggers an invite send (recorded by FakeMailer) + still returns the link.
docs/manual-checks entry (with a real key, send yourself an invite/reset and confirm receipt).
CI gate: install --frozen-lockfile (adds `resend` + `react-email`/`@react-email/components`) · lint · typecheck ·
verify:all (FakeMailer, no key) · **pnpm build** · migrate clean (no schema change expected); commit+push; green.

## Review gate
Stop after EMAIL.1; show: the Mailer interface + Fake/Resend split, the four rendered templates, an invite send via
FakeMailer wired from createInvites, and verify-email-1 output.
