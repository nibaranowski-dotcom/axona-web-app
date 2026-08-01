# PRD — GOLIVE.3: real billing (Stripe · per-module, unit-metered) + BILL.1 meter

*Extracted from the studio go-live checklist §5 (money path) + §18.1 gate, adapted to Axona's reality:
B2B, sales-assisted (no self-serve card at signup — SITE.1 is contact-sales), Railway + Postgres (not
Supabase), orgId + RBAC isolation (not RLS). Pricing is **per-module, metered by units under management**
(CLAUDE.md: "`Unit` is the billing meter"). Ships as two stories: **BILL.1** (the meter) then **GOLIVE.3**
(Stripe on top). Moat invariant: AI proposes, **a human approves money** — billing mutations are
human-gated and audited.*

## The money model (Axona-specific — get this right first)

- **Unit = the meter.** An org pays per active **module**, and the metered quantity is its **units under
  management** — a clean, org-scoped, countable `Unit` identity. Not seats, not API calls.
- **Entitlement is per-org, per-module**, written **server-side** from Stripe webhooks — the server row
  decides module access, never a client redirect/success page.
- **Sales-assisted, not self-serve.** No card field at signup. Onboarding creates the org (ADMIN.1 path);
  billing is set up via a Stripe Checkout/portal link or an enterprise invoice. Enterprise may pay by
  invoice/ACH, SMB via card — both resolve to the same server-side entitlement.

## BILL.1 — the meter (prerequisite story)

- Give `Unit` a **clean org-scoped countable identity**: a stable, deduped count of units-under-management
  per org, excluding soft-deleted/retired, so "how many units does org X manage this period" has one
  authoritative answer. This is the metered quantity.
- A **usage snapshot** per org per billing period (point-in-time count + a small history), so metering is
  reproducible and auditable — never recomputed differently at read time.
- Org-scoped, isolation-strict (org A's count never includes org B). Add the count to the org's own admin
  view so it's transparent (this is the number they're billed on).
- No Stripe yet in BILL.1 — just the authoritative meter + snapshot. GOLIVE.3 reports it upward.

## GOLIVE.3 — Stripe wiring (money path)

**Processor decision (record it before wiring — §5).** Direct Stripe = Axona is the merchant (needs a legal
entity; owns sales-tax/VAT, use Stripe Tax) vs a Merchant-of-Record (handles global tax, viable with no
company). For B2B enterprise the norm is **direct Stripe + Stripe Tax + invoicing**; MoR suits
consumer/global-small. **Nicolas's legal/tax call — record the decision in this file before building.**

- **Products & prices in live mode**: one product per billable **module**; price carries the **metered
  usage** component (per unit-under-management) + any per-module base. Trial/contract terms match the
  contract/paywall copy exactly. Test-mode config never touches prod.
- **One subscription per org.** Report BILL.1's unit count to Stripe as metered usage each period
  (usage records / metered price). Sales-assisted: generate a Checkout or Billing-Portal link per org.
- **Live API keys server-only** (Railway env/secret store); test keys nowhere near prod. Anything shipped
  to the browser is public — only the publishable key is client-side.
- **Webhook endpoint on prod**, signing secret server-side; **verify the signature on the raw body**;
  return 200 fast, process async; **idempotent handlers (dedupe by event id — Stripe retries)**.
- **Entitlement written server-side from the webhook only.** An `Entitlement` per org per module
  (active/canceled/past_due), written by the webhook, gating module **nav + API** (integrate with RBAC —
  a module the org isn't entitled to is not reachable, server-enforced). Never granted from a client page.
- **Cancel / refund / dunning**: cancellation honored (access revoked or honored-to-period-end per terms);
  refund path tested; past-due → grace + honest in-app state. **SCA/3-DS** handled; declined-card/network
  errors show honest copy ("nothing was charged"). Amounts, currency, tax, dates shown are **dynamic and
  correct** (no hard-coded dates).
- **Receipts** via Stripe **or** Resend, not both. **Dispute/chargeback alerting** reaches a channel you watch.
- **Audit every billing event** to the immutable log (AUDIT.1): subscription created/updated/canceled,
  entitlement change, usage reported — inputs · actor (system/webhook) · result. Billing is a money action:
  keep it on the propose→approve→audit spine (human approves plan changes; the system executes + logs).

## The money invariant (THE test — on prod, adapted for B2B)

One subscription created (via the org's Checkout/invoice) → **exactly one entitlement set** for that org →
its modules unlock → a **duplicate webhook does NOT double-grant** → metered usage reports the **correct
BILL.1 unit count** → cancel revokes/honors per terms. Run it on prod with a real card (SMB path) and a
real test invoice (enterprise path).

## DoD / verification

- BILL.1: authoritative org-scoped unit count + period snapshot; isolation-strict (org B → 0); reproducible.
- GOLIVE.3: webhook signature-verified on raw body + idempotent (replay an event → no double-grant, proven);
  entitlement server-side only; module access gated by entitlement (RBAC-integrated), org-scoped
  (org A's entitlement never unlocks org B); usage = BILL.1 count; cancel/refund honored; keys server-only
  (scan the client bundle — nothing sensitive shipped); receipts from one source; billing events audited.
- `verify-golive-3.ts` asserts the money invariant end-to-end on seed + the idempotency + the isolation.
- tsc clean; verify:all + eval green; docs/manual-checks.md entry; the §18.1 money-path gate line goes green.

## Guardrails

Entitlement is written ONLY server-side from a signature-verified webhook — never a client redirect. Idempotent
by event id. Live/test keys strictly separated, server-only. Per-tenant isolation of entitlements + usage. No
double-grant. Human approves plan/price changes; the system executes and audits. Additive migrations only,
`prisma migrate dev`/`deploy` — never `db push` (MIGRATE.1).
