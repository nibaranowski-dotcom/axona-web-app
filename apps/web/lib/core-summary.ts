import { dbForOrg } from "@axona/db";

// CMD.1 — the Command Center rollup. Per-module KPIs derived from seeded rows
// (never hardcoded) + a ranked cross-module exception feed where each item is a
// real row plus a curated `ripples[]` of affected modules and a link to the
// source object. All queries org-scoped via dbForOrg, parallelised. Severity
// maps to brand tokens only: critical→ink, warn→lime, ok→green (no invented red).

export type Severity = "critical" | "warn" | "ok";

export interface Kpi {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
  severity?: Severity;
}
export interface ModuleKpis {
  module: string;
  label: string;
  href: string;
  kpis: Kpi[];
}
export interface Exception {
  id: string;
  title: string;
  severity: Severity;
  module: string;
  sourceLabel: string;
  url: string;
  ripples: string[];
}
export interface CoreSummary {
  company: Kpi[];
  kpisByModule: ModuleKpis[];
  exceptions: Exception[];
}

const EXC_CAP = 12;
const SEV_RANK: Record<Severity, number> = { critical: 0, warn: 1, ok: 2 };

function hasExpiringCert(certs: unknown): boolean {
  if (!certs || typeof certs !== "object") return false;
  return Object.values(certs as Record<string, unknown>).some(
    (c) =>
      !!c &&
      typeof c === "object" &&
      (c as { state?: string }).state === "EXPIRING",
  );
}

