import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// Value-chain slice of the §3.7 narrative: Suppliers/Parts/POs (incl. an
// agent-drafted PO AWAITING_APPROVAL), WorkOrderMfg (lot 88421 / SERVO-204),
// NCR-118, the SPC torque breach, Certs, the BMW deal, Campaigns, DLV-3312.

function torqueSeries(): {
  characteristic: string;
  serial: string;
  value: number;
  ucl: number;
  lcl: number;
  mean: number;
  ts: Date;
}[] {
  const ucl = 4.2;
  const lcl = 3.4;
  const mean = 3.8;
  // last point breaches UCL (stiff actuator → NCR-118)
  const values = [3.7, 3.9, 3.8, 4.0, 4.1, 4.0, 4.3, 4.5];
  return values.map((value, i) => ({
    characteristic: "drive_torque_Nm",
    serial: CODES.servoOld,
    value,
    ucl,
    lcl,
    mean,
    ts: d(`-${(values.length - i) * 1}d`),
  }));
}

export async function seedValueChain(db: OrgScopedDb): Promise<void> {
  // Suppliers (fictional sample names; BMW/Kawasaki appear as customers, allowed §3.7)
  const actuatorCo = await db.supplier.create({
    data: {
      name: "Tier-1 Actuator Co",
      tier: 1,
      riskScore: 0.32,
      onTimePct: 94.1,
    },
  });
  const bearings = await db.supplier.create({
    data: {
      name: "Precision Bearings Ltd",
      tier: 2,
      riskScore: 0.18,
      onTimePct: 98.6,
    },
  });
  await db.supplier.create({
    data: {
      name: "Cells & Power KK",
      tier: 1,
      riskScore: 0.41,
      onTimePct: 91.3,
    },
  });

  // Parts — the superseded + replacement drive, plus a battery pack
  const servo204 = await db.part.create({
    data: {
      sku: CODES.servoOld,
      name: "Actuator drive (superseded)",
      onHand: 6,
      reorderPoint: 20,
      leadDays: 35,
    },
  });
  const servo205 = await db.part.create({
    data: {
      sku: CODES.servoNew,
      name: "Actuator drive (torque-comp)",
      onHand: 0,
      reorderPoint: 20,
      leadDays: 42,
    },
  });
  await db.part.create({
    data: {
      sku: "BATT-HX2",
      name: "HX-2 battery pack",
      onHand: 14,
      reorderPoint: 10,
      leadDays: 21,
    },
  });

  // The reorder agent that drafts the re-source PO (propose→approve→audit)
  const reorderAgent = await db.agent.findFirst({ where: { code: "proc-04" } });

  // POs: one sent, one received, one agent-DRAFTED awaiting approval (re-source -205)
  await db.purchaseOrder.create({
    data: {
      code: "PO-9001",
      supplierId: bearings.id,
      partId: servo204.id,
      qty: 50,
      value: 42_000,
      status: "SENT",
      eta: d("+10d"),
    },
  });
  await db.purchaseOrder.create({
    data: {
      code: "PO-9002",
      supplierId: actuatorCo.id,
      partId: servo204.id,
      qty: 24,
      value: 86_400,
      status: "RECEIVED",
      eta: d("-5d"),
    },
  });
  await db.purchaseOrder.create({
    data: {
      code: "PO-9007",
      supplierId: actuatorCo.id,
      partId: servo205.id,
      qty: 24,
      value: 91_200,
      status: "AWAITING_APPROVAL",
      draftedByAgentId: reorderAgent?.id ?? null,
      eta: d("+42d"),
    },
  });

  // Manufacturing genealogy — HX-2 builds; one carries the affected lot 88421
  await db.workOrderMfg.create({
    data: {
      serial: "HX2-0418",
      product: CODES.product,
      station: "Final Assembly",
      status: "HOLD",
      startedAt: d("-12d"),
    },
  });
  await db.workOrderMfg.create({
    data: {
      serial: "HX2-0419",
      product: CODES.product,
      station: "Drive Integration",
      status: "WIP",
      startedAt: d("-9d"),
    },
  });
  await db.workOrderMfg.create({
    data: {
      serial: "HX2-0420",
      product: CODES.product,
      station: "Test",
      status: "WIP",
      startedAt: d("-6d"),
    },
  });

  // Quality: torque drifting over UCL on SERVO-204 → NCR-118 → lot 88421
  await db.spcSample.createMany({ data: torqueSeries() });
  await db.nCR.create({
    data: {
      code: CODES.ncr,
      defect: "Drive torque over UCL (stiff actuator)",
      linkedTo: `${CODES.lot}; ${CODES.servoOld}`,
      severity: "CRITICAL",
      status: "OPEN",
    },
  });

  // Certs — audit-ready compliance
  await db.cert.create({
    data: {
      name: "CE",
      scope: "HX-2 line",
      validTo: d("+6m"),
      status: "VALID",
    },
  });
  await db.cert.create({
    data: {
      name: "UL",
      scope: "HX-2 battery",
      validTo: d("+2m"),
      status: "VALID",
    },
  });
  await db.cert.create({
    data: {
      name: "ISO 9001",
      scope: "QMS",
      validTo: d("+12m"),
      status: "VALID",
    },
  });

  // Sales: BMW 24-unit deal at-risk +3w (feasibility flagged by ops)
  await db.deal.create({
    data: {
      account: "BMW",
      config: `${CODES.product} ×24`,
      value: 4_800_000,
      stage: "COMMIT",
      closeDate: d("+30d"),
      feasibility: "AT_RISK",
    },
  });
  await db.deal.create({
    data: {
      account: "Kawasaki",
      config: `${CODES.product} ×6`,
      value: 1_200_000,
      stage: "NEGOTIATION",
      closeDate: d("+60d"),
      feasibility: "ON_TIME",
    },
  });

  // Marketing: events dominant; one underperforming paid campaign flagged
  await db.campaign.create({
    data: {
      name: "Automate 2026 (events)",
      channel: "events",
      mqls: 320,
      pipeline: 5_400_000,
      roi: 6.2,
      status: "ACTIVE",
    },
  });
  await db.campaign.create({
    data: {
      name: "Paid search Q3",
      channel: "paid",
      mqls: 41,
      pipeline: 220_000,
      roi: 0.7,
      status: "UNDERPERFORMING",
    },
  });

  // Fulfillment: the delivery pipeline (ALLOC → ACTIVE). DLV-3312 is the BMW
  // Osaka shipment held at customs (EAR99) — the ECO-318 → BMW order → hold
  // thread. The rest span the pipeline so it renders full (FUL.2).
  await db.delivery.createMany({
    data: [
      {
        code: CODES.delivery, // DLV-3312 — BMW Osaka, held at customs (EAR99)
        account: "BMW",
        destination: "Osaka, JP",
        units: `24× ${CODES.product}`,
        stage: "CUSTOMS",
        committedDate: d("+21d"),
        etaDate: d("+42d"),
        riskState: "EAR99 customs hold",
      },
      {
        code: "DLV-3315",
        account: "Kawasaki",
        destination: "Nagoya, JP",
        units: `4× ${CODES.product}`,
        stage: "ALLOC",
        committedDate: d("+35d"),
        etaDate: d("+33d"),
        riskState: "on-track",
      },
      {
        code: "DLV-3311",
        account: "BMW",
        destination: "Munich, DE",
        units: `2× ${CODES.product}`,
        stage: "CRATE",
        committedDate: d("+28d"),
        etaDate: d("+27d"),
        riskState: "on-track",
      },
      {
        code: "DLV-3309",
        account: "Kawasaki",
        destination: "Kobe, JP",
        units: `6× ${CODES.product}`,
        stage: "FREIGHT",
        committedDate: d("+14d"),
        etaDate: d("+12d"),
        riskState: "on-track",
      },
      {
        code: "DLV-3306",
        account: "BMW",
        destination: "Munich, DE",
        units: `1× ${CODES.product}`,
        stage: "ONSITE",
        committedDate: d("+9d"),
        etaDate: d("+8d"),
        riskState: "on-track",
      },
      {
        code: "DLV-3304",
        account: "Kawasaki",
        destination: "Kobe, JP",
        units: `3× ${CODES.product}`,
        stage: "COMMISSION",
        committedDate: d("+4d"),
        etaDate: d("+3d"),
        riskState: "on-track",
      },
      {
        code: "DLV-3301",
        account: "BMW",
        destination: "Munich, DE",
        units: `8× ${CODES.product}`,
        stage: "ACTIVE",
        committedDate: d("-10d"),
        etaDate: d("-12d"),
        riskState: "on-track",
      },
    ],
  });

  // A real ful-orchestrator run so the AGENT TRACE block is populated (FUL.2).
  const fulAgent = await db.agent.findFirst({
    where: { moduleKey: "fulfillment" },
    orderBy: { code: "asc" },
  });
  if (fulAgent) {
    await db.agentRun.create({
      data: {
        agentId: fulAgent.id,
        input: {
          prompt: "Clear the DLV-3312 customs hold and keep installs on track.",
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-2h").toISOString(),
            kind: "allocate",
            text: "6 finished units → open orders",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "customs",
            text: `${CODES.delivery} HELD · export license (Osaka)`,
          },
          {
            ts: d("-2h").toISOString(),
            kind: "file",
            text: "EAR99 classification · re-submit",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "freight",
            text: "hold air slot · recovers ETA",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "install",
            text: "DLV-3304 on-site · commission 50%",
          },
        ],
      },
    });
  }
}
