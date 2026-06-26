import { dbForOrg } from "@axona/db";

// Per-module live alert counts from the seeded demo-org narrative, scoped via
// dbForOrg. Bounded subset; CMD.1 expands this into the full KPI rollup.
// Predicates match the FND.12 seeded status strings (NCR "OPEN", Robot "WATCH",
// Delivery riskState "EAR99 customs hold" vs "on-track", Invoice "OVERDUE", …).

export async function getModuleAlerts(
  orgId: string,
): Promise<Record<string, number>> {
  const db = dbForOrg(orgId);
  const soon = new Date(Date.now() + 24 * 3600 * 1000);

  const [
    poApproval,
    openCriticalNcr,
    atRiskDeliveries,
    watchRobots,
    slaSoon,
    openIncidents,
    overdueInvoices,
    atRiskObligations,
    ecosInReview,
    openCves,
  ] = await Promise.all([
    db.purchaseOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
    db.nCR.count({
      where: {
        severity: { in: ["CRITICAL", "MAJOR"] },
        status: { not: "CLOSED" },
      },
    }),
    // deliveries with a real risk state (exclude empty + "on-track")
    db.delivery.count({ where: { riskState: { notIn: ["", "on-track"] } } }),
    db.robot.count({ where: { status: { in: ["WATCH", "FAULT"] } } }),
    db.workOrderField.count({
      where: { slaDueAt: { lte: soon }, status: { not: "CLOSED" } },
    }),
    db.safetyIncident.count({ where: { status: { not: "CLOSED" } } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.obligation.count({ where: { state: "AT_RISK" } }),
    db.eCO.count({ where: { stage: "REVIEW" } }),
    db.cVE.count({ where: { status: { not: "CLOSED" } } }),
  ]);

  return {
    procurement: poApproval,
    quality: openCriticalNcr,
    fulfillment: atRiskDeliveries,
    fleet: watchRobots,
    "field-service": slaSoon,
    autonomy: openIncidents,
    finance: overdueInvoices,
    legal: atRiskObligations,
    engineering: ecosInReview,
    security: openCves,
  };
}
