# PRD — BILL.3 · Billing & subscription screen (+ Plans)

**Story:** BILL.3 — Billing settings screen (plan · seats · usage · payment · invoices) + the Plans/upgrade screen.
**Spec ref:** §gap; backlog E10 rows 106 (+104/105 deferred). **Pri/size:** P1 · M. **Track:** Platform (E10).
**Depth:** Full CPRD. **Deps:** AUTH.1, SET.2 (sub-nav + member/seat counts), AUDIT.1. Design:
`Settings - Billing.dc.html` + `Settings - Plans.dc.html`.

**Scope note:** this is **Axona-as-SaaS billing the tenant** — distinct from the Finance *module* (the customer's own
P&L). The **Stripe integration (BILL.1/2) is deferred**: this ships the **screens + a real subscription/seat/usage
data model seeded to a plan**, with the "manage payment / change plan" actions **stubbed** (they open the flow but
don't charge — flag). This makes the surface client-ready without a live Stripe dependency.

## Goals
1. `/settings/billing` (1:1 to Settings - Billing.dc.html): current **plan**, **seats** (used vs total), **usage &
   entitlements** (agent runs, modules), **payment method** (display), **invoice history**.
2. `/settings/billing/plans` (1:1 to Settings - Plans.dc.html): the 3-tier pricing comparison + upgrade CTA (+ a
   trial/dunning banner variant).

## Non-goals
Live **Stripe** (checkout, webhooks, real charges) → BILL.1/2. Usage *metering enforcement* → BILL.4. Dunning logic
→ BILL.5. This is the display layer + data model + stubbed actions.

## Data model (via `prisma migrate dev`, never db push)
- `Subscription` `{ id, orgId @unique, plan (enum PlanTier: PILOT|SCALE|ENTERPRISE), status (TRIALING|ACTIVE|
  PAST_DUE|CANCELED), seatsPurchased Int, trialEndsAt DateTime?, currentPeriodEnd DateTime?, createdAt }`.
- `Invoice_SaaS` (name it distinctly from the Finance `Invoice`) `{ id, orgId, number, amountCents Int, status
  (PAID|OPEN|VOID), issuedAt, url? }`.
- Seats used = active (non-deactivated) Users (from SET.2) + PENDING invites; entitlement usage (agent runs) derived
  from AgentRun/WorkflowRun counts this period. migrate clean.

## Read model + actions (`apps/web/lib/billing.ts`)
- `getBilling(orgId)` — subscription (plan/status/period), seats (used vs purchased), usage (agent runs this period,
  modules enabled), payment-method display (stubbed "Visa ···· 4242" from a seeded field or placeholder), invoices.
- `getPlans()` — the 3 tiers with what's included (static config).
- Actions (ADMIN-gated, audited, **stubbed effects**): `changePlan(tier)` (updates Subscription.plan, audit
  `billing.plan_change`; NO real charge — flag), `addSeats(n)` (updates seatsPurchased, audit). "Manage payment
  method" opens a stub/"connect Stripe (coming soon)" — flag.

## Screen
Shell + Settings sub-nav (Billing). Plan+seats summary strip (shared StatStrip), usage bars, payment-method card,
invoices table (date·amount·status Paid=green·download). Plans page = 3 dotted-grid tier cards, recommended tier in
lime, trial/dunning banner in ink. Numbers mono+specific. ADMIN edits; others read-only.

## Guardrails
ADMIN-gated; org isolation; **no real money moves** (all charge actions stubbed — the app never initiates a real
charge here); audited; distinct from the Finance module data. Seat count must reconcile to SET.2's members.

## Verify + gate (`src/scripts/verify-bill-3.ts`)
1. Subscription + Invoice_SaaS models; migrate clean.
2. getBilling returns plan/seats(used==active members+pending)/usage/invoices, org-scoped; seats reconcile to getMembers.
3. changePlan/addSeats ADMIN-only + audited; VIEWER forbidden; no real-charge path exists (assert stub).
4. getPlans returns 3 tiers; the recommended/current tier resolves.
5. Cross-org billing not readable.
Seed: a Subscription (SCALE, ACTIVE, seatsPurchased=25) + a few Invoice_SaaS (Paid) for the demo org.
CI gate: install·lint·typecheck·verify:all·**pnpm build**·migrate clean·a11y 0 on /settings/billing + /plans;
commit+push; Actions green.

## Review gate
Stop after BILL.3; show: the models + getBilling; /settings/billing (plan·seats·usage·invoices) with seats
reconciling to members; /plans tiers; a stubbed plan change audited (no charge); verify-bill-3 output.
