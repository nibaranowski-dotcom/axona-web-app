# Axona go-live gate (adapted from the studio checklist)

*The studio checklist is consumer-app-shaped; this is the Axona-relevant subset with current status.
Axona stack: Cloudflare DNS (axonahq.com) · Railway (web + worker + Postgres/pgvector + Redis) ·
Cloudflare R2 (blobs) · Auth.js + RBAC + orgId isolation (NOT Supabase RLS) · Resend (email) · Stripe
(billing — GOLIVE.3, open). B2B, sales-assisted (contact-sales, no self-serve signup — SITE.1).
Status: ✅ done · 🟡 partial/verify · ⬜ open · N/A not applicable.*

## The Go/No-Go gate (§18 — the seven that must be green)

1. **Money path** — ⬜ GOLIVE.3 (Stripe, per-module unit-metered) — see PRD-GOLIVE.3. One subscription →
   one org entitlement; cancel/refund work; duplicate webhook doesn't double-grant.
2. **Data path safe** — 🟡 Axona's RLS-equivalent is **orgId scoping + RBAC**, verified by behavior in
   `verify:all` isolation checks (2nd org → 0), which now run in CI (CI.1). ⬜ Confirm **Railway Postgres
   backups / PITR** enabled + a restore tested once. ⬜ Account/org **delete + data export** paths.
3. **Secrets clean** — 🟡 keys in Railway env/secret store; live≠test once GOLIVE.3 lands. ⬜ Scan the built
   client bundle to confirm no service/secret key shipped (only publishable/anon client-side).
4. **Trust surface** — 🟡 Terms/Privacy/support must be **live resolving pages with true data flows** (no
   fabricated policy). Axona's §10 version of "no fabricated proof" = **SEED.1** (no real marque/person,
   no invented traction) — enforced by verify:seed-1. ⬜ Confirm Terms/Privacy live on axonahq.com;
   governing entity/refund/support filled. Defense-tenant sensitivity governance = a data-handling note.
5. **Email authenticated** — ✅ Resend on send.axonahq.com (GOLIVE.1). 🟡 Confirm **SPF + DKIM + DMARC** all
   published (Gmail/Yahoo require all three); a transactional test hits the inbox.

   **Google Workspace aliases (receiving, on axonahq.com — logged 2026-08-01):** `nic@` (primary/personal —
   use as the from/reply for founder prospect + investor outreach) · `support@` · `contact@` · `hello@` ·
   `management@` · `fundraising@` (investor outreach). All alias into one inbox. `support@`/`contact@` satisfy
   the §7/§10 "working support address" item. Note: these RECEIVE only — the app's transactional mail still
   sends via Resend on send.axonahq.com, a separate system. (`management@` — confirm it's actually needed.)
6. **Roll back + know if it breaks** — 🟡 Railway redeploys the previous build; ⬜ **write the rollback
   command down**; ⬜ **error tracking + uptime alerting** to a channel you watch (§11).
7. **Performs** — 🟡 core states render; a11y gate real in CI (A11Y.2/3). ⬜ CWV read on prod; cross-browser
   + real-mobile pass of the app shell.

## Already shipped (context — not re-litigating)

Domain + HTTPS + custom domain (GOLIVE.2) · Railway web+worker+Postgres+Redis, migrate on deploy (GOLIVE.2) ·
R2 blob store + extraction (FILE.1/2, IO.2) · Auth.js + Google SSO (AUTH.SSO) + RBAC + per-tenant isolation ·
Resend transactional email (GOLIVE.1) · marketing site with login + contact-sales, no self-serve (SITE.1/2,
LEAD.1) · prod seeded with anonymized demo + three prospect tenants · **CI is a real gate** (pgvector
Postgres, DB-gated checks run — CI.1) and hardened (VERIFY.3/4/5).

## Open, ranked (post-CHG.1 board)

1. **GOLIVE.3 + BILL.1** — real billing (the §18.1 gate). The one thing between "live app" and "taking revenue."
2. **§9 Security headers** — HSTS, CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors on the app.
   Dependency audit clean. ⬜ verify present.
3. **§11 Observability** — error tracking (client + server) + uptime monitor + alerting; key business alerts
   (first payment, webhook failures, signup drop). ⬜ wire.
4. **§3 Backups/PITR** — confirm Railway Postgres PITR on; test a restore once.
5. **§2 Rollback runbook** — write the <5-min rollback command down; a one-line incident runbook.
6. **§10 Legal** — Terms/Privacy live + true; entity/refund/support filled before revenue.

## Not applicable / deferred for Axona

App-store collateral (§14 — no mobile app) · consumer self-serve paywall specifics (sales-assisted instead) ·
consumer lifecycle/marketing email streams (§8/§15 — B2B, later) · cookie banner only if non-essential
analytics added (§10). Category rules (§10): defense-sensitivity governance already enforced in seed/app.
