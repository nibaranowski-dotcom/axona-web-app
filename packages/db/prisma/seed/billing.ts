import type { OrgScopedDb } from "../../src";

// BILL.3 — a seeded SaaS subscription (SCALE / ACTIVE / 25 seats) + a few paid
// invoices for the demo org. Stubbed billing — no Stripe, no real charges.
export async function seedBilling(
  db: OrgScopedDb,
  orgId: string,
): Promise<void> {
  await db.subscription.deleteMany({ where: { orgId } }); // idempotent
  await db.invoiceSaaS.deleteMany({ where: { orgId } });

  const now = Date.now();
  const day = 86_400_000;
  await db.subscription.create({
    data: {
      plan: "SCALE",
      status: "ACTIVE",
      seatsPurchased: 25,
      currentPeriodEnd: new Date(now + 26 * day),
      paymentSummary: "Visa ···· 4242 · exp 08/27",
    },
  });

  const invoices = [
    {
      number: "AX-2026-004",
      description: "Scale plan · 25 seats",
      amountCents: 420000,
      monthsAgo: 0,
    },
    {
      number: "AX-2026-003",
      description: "Scale plan · 25 seats",
      amountCents: 420000,
      monthsAgo: 1,
    },
    {
      number: "AX-2026-002",
      description: "Scale plan · 22 seats",
      amountCents: 369600,
      monthsAgo: 2,
    },
    {
      number: "AX-2026-001",
      description: "Pilot → Scale upgrade",
      amountCents: 210000,
      monthsAgo: 3,
    },
  ];
  for (const iv of invoices) {
    await db.invoiceSaaS.create({
      data: {
        number: iv.number,
        description: iv.description,
        amountCents: iv.amountCents,
        status: "PAID",
        issuedAt: new Date(now - iv.monthsAgo * 30 * day),
      },
    });
  }
}
