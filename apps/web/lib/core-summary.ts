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
    flaggedRobots,
    openFieldWos,
    openWoField,
    slaSoon,
    ecosInReview,
    fwAwaitingCert,
    openIncidents,
    canaries,
    canary,
    arOverdue,
    ax2,
    technicians,
    openCves,
    obligationsAtRisk,
    exportHolds,
    atRiskObligation,
    ledgerNet,
  ] = await Promise.all([
    db.purchaseOrder.count({ where: { NOT: { status: "RECEIVED" } } }),
    db.purchaseOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
    // VERIFY.3 — every `findFirst` whose row reaches the exception feed is ordered
    // explicitly. Without an orderBy the row is whatever Postgres returns first,
    // which changes on re-seed/VACUUM (see docs/manual-checks.md → VERIFY.3).
    db.purchaseOrder.findFirst({
      where: { status: "AWAITING_APPROVAL", NOT: { draftedByAgentId: null } },
      orderBy: [{ value: "desc" }, { code: "asc" }], // largest exposure first
    }),

    db.workOrderMfg.count({ where: { status: "WIP" } }),
    db.workOrderMfg.count(),

    db.nCR.count({ where: { NOT: { status: "CLOSED" } } }),
    db.nCR.findFirst({
      where: { severity: "CRITICAL", NOT: { status: "CLOSED" } },
      orderBy: { code: "asc" }, // stable across re-seeds (NCR has no opened-at)
    }),
    // column compare needs raw SQL; pin orgId ourselves (the extension doesn't scope raw)
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "SpcSample"
        WHERE "orgId" = ${orgId} AND ("value" > "ucl" OR "value" < "lcl")`,

    db.delivery.count({ where: { NOT: { stage: "ACTIVE" } } }),
    db.delivery.count({ where: { NOT: { riskState: "" } } }),
    db.delivery.findFirst({
      where: { stage: "CUSTOMS", NOT: { riskState: "" } },
      orderBy: [{ etaDate: "asc" }, { code: "asc" }], // soonest promised date first
    }),

    db.robot.aggregate({ _avg: { uptimePct: true } }),
    db.robot.count({ where: { status: { in: ["WATCH", "FAULT"] } } }),
    // VERIFY.3 — was `findFirst` with NO orderBy: five units qualify, so which one
    // surfaced was arbitrary Postgres heap order and flipped on every re-seed. Take
    // the whole flagged set in a deterministic order and pick from it below.
    db.robot.findMany({
      where: { status: { in: ["WATCH", "FAULT"] } },
      orderBy: [{ status: "asc" }, { serial: "asc" }],
    }),
    db.workOrderField.findMany({
      where: { NOT: { status: { in: ["CLOSED", "DONE"] } } },
      orderBy: [{ slaDueAt: "asc" }, { robotSerial: "asc" }],
      select: { robotSerial: true, status: true, issue: true, slaDueAt: true },
    }),

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
    db.policyVersion.findFirst({
      where: { state: "canary" },
      orderBy: { version: "asc" },
    }),

    db.invoice.count({ where: { status: "OVERDUE" } }),
    // PROSPECT.2 — the flagship product's margin (highest ASP), not a hardcoded
    // product name (which returned null — an empty KPI — for any other tenant).
    db.unitEconomic.findFirst({ orderBy: { asp: "desc" } }),

    // ordered so `expiringTechs[0]` (the People exception) is stable — the
    // expiry filter itself runs in JS over the certs JSON, so it can't be an orderBy
    db.technician.findMany({ orderBy: { name: "asc" } }),

    db.cVE.count({
      where: { NOT: { status: { in: ["MITIGATED", "CLOSED", "RESOLVED"] } } },
    }),

    db.obligation.count({ where: { state: "AT_RISK" } }),
    db.exportLicense.count({ where: { state: "HOLD" } }),
    db.obligation.findFirst({
      where: { state: "AT_RISK" },
      orderBy: [{ account: "asc" }, { id: "asc" }], // stable (no due date column)
    }),

    db.ledgerEntry.aggregate({ _sum: { amount: true } }),
  ]);

  const spcBreaches = spcBreach[0]?.n ?? 0;
  const uptimeAvg = robotAgg._avg.uptimePct ?? 0;
  const expiringTechs = technicians.filter((t) => hasExpiringCert(t.certs));
  const marginDown = !!ax2 && /-/.test(ax2.trend);

  // ── the Fleet → Field Service exception (VERIFY.3) ──────────────────────
  // Which flagged unit surfaces used to be arbitrary Postgres heap order. It is
  // now derived: among WATCH/FAULT units, the Command Center leads with the one
  // that still needs a human decision — a unit already EN_ROUTE or ON_SITE is
  // being handled, so it ranks below one still awaiting dispatch. Ties break on
  // the SLA clock (openFieldWos is ordered by it), then on the unit order above.
  // Units with no open field work order rank last: their Field Service handoff
  // hasn't happened, so they're the weakest form of this exception.
  const FIELD_STAGE_RANK: Record<string, number> = {
    OPEN: 0,
    SCHEDULED: 1,
    DISPATCH: 2,
    EN_ROUTE: 3,
    ON_SITE: 4,
  };
  const NO_WO_RANK = 99;
  const woFor = (serial: string) =>
    openFieldWos.find((w) => w.robotSerial === serial);
  const flaggedRanked = flaggedRobots
    .map((r, i) => {
      const wo = woFor(r.serial);
      return {
        robot: r,
        wo,
        rank: wo ? (FIELD_STAGE_RANK[wo.status] ?? 5) : NO_WO_RANK,
        sla: wo?.slaDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
        i,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.sla - b.sla || a.i - b.i);
  const watchRobot = flaggedRanked[0]?.robot ?? null;
  const watchRobotWo = flaggedRanked[0]?.wo ?? null;

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
          label: ax2 ? `${ax2.product} margin` : "Margin",
          value: ax2 ? `${ax2.marginPct.toFixed(1)}%` : "—",
          hint: ax2?.trend,
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

  if (watchRobot) {
    // PROSPECT.2 — derive the reason from the unit's real field work order (its
    // actual issue), not a hardcoded "thermal anomaly" (which assumed one tenant's
    // narrative). Falls back to the status when there's no linked work order.
    const watchWo = watchRobotWo;
    exceptions.push({
      id: `robot-${watchRobot.id}`,
      title: watchWo
        ? `${watchRobot.serial} — ${watchWo.issue}`
        : `${watchRobot.serial} on ${watchRobot.status.toLowerCase()}`,
      severity: "warn",
      module: "fleet",
      sourceLabel: watchRobot.serial,
      url: "/fleet",
      ripples: ["field-service"],
    });
  }

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

  if (marginDown && ax2)
    exceptions.push({
      id: `margin-${ax2.id}`,
      title: `${ax2.product} margin ${ax2.trend}`,
      severity: "warn",
      module: "finance",
      sourceLabel: ax2.product,
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
