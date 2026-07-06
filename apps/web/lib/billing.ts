import { prisma, type PlanTier, type SubStatus } from "@axona/db";
import { getMembers } from "./members";
import { ONBOARDING_MODULE_KEYS } from "./onboarding";

// BILL.3 — Axona-as-SaaS billing read model (server-only). Distinct from the
// Finance module (the customer's own P&L). Stripe is deferred — the numbers are
// real (seeded), the charge actions are stubbed.

export interface UsageBar {
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  display: string;
}

export interface BillingInvoice {
  id: string;
  number: string;
  description: string;
  amountCents: number;
  status: "PAID" | "OPEN" | "VOID";
  issuedAt: Date;
}

export interface BillingData {
  plan: PlanTier;
  status: SubStatus;
  seatsUsed: number;
  seatsPurchased: number;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  paymentSummary: string | null;
  usage: UsageBar[];
  enabledModuleCount: number;
  totalModules: number;
  invoices: BillingInvoice[];
}

// Per-plan monthly agent-run allowance (static config; enforcement is BILL.4).
export const PLAN_RUN_LIMIT: Record<PlanTier, number | null> = {
  PILOT: 2_000,
  SCALE: 25_000,
  ENTERPRISE: null, // unlimited
};

export async function getBilling(orgId: string): Promise<BillingData | null> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return null;

  // Seats used reconciles to SET.2's members: active users + pending invites.
  const { rollup } = await getMembers(orgId);
  const seatsUsed = rollup.activeMembers + rollup.pending;

  // Usage: agent + workflow runs this billing period (from the run tables).
  const periodStart = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd.getTime() - 30 * 86_400_000)
    : new Date(Date.now() - 30 * 86_400_000);
  const [agentRuns, workflowRuns] = await Promise.all([
    prisma.agentRun.count({
      where: { agent: { orgId }, createdAt: { gte: periodStart } },
    }),
    prisma.workflowRun.count({
      where: { orgId, startedAt: { gte: periodStart } },
    }),
  ]);
  const runsUsed = agentRuns + workflowRuns;
  const runLimit = PLAN_RUN_LIMIT[sub.plan];

  const enabledModuleCount = await enabledCount(orgId);

  const usage: UsageBar[] = [
    {
      label: "Agent & workflow runs",
      used: runsUsed,
      limit: runLimit,
      display: runLimit
        ? `${runsUsed.toLocaleString()} / ${runLimit.toLocaleString()}`
        : `${runsUsed.toLocaleString()} · unlimited`,
    },
    {
      label: "Seats",
      used: seatsUsed,
      limit: sub.seatsPurchased,
      display: `${seatsUsed} / ${sub.seatsPurchased}`,
    },
  ];

  const invoices = await prisma.invoiceSaaS.findMany({
    where: { orgId },
    orderBy: { issuedAt: "desc" },
    take: 12,
  });

  return {
    plan: sub.plan,
    status: sub.status,
    seatsUsed,
    seatsPurchased: sub.seatsPurchased,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    paymentSummary: sub.paymentSummary,
    usage,
    enabledModuleCount,
    totalModules: ONBOARDING_MODULE_KEYS.length,
    invoices: invoices.map((iv) => ({
      id: iv.id,
      number: iv.number,
      description: iv.description,
      amountCents: iv.amountCents,
      status: iv.status,
      issuedAt: iv.issuedAt,
    })),
  };
}

async function enabledCount(orgId: string): Promise<number> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { enabledModules: true },
  });
  const enabled = org?.enabledModules ?? [];
  if (enabled.length === 0) return ONBOARDING_MODULE_KEYS.length; // empty ⇒ all
  return ONBOARDING_MODULE_KEYS.filter((k) => enabled.includes(k)).length;
}

// ── plans (static config) ─────────────────────────────────────────────────
export interface Plan {
  tier: PlanTier;
  name: string;
  priceMonthly: number; // USD/month
  seatsIncluded: string;
  runLimit: string;
  features: string[];
  recommended: boolean;
}

export function getPlans(): Plan[] {
  return [
    {
      tier: "PILOT",
      name: "Pilot",
      priceMonthly: 0,
      seatsIncluded: "10 seats",
      runLimit: "2,000 runs / mo",
      features: ["Core modules", "Community support", "1 workspace"],
      recommended: false,
    },
    {
      tier: "SCALE",
      name: "Scale",
      priceMonthly: 4200,
      seatsIncluded: "50 seats",
      runLimit: "25,000 runs / mo",
      features: [
        "All modules",
        "Priority support",
        "Audit + RBAC",
        "SSO (add-on)",
      ],
      recommended: true,
    },
    {
      tier: "ENTERPRISE",
      name: "Enterprise",
      priceMonthly: 0, // "Talk to us"
      seatsIncluded: "Unlimited seats",
      runLimit: "Unlimited runs",
      features: [
        "Own-your-model / VPC",
        "SLA + dedicated support",
        "SAML SSO + SCIM",
      ],
      recommended: false,
    },
  ];
}
