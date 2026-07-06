import type { OrgScopedDb } from "../../src";

// NOTIF.1 — seed the through-line notification feed (matches the Notifications
// design: PO-9007 awaiting approval, Site-3 regression, Osei cert, …). A mix of
// broadcasts (userId null) + recent/older so the Today/Earlier grouping renders.
export async function seedNotifications(
  db: OrgScopedDb,
  orgId: string,
): Promise<number> {
  await db.notification.deleteMany({ where: { orgId } }); // idempotent
  const now = Date.now();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;

  type N = {
    type: "APPROVAL" | "EXCEPTION" | "RUN" | "MENTION" | "SYSTEM";
    title: string;
    body: string;
    targetType: string;
    targetId: string;
    url: string;
    ago: number;
    read?: boolean;
  };
  const rows: N[] = [
    {
      type: "APPROVAL",
      title: "PO-9007 is awaiting your approval",
      body: "$91,200 to Tier-1 Actuator Co — agent-drafted, needs a human decision.",
      targetType: "Procurement",
      targetId: "PO-9007",
      url: "/procurement",
      ago: 9 * min,
    },
    {
      type: "EXCEPTION",
      title: "Autonomy regression at Site-3",
      body: "Takeovers up since the p-13 canary — review the rollback.",
      targetType: "Autonomy",
      targetId: "Site-3 · p-13",
      url: "/autonomy",
      ago: 41 * min,
    },
    {
      type: "RUN",
      title: "Workflow “Procurement reorder” parked",
      body: "Needs a spend-policy decision before it can continue.",
      targetType: "Workflows",
      targetId: "WF-04",
      url: "/workflows",
      ago: 1 * hr,
    },
    {
      type: "APPROVAL",
      title: "M. Osei’s HV/battery cert expires in 12 days",
      body: "Gates Site-2 dispatch — schedule a recert.",
      targetType: "People",
      targetId: "M. Osei",
      url: "/people",
      ago: 2 * hr,
    },
    {
      type: "EXCEPTION",
      title: "NCR-118 opened on SERVO-204",
      body: "Drive torque over UCL — stiff actuator, 3 units on hold.",
      targetType: "Quality",
      targetId: "NCR-118",
      url: "/quality",
      ago: 5 * hr,
    },
    {
      type: "APPROVAL",
      title: "ECO-318 released by Omar Haddad",
      body: "Drive change released — firmware v4.2.2 rolls to fleet.",
      targetType: "Engineering",
      targetId: "ECO-318",
      url: "/engineering",
      ago: 1 * day,
      read: true,
    },
    {
      type: "MENTION",
      title: "Dana Reyes mentioned you",
      body: "“can you confirm the BMW deliverability note before EOD?”",
      targetType: "Sales & CRM",
      targetId: "INV-2208",
      url: "/sales",
      ago: 1 * day,
      read: true,
    },
    {
      type: "EXCEPTION",
      title: "DLV-3312 cleared Osaka customs",
      body: "Back on schedule — EAR99 hold released.",
      targetType: "Fulfillment",
      targetId: "DLV-3312",
      url: "/fulfillment",
      ago: 2 * day,
      read: true,
    },
    {
      type: "RUN",
      title: "Nightly reconciliation completed",
      body: "312 SKUs reconciled · 0 variances.",
      targetType: "Inventory",
      targetId: "CYCLE-0705",
      url: "/inventory",
      ago: 2 * day,
      read: true,
    },
    {
      type: "SYSTEM",
      title: "Daily operations digest compiled",
      body: "8 open exceptions across 12 modules.",
      targetType: "Command Center",
      targetId: "digest",
      url: "/core",
      ago: 3 * day,
      read: true,
    },
    {
      type: "APPROVAL",
      title: "Credit note issued for INV-7741",
      body: "Finance approved a credit — AR adjusted.",
      targetType: "Finance",
      targetId: "INV-7741",
      url: "/finance",
      ago: 3 * day,
      read: true,
    },
    {
      type: "EXCEPTION",
      title: "BMW MSA · 99.5% fleet SLA at risk",
      body: "Autonomy dip threatens the contracted uptime.",
      targetType: "Legal",
      targetId: "BMW-MSA",
      url: "/legal",
      ago: 4 * day,
      read: true,
    },
  ];

  for (const r of rows) {
    await db.notification.create({
      data: {
        type: r.type,
        title: r.title,
        body: r.body,
        targetType: r.targetType,
        targetId: r.targetId,
        url: r.url,
        readAt: r.read ? new Date(now - r.ago + 10_000) : null,
        createdAt: new Date(now - r.ago),
      },
    });
  }
  return rows.length;
}
