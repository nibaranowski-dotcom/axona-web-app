import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// Back-office close of the §3.7 narrative: HX-2 margin −2.1pt from ECO-318;
// BMW net-60 + Kawasaki overdue invoices; BMW 99.5% SLA obligation at risk;
// DLV-3312 EAR99 export license hold; ECO-318 patent + INC-201 legal matters.

export async function seedBackOffice(db: OrgScopedDb): Promise<void> {
  // Finance — monthly P&L ledger (two revenue engines: lumpy hardware recognized
  // at commissioning + ratable RaaS), unit economics, AR invoices (FIN.2).
  const MONTHS: { p: string; hw: number; raas: number }[] = [
    { p: "2025-11", hw: 2.1, raas: 0.8 },
    { p: "2025-12", hw: 3.6, raas: 0.9 },
    { p: "2026-01", hw: 1.4, raas: 1.0 },
    { p: "2026-02", hw: 2.8, raas: 1.05 },
    { p: "2026-03", hw: 4.1, raas: 1.1 },
    { p: "2026-04", hw: 2.2, raas: 1.15 },
    { p: "2026-05", hw: 3.3, raas: 1.2 },
    { p: "2026-06", hw: 4.9, raas: 1.23 },
  ];
  const M = 1_000_000;
  await db.ledgerEntry.createMany({
    data: MONTHS.flatMap((m) => [
      {
        period: m.p,
        account: "Hardware revenue",
        amount: m.hw * M,
        kind: "REVENUE",
      },
      {
        period: m.p,
        account: "RaaS revenue",
        amount: m.raas * M,
        kind: "REVENUE",
      },
      {
        period: m.p,
        account: "COGS",
        amount: -(m.hw + m.raas) * 0.58 * M,
        kind: "COGS",
      },
      { period: m.p, account: "Opex", amount: -1.3 * M, kind: "OPEX" },
    ]),
  });

  await db.unitEconomic.createMany({
    data: [
      {
        product: CODES.product, // HX-2 — flagship, margin dented by ECO-318
        asp: 210_000,
        cogs: 132_000,
        marginPct: 37.1,
        trend: `-2.1pt from ${CODES.eco}`,
      },
      {
        product: "HX-1",
        asp: 58_000,
        cogs: 31_000,
        marginPct: 46.6,
        trend: "+1.3pt",
      },
      {
        product: "RaaS subscription",
        asp: 36_000,
        cogs: 12_000,
        marginPct: 66.7,
        trend: "flat",
      },
      {
        product: "Spares & service",
        asp: 14_000,
        cogs: 5_900,
        marginPct: 58.0,
        trend: "+0.6pt",
      },
    ],
  });

  await db.invoice.createMany({
    data: [
      {
        code: "INV-7741",
        account: "BMW",
        source: "DLV · 24× HX-2 + RaaS",
        amount: 8_400_000,
        terms: "net-60",
        dueDate: d("+38d"),
        status: "OPEN",
      },
      {
        code: "INV-7728",
        account: "Maersk",
        source: "DLV-3301 · commissioned",
        amount: 1_900_000,
        terms: "net-30",
        dueDate: d("+8d"),
        status: "OPEN",
      },
      {
        code: "INV-7715",
        account: "Tesla",
        source: "RaaS · Q2 ratable",
        amount: 600_000,
        terms: "net-30",
        dueDate: d("+21d"),
        status: "OPEN",
      },
      {
        code: "INV-7702",
        account: "Kawasaki",
        source: "Spares · RMA-441",
        amount: 500_000,
        terms: "net-45",
        dueDate: d("-62d"),
        status: "OVERDUE",
      },
    ],
  });

  // A real fin-orchestrator run so the AGENT TRACE block is populated (FIN.2).
  const finAgent = await db.agent.findFirst({
    where: { moduleKey: "finance" },
    orderBy: { code: "asc" },
  });
  if (finAgent) {
    await db.agentRun.create({
      data: {
        agentId: finAgent.id,
        input: { prompt: "Run the month-end revenue recognition + AR review." },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-2h").toISOString(),
            kind: "recognize",
            text: "DLV-3301 commissioned → $1.9M hardware",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "raas",
            text: "44 active subs → $1.23M ratable Jun",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "cost-roll",
            text: `${CODES.eco} +$140/unit → HX-2 margin -2.1pt`,
          },
          {
            ts: d("-2h").toISOString(),
            kind: "ar",
            text: "BMW INV-7741 net-60 · not yet due · $8.4M",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "close",
            text: "312 JEs · 3-way matched → 98% auto",
          },
        ],
      },
    });
  }

  // People — open requisitions (field-team-vs-fleet growth)
  await db.requisition.createMany({
    data: [
      { role: "Field Service Technician", filled: 8, target: 12 },
      { role: "Autonomy Engineer", filled: 3, target: 5 },
      { role: "Quality Inspector", filled: 4, target: 4 },
    ],
  });

  // Security — CVEs affecting deployed units; one tied to the firmware patch
  await db.cVE.create({
    data: {
      code: "CVE-2026-3187",
      severity: "MAJOR",
      affectedUnits: 42,
      status: "TRIAGE",
    },
  });
  await db.cVE.create({
    data: {
      code: "CVE-2026-2991",
      severity: "MINOR",
      affectedUnits: 11,
      status: "MITIGATED",
    },
  });

  // Legal — obligations vs live ops, export control, IP/liability/reg matters
  // (LEGAL.2). BMW 99.5% SLA at-risk from the autonomy regression · DLV-3312
  // EAR99 export hold · ECO-318 patent + INC-201 liability linked to their source.
  await db.obligation.createMany({
    data: [
      {
        account: "BMW",
        obligation: "MSA · 99.5% fleet SLA",
        actual: "Site-3 98.1% (autonomy regression)",
        state: "AT_RISK",
      },
      {
        account: "Maersk",
        obligation: "RaaS · 30-day delivery warranty",
        actual: "On track",
        state: "MET",
      },
      {
        account: "Tesla",
        obligation: "MSA · $14M liability cap",
        actual: "Within cap",
        state: "MET",
      },
      {
        account: "Kawasaki",
        obligation: "Supply · spares SLA 5 days",
        actual: "RMA-441 aging",
        state: "REVIEW",
      },
    ],
  });
  await db.exportLicense.createMany({
    data: [
      {
        destination: "Kawasaki · Osaka, JP",
        code: `EAR99-${CODES.delivery}`, // EAR99-DLV-3312
        state: "HOLD",
      },
      {
        destination: "Tesla · Austin, US",
        code: "DLV-3305 · no license",
        state: "CLEAR",
      },
      {
        destination: "Siemens · Munich, DE",
        code: "Dual-use review",
        state: "PENDING",
      },
      {
        destination: "Maersk · Rotterdam, NL",
        code: "EU intra · exempt",
        state: "CLEAR",
      },
    ],
  });
  await db.legalMatter.createMany({
    data: [
      {
        type: "LIABILITY",
        title: "INC-201 proximity near-miss — exposure review",
        linkedTo: CODES.incident, // INC-201 → autonomy
        status: "MONITORING",
      },
      {
        type: "IP",
        title: "Harmonic-drive tolerance patent (ECO-318)",
        linkedTo: CODES.eco, // ECO-318 → engineering
        status: "DRAFTING",
      },
      {
        type: "REG",
        title: "EU Machinery Regulation 2027 conformity",
        linkedTo: CODES.ncr, // NCR-118 → quality
        status: "IN_PROGRESS",
      },
      {
        type: "CONTRACT",
        title: "BMW MSA redline — net-60 + SLA terms",
        linkedTo: "INV-7741", // → finance
        status: "EXECUTING",
      },
      {
        type: "EXPORT",
        title: "DLV-3312 EAR99 license application",
        linkedTo: CODES.delivery, // DLV-3312 → fulfillment
        status: "FILED",
      },
    ],
  });

  // A real legal-orchestrator run so the AGENT TRACE block is populated (LEGAL.2).
  const legalAgent = await db.agent.findFirst({
    where: { moduleKey: "legal" },
    orderBy: { code: "asc" },
  });
  if (legalAgent) {
    await db.agentRun.create({
      data: {
        agentId: legalAgent.id,
        input: {
          prompt: "Watch obligations vs live ops and clear export holds.",
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-90m").toISOString(),
            kind: "watch",
            text: "47 contracts · SLA + warranty terms",
          },
          {
            ts: d("-90m").toISOString(),
            kind: "breach-risk",
            text: "BMW 99.5% SLA vs Site-3 98.1% → risk",
          },
          {
            ts: d("-90m").toISOString(),
            kind: "export",
            text: `${CODES.delivery} EAR99 license → file (Fulfillment hold)`,
          },
          {
            ts: d("-90m").toISOString(),
            kind: "liability",
            text: "INC-201 near-miss → log · monitor exposure",
          },
          {
            ts: d("-90m").toISOString(),
            kind: "reg",
            text: "EU Machinery Reg 2027 conformity → on track",
          },
        ],
      },
    });
  }
}
