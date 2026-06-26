import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// Back-office close of the §3.7 narrative: HX-2 margin −2.1pt from ECO-318;
// BMW net-60 + Kawasaki overdue invoices; BMW 99.5% SLA obligation at risk;
// DLV-3312 EAR99 export license hold; ECO-318 patent + INC-201 legal matters.

export async function seedBackOffice(db: OrgScopedDb): Promise<void> {
  // Finance — ledger, unit economics, invoices
  await db.ledgerEntry.createMany({
    data: [
      {
        period: "2026-Q2",
        account: "Hardware revenue",
        amount: 3_600_000,
        kind: "REVENUE",
      },
      {
        period: "2026-Q2",
        account: "RaaS revenue",
        amount: 720_000,
        kind: "REVENUE",
      },
      { period: "2026-Q2", account: "COGS", amount: -2_480_000, kind: "COGS" },
      { period: "2026-Q2", account: "Opex", amount: -1_310_000, kind: "OPEX" },
    ],
  });
  await db.unitEconomic.create({
    data: {
      product: CODES.product,
      asp: 200_000,
      cogs: 154_200,
      marginPct: 22.9,
      trend: `-2.1pt from ${CODES.eco}`,
    },
  });
  await db.unitEconomic.create({
    data: {
      product: "HX-1",
      asp: 165_000,
      cogs: 120_400,
      marginPct: 27.0,
      trend: "flat",
    },
  });
  await db.invoice.create({
    data: {
      code: "INV-7741",
      account: "BMW",
      source: "hardware",
      amount: 1_200_000,
      terms: "net-60",
      dueDate: d("+38d"),
      status: "OPEN",
    },
  });
  await db.invoice.create({
    data: {
      code: "INV-7702",
      account: "Kawasaki",
      source: "RaaS",
      amount: 96_000,
      terms: "net-30",
      dueDate: d("-9d"),
      status: "OVERDUE",
    },
  });

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

  // Legal — obligations vs live ops, export license, IP/liability matters
  await db.obligation.create({
    data: {
      account: "BMW",
      obligation: "99.5% fleet SLA",
      actual: "99.3% (autonomy regression)",
      state: "AT_RISK",
    },
  });
  await db.exportLicense.create({
    data: {
      destination: "Osaka, JP",
      code: `EAR99-${CODES.delivery}`,
      state: "HOLD",
    },
  });
  await db.legalMatter.create({
    data: {
      type: "IP",
      title: "ECO-318 torque-comp patent",
      linkedTo: CODES.eco,
      status: "DRAFTING",
    },
  });
  await db.legalMatter.create({
    data: {
      type: "LIABILITY",
      title: "INC-201 near-miss review",
      linkedTo: CODES.incident,
      status: "OPEN",
    },
  });
}
