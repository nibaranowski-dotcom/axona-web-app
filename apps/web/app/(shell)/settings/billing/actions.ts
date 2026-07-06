"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, type PlanTier } from "@axona/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// BILL.3 — billing actions. ADMIN-gated + org-scoped + audited. STUBBED effects:
// changePlan/addSeats update the local Subscription only — Axona NEVER initiates a
// real charge here (Stripe is BILL.1/2). "Manage payment" is a stub too.

const PLANS: PlanTier[] = ["PILOT", "SCALE", "ENTERPRISE"];

export interface BillingActionResult {
  ok: boolean;
  message?: string;
}

function actor(user: { id: string; name: string; email: string }) {
  return { id: user.id, label: user.name || user.email };
}

// changePlan — stub: update Subscription.plan locally, audit. NO real charge.
export async function changePlan(tier: string): Promise<BillingActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  if (!PLANS.includes(tier as PlanTier)) {
    return { ok: false, message: "Unknown plan." };
  }
  const db = dbForOrg(user!.orgId);
  const sub = await db.subscription.findFirst({
    where: { orgId: user!.orgId },
  });
  if (!sub) return { ok: false, message: "No subscription found." };
  const from = sub.plan;
  await db.subscription.updateMany({
    where: { orgId: user!.orgId },
    data: { plan: tier as PlanTier },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "billing.plan_change",
    target: { type: "Subscription", id: user!.orgId },
    summary: `Changed plan from ${from} to ${tier} (no charge — Stripe deferred)`,
    output: { from, to: tier, charged: false },
    approver: actor(user!),
  });
  revalidatePath("/settings/billing");
  return { ok: true };
}

// addSeats — stub: bump seatsPurchased locally, audit. NO real charge.
export async function addSeats(n: number): Promise<BillingActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const count = Math.trunc(n);
  if (!Number.isFinite(count) || count <= 0 || count > 1000) {
    return { ok: false, message: "Enter a seat count between 1 and 1000." };
  }
  const db = dbForOrg(user!.orgId);
  const sub = await db.subscription.findFirst({
    where: { orgId: user!.orgId },
  });
  if (!sub) return { ok: false, message: "No subscription found." };
  await db.subscription.updateMany({
    where: { orgId: user!.orgId },
    data: { seatsPurchased: sub.seatsPurchased + count },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "billing.seats_add",
    target: { type: "Subscription", id: user!.orgId },
    summary: `Added ${count} seats (no charge — Stripe deferred)`,
    output: { added: count, charged: false },
    approver: actor(user!),
  });
  revalidatePath("/settings/billing");
  return { ok: true };
}