export async function getCoreSummary(orgId: string): Promise<CoreSummary> {
  const db = dbForOrg(orgId);
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [
    openPOs,
    awaitingPOs,
    draftedPO,
    woMfgWip,
    serialsBuilt,
    openNcrs,
    criticalNcr,
    spcBreach,
    deliveriesInFlight,
    deliveriesAtRisk,
    customsHold,
    robotAgg,
    robotsWatch,
    watchRobot,
    openWoField,
    slaSoon,
    ecosInReview,
    fwAwaitingCert,
    openIncidents,
    canaries,
    canary,
    arOverdue,
    hx2,
    technicians,
    openCves,
    obligationsAtRisk,
    exportHolds,
    atRiskObligation,
    ledgerNet,
  ] = await Promise.all([
    db.purchaseOrder.count({ where: { NOT: { status: "RECEIVED" } } }),
    db.purchaseOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
    db.purchaseOrder.findFirst({
      where: { status: "AWAITING_APPROVAL", NOT: { draftedByAgentId: null } },
    }),

    db.workOrderMfg.count({ where: { status: "WIP" } }),
    db.workOrderMfg.count(),

    db.nCR.count({ where: { NOT: { status: "CLOSED" } } }),
    db.nCR.findFirst({
      where: { severity: "CRITICAL", NOT: { status: "CLOSED" } },
    }),
    // column compare needs raw SQL; pin orgId ourselves (the extension doesn't scope raw)
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "SpcSample"
        WHERE "orgId" = ${orgId} AND ("value" > "ucl" OR "value" < "lcl")`,

    db.delivery.count({ where: { NOT: { stage: "ACTIVE" } } }),
    db.delivery.count({ where: { NOT: { riskState: "" } } }),
    db.delivery.findFirst({
      where: { stage: "CUSTOMS", NOT: { riskState: "" } },
    }),

    db.robot.aggregate({ _avg: { uptimePct: true } }),
    db.robot.count({ where: { status: { in: ["WATCH", "FAULT"] } } }),
    db.robot.findFirst({ where: { status: { in: ["WATCH", "FAULT"] } } }),

    db.workOrderField.count({
      where: { NOT: { status: { in: ["CLOSED", "DONE"] } } },
    }),
    db.workOrderField.count({
      where: {
        slaDueAt: { lte: in24h },
        NOT: { status: { in: ["CLOSED", "DONE"] } },
      },
    }),

    db.eCO.count({ where: { stage: "REVIEW" } }),
    db.firmwareRelease.count({ where: { state: "RC" } }),

    db.safetyIncident.count({
      where: { NOT: { status: { in: ["CLOSED", "RESOLVED"] } } },
    }),
    db.policyVersion.count({ where: { state: "canary" } }),
    db.policyVersion.findFirst({ where: { state: "canary" } }),

    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.unitEconomic.findFirst({ where: { product: "HX-2" } }),

    db.technician.findMany(),

    db.cVE.count({
      where: { NOT: { status: { in: ["MITIGATED", "CLOSED", "RESOLVED"] } } },
    }),

    db.obligation.count({ where: { state: "AT_RISK" } }),
    db.exportLicense.count({ where: { state: "HOLD" } }),
    db.obligation.findFirst({ where: { state: "AT_RISK" } }),

    db.ledgerEntry.aggregate({ _sum: { amount: true } }),
  ]);

  const spcBreaches = spcBreach[0]?.n ?? 0;
  const uptimeAvg = robotAgg._avg.uptimePct ?? 0;
  const expiringTechs = technicians.filter((t) => hasExpiringCert(t.certs));
  const marginDown = !!hx2 && /-/.test(hx2.trend);

  // ── per-module KPIs (derived, curated) ──────────────────────────────────
  const kpisByModule: ModuleKpis[] = [
    {
      module: "procurement",
      label: "Procurement",
      href: "/procurement",
      kpis: [
        { key: "open-pos", label: "Open POs", value: openPOs },
        {
          key: "awaiting",
          label: "Awaiting approval",
          value: awaitingPOs,
          severity: awaitingPOs > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "manufacturing",
      label: "Manufacturing",
      href: "/manufacturing",
      kpis: [
        { key: "wip", label: "Work orders in progress", value: woMfgWip },
        { key: "serials", label: "Serials in build", value: serialsBuilt },
      ],
    },
    {
      module: "quality",
      label: "Quality",
      href: "/quality",
      kpis: [
        {
          key: "open-ncrs",
          label: "Open NCRs",
          value: openNcrs,
          severity: criticalNcr ? "critical" : openNcrs > 0 ? "warn" : "ok",
        },
        {
          key: "spc",
          label: "SPC breaches",
          value: spcBreaches,
          severity: spcBreaches > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "fulfillment",
      label: "Fulfillment",
      href: "/fulfillment",
      kpis: [
        {
          key: "in-flight",
          label: "Deliveries in flight",
          value: deliveriesInFlight,
        },
        {
          key: "at-risk",
          label: "At-risk / holds",
          value: deliveriesAtRisk,
          severity: deliveriesAtRisk > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "fleet",
      label: "Fleet",
      href: "/fleet",
      kpis: [
        {
          key: "uptime",
          label: "Avg uptime",
          value: `${uptimeAvg.toFixed(1)}%`,
        },
        {
          key: "watch",
          label: "Units in watch / fault",
          value: robotsWatch,
          severity: robotsWatch > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "field-service",
      label: "Field Service",
      href: "/field-service",
      kpis: [
        { key: "open-wo", label: "Open work orders", value: openWoField },
        {
          key: "sla",
          label: "SLA due < 24h",
          value: slaSoon,
          severity: slaSoon > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "engineering",
      label: "Engineering",
      href: "/engineering",
      kpis: [
        { key: "eco-review", label: "ECOs in review", value: ecosInReview },
        {
          key: "fw-cert",
          label: "Firmware awaiting cert",
          value: fwAwaitingCert,
          severity: fwAwaitingCert > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "autonomy",
      label: "Autonomy",
      href: "/autonomy",
      kpis: [
        {
          key: "incidents",
          label: "Open safety incidents",
          value: openIncidents,
          severity: openIncidents > 0 ? "warn" : "ok",
        },
        { key: "canaries", label: "Policy canaries active", value: canaries },
      ],
    },
    {
      module: "finance",
      label: "Finance",
      href: "/finance",
      kpis: [
        {
          key: "ar-overdue",
          label: "AR overdue",
          value: arOverdue,
          severity: arOverdue > 0 ? "warn" : "ok",
        },
        {
          key: "margin",
          label: hx2 ? `${hx2.product} margin` : "Margin",
          value: hx2 ? `${hx2.marginPct.toFixed(1)}%` : "—",
          hint: hx2?.trend,
          severity: marginDown ? "warn" : "ok",
        },
      ],
    },
    {
      module: "people",
      label: "People",
      href: "/people",
      kpis: [
        {
          key: "cert-expiring",
          label: "Certs expiring",
          value: expiringTechs.length,
          severity: expiringTechs.length > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "security",
      label: "Security",
      href: "/security",
      kpis: [
        {
          key: "open-cves",
          label: "Open CVEs",
          value: openCves,
          severity: openCves > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      module: "legal",
      label: "Legal",
      href: "/legal",
      kpis: [
        {
          key: "obligations",
          label: "Obligations at risk",
          value: obligationsAtRisk,
          severity: obligationsAtRisk > 0 ? "warn" : "ok",
        },
        {
          key: "export-holds",
          label: "Export holds",
          value: exportHolds,
          severity: exportHolds > 0 ? "warn" : "ok",
        },
      ],
    },
  ];

  // ── cross-module exceptions (real rows + curated ripples) ────────────────
  const exceptions: Exception[] = [];

  if (criticalNcr)
    exceptions.push({
      id: `ncr-${criticalNcr.id}`,
      title: `${criticalNcr.code}: ${criticalNcr.defect}`,
      severity: "critical",
      module: "quality",
      sourceLabel: criticalNcr.code,
      url: "/quality",
      ripples: ["engineering", "procurement", "fulfillment"],
    });

  if (customsHold)
    exceptions.push({
      id: `dlv-${customsHold.id}`,
      title: `${customsHold.code} held at customs (${customsHold.riskState})`,
      severity: "warn",
      module: "fulfillment",
      sourceLabel: customsHold.code,
      url: "/fulfillment",
      ripples: ["legal", "finance"],
    });

  if (watchRobot)
    exceptions.push({
      id: `robot-${watchRobot.id}`,
      title: `${watchRobot.serial} ${watchRobot.status.toLowerCase()} — thermal anomaly`,
      severity: "warn",
      module: "fleet",
      sourceLabel: watchRobot.serial,
      url: "/fleet",
      ripples: ["field-service"],
    });

  if (expiringTechs[0]) {
    const tech = expiringTechs[0];
    exceptions.push({
      id: `tech-${tech.id}`,
      title: `${tech.name} HV/battery cert expiring`,
      severity: "warn",
      module: "people",
      sourceLabel: tech.name,
      url: "/people",
      ripples: ["field-service"],
    });
  }

  if (marginDown && hx2)
    exceptions.push({
      id: `margin-${hx2.id}`,
      title: `${hx2.product} margin ${hx2.trend}`,
      severity: "warn",
      module: "finance",
      sourceLabel: hx2.product,
      url: "/finance",
      ripples: [],
    });

  if (atRiskObligation)
    exceptions.push({
      id: `obl-${atRiskObligation.id}`,
      title: `${atRiskObligation.account} ${atRiskObligation.obligation} at risk`,
      severity: "warn",
      module: "legal",
      sourceLabel: atRiskObligation.account,
      url: "/legal",
      ripples: ["autonomy"],
    });

  if (draftedPO)
    exceptions.push({
      id: `po-${draftedPO.id}`,
      title: `${draftedPO.code} awaiting approval (agent-drafted)`,
      severity: "warn",
      module: "procurement",
      sourceLabel: draftedPO.code,
      url: "/procurement",
      ripples: [],
    });

  if (canary)
    exceptions.push({
      id: `policy-${canary.id}`,
      title: `${canary.version} canary regression`,
      severity: "warn",
      module: "autonomy",
      sourceLabel: canary.version,
      url: "/autonomy",
      ripples: ["fleet"],
    });

  exceptions.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  const ranked = exceptions.slice(0, EXC_CAP);

  // ── company header KPIs ─────────────────────────────────────────────────
  const netUsd = ledgerNet._sum.amount ?? 0;
  const company: Kpi[] = [
    {
      key: "open-exceptions",
      label: "Open exceptions",
      value: ranked.length,
      severity: criticalNcr ? "critical" : ranked.length > 0 ? "warn" : "ok",
    },
    { key: "units-build", label: "Units in build", value: woMfgWip },
    {
      key: "fleet-uptime",
      label: "Fleet uptime",
      value: `${uptimeAvg.toFixed(1)}%`,
    },
    {
      key: "net",
      label: "Net (Q2)",
      value: `$${(netUsd / 1_000_000).toFixed(2)}M`,
    },
    {
      key: "open-quality",
      label: "Open quality issues",
      value: openNcrs,
      severity: criticalNcr ? "critical" : openNcrs > 0 ? "warn" : "ok",
    },
  ];

  return { company, kpisByModule, exceptions: ranked };
}
