import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// Back-office close of the §3.7 narrative: AX-2 margin −2.1pt from ECO-318;
// Tier-1 Auto OEM net-60 + OEM-2 overdue invoices; Tier-1 Auto OEM 99.5% SLA obligation at risk;
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
        product: CODES.product, // AX-2 — flagship, margin dented by ECO-318
        asp: 210_000,
        cogs: 132_000,
        marginPct: 37.1,
        trend: `-2.1pt from ${CODES.eco}`,
      },
      {
        product: "AX-1",
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
        account: "Tier-1 Auto OEM",
        source: "DLV · 24× AX-2 + RaaS",
        amount: 8_400_000,
        terms: "net-60",
        dueDate: d("+38d"),
        status: "OPEN",
      },
      {
        code: "INV-7728",
        account: "OEM-4",
        source: "DLV-3301 · commissioned",
        amount: 1_900_000,
        terms: "net-30",
        dueDate: d("+8d"),
        status: "OPEN",
      },
      {
        code: "INV-7715",
        account: "OEM-3",
        source: "RaaS · Q2 ratable",
        amount: 600_000,
        terms: "net-30",
        dueDate: d("+21d"),
        status: "OPEN",
      },
      {
        code: "INV-7702",
        account: "OEM-2",
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
            text: `${CODES.eco} +$140/unit → AX-2 margin -2.1pt`,
          },
          {
            ts: d("-2h").toISOString(),
            kind: "ar",
            text: "Tier-1 Auto OEM INV-7741 net-60 · not yet due · $8.4M",
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

  // People — headcount requisitions (field-team-vs-fleet growth, PPL.2)
  await db.requisition.createMany({
    data: [
      { role: "Field Service Technician", filled: 18, target: 21 },
      { role: "Commissioning Engineer", filled: 6, target: 8 },
      { role: "Production Assembly", filled: 42, target: 44 },
      { role: "Autonomy / SW", filled: 19, target: 24 },
      { role: "Go-to-market", filled: 14, target: 18 },
    ],
  });

  // A real ppl-orchestrator run so the AGENT TRACE block is populated (PPL.2).
  const pplAgent = await db.agent.findFirst({
    where: { moduleKey: "people" },
    orderBy: { code: "asc" },
  });
  if (pplAgent) {
    await db.agentRun.create({
      data: {
        agentId: pplAgent.id,
        input: { prompt: "Watch cert expiries and field-team capacity." },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-4h").toISOString(),
            kind: "scan",
            text: "6 field techs · 5 cert types",
          },
          {
            ts: d("-4h").toISOString(),
            kind: "cert-gate",
            text: `M. Osei HV/battery cert expires 12d → gates ${CODES.robot} work`,
          },
          {
            ts: d("-4h").toISOString(),
            kind: "recert",
            text: "book recert slot · notify Field Service",
          },
          {
            ts: d("-4h").toISOString(),
            kind: "capacity",
            text: "field team : fleet → hire ahead 1:4",
          },
          {
            ts: d("-4h").toISOString(),
            kind: "req",
            text: "FS-Tech ×3 · pipeline 14 candidates",
          },
        ],
      },
    });
  }

  // Security — the connected-robot attack surface (SEC.2). A CVE list with a
  // severity/status mix + real affected-deployed-unit counts. The load-bearing
  // one, CVE-2026-3187, affects deployed units and its fix is the signed-firmware
  // patch v4.2.2-rc (Engineering) that must clear the cert gate before rollout.
  // Device posture is derived over the seeded fleet (no DevicePosture model).
  await db.cVE.createMany({
    data: [
      {
        code: "CVE-2026-3187",
        severity: "CRITICAL",
        affectedUnits: 42,
        status: "PATCH_DRAFTED",
      }, // fix = v4.2.2-rc, gated by ENG cert gate
      {
        code: "CVE-2026-3402",
        severity: "MAJOR",
        affectedUnits: 18,
        status: "TRIAGE",
      },
      {
        code: "CVE-2026-3298",
        severity: "MAJOR",
        affectedUnits: 6,
        status: "PATCH_DRAFTED",
      },
      {
        code: "CVE-2026-3155",
        severity: "MINOR",
        affectedUnits: 3,
        status: "MITIGATED",
      },
      {
        code: "CVE-2026-2991",
        severity: "MINOR",
        affectedUnits: 11,
        status: "MITIGATED",
      },
      {
        code: "CVE-2026-2860",
        severity: "CRITICAL",
        affectedUnits: 0,
        status: "TRIAGE",
      }, // component CVE, no deployed units yet
    ],
  });

  // A real sec-orchestrator run so the AGENT TRACE block is populated (SEC.2).
  const secAgent = await db.agent.findFirst({
    where: { moduleKey: "security" },
    orderBy: { code: "asc" },
  });
  if (secAgent) {
    await db.agentRun.create({
      data: {
        agentId: secAgent.id,
        input: { prompt: "Triage CVEs on deployed units and stage the patch." },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-5h").toISOString(),
            kind: "scan",
            text: "6 CVEs · 80 unit-exposures across the fleet",
          },
          {
            ts: d("-5h").toISOString(),
            kind: "triage",
            text: `CVE-2026-3187 CRITICAL · 42 deployed ${CODES.product} units`,
          },
          {
            ts: d("-5h").toISOString(),
            kind: "patch",
            text: `draft signed firmware ${CODES.firmware} → fixes CVE-2026-3187`,
          },
          {
            ts: d("-5h").toISOString(),
            kind: "cert-gate",
            text: `${CODES.firmware} in-test · awaiting Engineering cert gate`,
          },
          {
            ts: d("-5h").toISOString(),
            kind: "propose",
            text: "rollout drafted · human approves (RBAC.4)",
          },
        ],
      },
    });
  }

  // Legal — obligations vs live ops, export control, IP/liability/reg matters
  // (LEGAL.2). Tier-1 Auto OEM 99.5% SLA at-risk from the autonomy regression · DLV-3312
  // EAR99 export hold · ECO-318 patent + INC-201 liability linked to their source.
  await db.obligation.createMany({
    data: [
      {
        account: "Tier-1 Auto OEM",
        obligation: "MSA · 99.5% fleet SLA",
        actual: "Site-3 98.1% (autonomy regression)",
        state: "AT_RISK",
      },
      {
        account: "OEM-4",
        obligation: "RaaS · 30-day delivery warranty",
        actual: "On track",
        state: "MET",
      },
      {
        account: "OEM-3",
        obligation: "MSA · $14M liability cap",
        actual: "Within cap",
        state: "MET",
      },
      {
        account: "OEM-2",
        obligation: "Supply · spares SLA 5 days",
        actual: "RMA-441 aging",
        state: "REVIEW",
      },
    ],
  });
  await db.exportLicense.createMany({
    data: [
      {
        destination: "OEM-2 · Osaka, JP",
        code: `EAR99-${CODES.delivery}`, // EAR99-DLV-3312
        state: "HOLD",
      },
      {
        destination: "OEM-3 · Austin, US",
        code: "DLV-3305 · no license",
        state: "CLEAR",
      },
      {
        destination: "OEM-6 · Munich, DE",
        code: "Dual-use review",
        state: "PENDING",
      },
      {
        destination: "OEM-4 · Rotterdam, NL",
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
        title: "Tier-1 Auto OEM MSA redline — net-60 + SLA terms",
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
            text: "Tier-1 Auto OEM 99.5% SLA vs Site-3 98.1% → risk",
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
