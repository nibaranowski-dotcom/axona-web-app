# PRD — LEAD.1 · Contact-sales lead capture (public hardened endpoint + in-app surface)

**Story:** LEAD.1 — a `Lead` model + a **public, unauthenticated, hardened** POST endpoint that the marketing
site's Contact Sales form calls; it stores the inquiry as a `Lead`, notifies, and surfaces leads in-app. **Not**
self-serve signup — it creates no account, grants no access; it only captures an inquiry for sales follow-up.
**Spec ref:** GTM decision (no self-serve; enterprise/defense ICP → sales-led). **Pri/size:** P1 · M.
**Track:** Go-live / GTM. **Depth:** Full CPRD (public write surface = security-sensitive). **Deps:** the live
app (Railway), Prisma/migrate discipline (MIGRATE.1), the app shell for the in-app surface. **Blocks:** SITE.1
(the marketing form posts here — build LEAD.1 first).

## Why

We decided the product is **sales-led, not self-serve** (robotics OEM / defense buyers don't self-onboard). So
the homepage CTA is "Contact Sales," and those inquiries should live in **our own system** (dogfood), not a
third-party form tool. LEAD.1 is the durable, owned capture surface behind that CTA.

## The critical constraint — this is a PUBLIC write endpoint

Everything else in the app is authed + RBAC'd + org-scoped. This endpoint is **reachable by anyone on the
internet**. It must therefore be hardened, and it must **never** become an account-creation or privilege path:

- **No auth, but no power.** It creates a `Lead` row and nothing else — no `User`, no `Org`, no session, no
  access grant, no tenant data. It cannot read or mutate any tenant's data.
- **Isolation.** Leads are **Axona-internal**, not customer-tenant data — store them in a dedicated `Lead` table
  that is **not** part of the per-tenant `dbForOrg` scoping (or scope to a single reserved internal org). A lead
  must never land in a customer tenant's data or be visible cross-tenant.
- **Input validation** — server-side zod schema; reject anything malformed; cap field lengths; store only the
  declared fields (name, work email, company, role, fleet size / use-case, message, optional consent flag).
- **Abuse protection** — per-IP + global **rate limiting**; a **honeypot** hidden field (bot-filled → silently
  drop); a **captcha seam** (hCaptcha/Turnstile) wired but behind an env flag so it can be turned on without a
  rebuild. No CAPTCHA-solving on our side — this is bot *rejection*, not bypass.
- **CORS allowlist** — accept cross-origin POSTs only from the marketing site's origin(s) (env-configured);
  reject others.
- **No PII in URLs/logs** — POST body only; don't log raw emails/messages at info level; HTTPS only.
- **Honest response** — return a generic success regardless of dedupe/spam handling (don't leak whether an email
  is already known).

## Data model (additive, via `migrate dev` — never `db push`)

`Lead` — `id · createdAt · name · workEmail · company · role? · fleetSize? · useCase? · message? · consent Bool ·
source (e.g. "homepage-contact") · status (NEW → CONTACTED → QUALIFIED → CLOSED) · ipHash? (hashed, for
rate-limit/abuse, not raw IP) · note/owner? (internal)`. Not tenant-scoped (Axona-internal). Add only what's
listed; index `createdAt`, `status`.

## Endpoint

`POST /api/leads` (public): CORS-allowlisted · rate-limited · honeypot + optional captcha · zod-validated →
create `Lead(status=NEW, source)` → fire notify → return `{ ok: true }` (generic). Idempotent-ish: a duplicate
(same email + company within a short window) updates rather than duplicates, but the response is identical.

## Notify (pluggable, no hard dep on Resend)

Because email (GOLIVE.1/Resend) is on hold, notify is a **pluggable seam**: on a new lead, (a) always create an
in-app **notification** + the lead is visible in the in-app Leads view (below); (b) if `LEAD_NOTIFY_WEBHOOK_URL`
is set, POST a summary to it (Slack/webhook) so you get pinged immediately; (c) a `/// NOTIFY-EMAIL` seam for
Resend later. No notify path is required for the endpoint to succeed (a failed webhook never fails the capture).

## In-app surface

A minimal **Leads** view (internal/admin-gated — reuse the existing RBAC; an admin/owner role) listing captured
leads (newest first), each with its fields + status, and a status control (NEW→CONTACTED→…). This is the "owned
lead data" payoff and is how you triage inquiries. v2 tokens · no emoji · a11y 0 on the route.

## Non-goals (flag)

No self-serve account creation · no billing (Stripe/GOLIVE.3) · no CRM integration (later) · no marketing-site
work (that's SITE.1) · no email provider wiring (Resend/GOLIVE.1 — the seam is left, not built) · no CAPTCHA
provider mandated (seam behind a flag).

## Guardrails

Public endpoint creates a `Lead` and nothing else (no user/org/session/access) · leads are Axona-internal, never
in a customer tenant's scope · zod-validated + length-capped · rate-limited + honeypot (+ captcha seam) · CORS
allowlisted to the marketing origin · no raw PII in logs/URLs · notify failures never fail capture · additive
migration via `migrate dev` (no `db push`) · the in-app Leads view is RBAC-gated (admin/owner) · self-cleaning
verify.

## Verify + gate (`src/scripts/verify-lead-1.ts`)

1. `POST /api/leads` with a valid body creates one `Lead(status=NEW)`; returns generic `{ ok: true }`.
2. **Validation:** malformed/oversized/missing-required body → rejected, no row written.
3. **Honeypot:** a filled honeypot field → silently dropped (generic success, no row).
4. **CORS:** a disallowed Origin is rejected; the allowlisted marketing origin is accepted.
5. **Rate limit:** burst past the per-IP limit → throttled (429), no unbounded writes.
6. **No power:** the endpoint creates no `User`/`Org`/session and touches no tenant data; a lead is not visible in
   any customer tenant's scope (isolation).
7. **In-app surface** is RBAC-gated (non-admin blocked) and lists the captured lead; a11y 0 on the route.
8. Notify: a set `LEAD_NOTIFY_WEBHOOK_URL` receives a summary; an unset/failing webhook does NOT fail capture.
9. Existing verifies stay green; migrate status clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push (AXONA_ALLOW_MAIN_PUSH); Actions green.

## Review gate

Stop after LEAD.1; show: a successful `POST /api/leads` creating a Lead + the in-app Leads view listing it, the
rejected cases (bad body · honeypot · disallowed CORS · rate-limit 429), and confirmation the endpoint creates no
account/session and no lead is visible in a customer tenant. Then SITE.1 wires the marketing form to it.
