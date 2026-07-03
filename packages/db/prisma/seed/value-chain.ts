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

  // Manufacturing — the MES line across 6 stations (MFG.2). Units flow Frame
  // Build → Drive Integration → Actuators → Firmware → Test → Pack-out. Two units
  // carry a MULTI-station as-built trace (the genealogy anchor = serial):
  //   HX2-0221 — clean build on the SERVO-205 drive (post-ECO-318): full pass.
  //   HX2-0208 — carries the SERVO-204 / lot-88421 defect → HOLD at Test (the
  //              NCR-118 source). The parts·serials·firmware graph is ONT.2.
  const STATIONS = [
    "Frame Build",
    "Drive Integration",
    "Actuators",
    "Firmware",
    "Test",
    "Pack-out",
  ];
  // A full/partial build trace for one serial: DONE up to the last station, which
  // takes `lastStatus`. startedAt increases down the line (Frame is oldest).
  const buildTrace = (
    serial: string,
    product: string,
    stations: number,
    lastStatus: string,
  ) =>
    STATIONS.slice(0, stations).map((station, i) => ({
      serial,
      product,
      station,
      status: i < stations - 1 ? "DONE" : lastStatus,
      startedAt: d(`-${(stations - i) * 2}d`),
    }));

  await db.workOrderMfg.createMany({
    data: [
      // Multi-station as-built traces (getGenealogy shows the full history)
      ...buildTrace("HX2-0221", CODES.product, 6, "DONE"), // clean SERVO-205 unit
      ...buildTrace("HX2-0208", CODES.product, 5, "HOLD"), // SERVO-204 / lot-88421 defect → HOLD at Test
      // Units currently in flow across the stations (one per current station)
      {
        serial: "HX2-0230",
        product: CODES.product,
        station: "Frame Build",
        status: "WIP",
        startedAt: d("-1d"),
      },
      {
        serial: "HX2-0228",
        product: CODES.product,
        station: "Drive Integration",
        status: "WIP",
        startedAt: d("-2d"),
      },
      {
        serial: "HX2-0226",
        product: CODES.product,
        station: "Drive Integration",
        status: "WIP",
        startedAt: d("-3d"),
      },
      {
        serial: "HX2-0224",
        product: CODES.product,
        station: "Actuators",
        status: "WIP",
        startedAt: d("-4d"),
      },
      {
        serial: "HX2-0222",
        product: CODES.product,
        station: "Firmware",
        status: "WIP",
        startedAt: d("-5d"),
      },
      {
        serial: "HX2-0219",
        product: CODES.product,
        station: "Test",
        status: "WIP",
        startedAt: d("-6d"),
      },
      {
        serial: "HX2-0216",
        product: CODES.product,
        station: "Pack-out",
        status: "WIP",
        startedAt: d("-7d"),
      },
      {
        serial: "HX2-0214",
        product: CODES.product,
        station: "Pack-out",
        status: "DONE",
        startedAt: d("-8d"),
      },
      // HX-1 line units
      {
        serial: "HX1-0330",
        product: "HX-1",
        station: "Frame Build",
        status: "WIP",
        startedAt: d("-1d"),
      },
      {
        serial: "HX1-0326",
        product: "HX-1",
        station: "Actuators",
        status: "WIP",
        startedAt: d("-3d"),
      },
      {
        serial: "HX1-0322",
        product: "HX-1",
        station: "Test",
        status: "WIP",
        startedAt: d("-5d"),
      },
    ],
  });

  // A real mfg-orchestrator run so the AGENT TRACE block is populated (MFG.2).
  const mfgAgent = await db.agent.findFirst({
    where: { moduleKey: "manufacturing" },
    orderBy: { code: "asc" },
  });
  if (mfgAgent) {
    await db.agentRun.create({
      data: {
        agentId: mfgAgent.id,
        input: { prompt: "Monitor the lines and hold the on-time date." },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-3h").toISOString(),
            kind: "monitor",
            text: "stations F→Pack · 15 units in build",
          },
          {
            ts: d("-3h").toISOString(),
            kind: "test-fail",
            text: "HX2-0208 station-5 payload test → fail (torque +4%)",
          },
          {
            ts: d("-3h").toISOString(),
            kind: "halt",
            text: `hold HX2-0208 · open ${CODES.ncr}`,
          },
          {
            ts: d("-3h").toISOString(),
            kind: "re-route",
            text: "re-sequence 6 work orders · on-time held",
          },
          {
            ts: d("-3h").toISOString(),
            kind: "genealogy",
            text: "log HX2-0221 as-built (SERVO-205)",
          },
        ],
      },
    });
  }

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

  // Sales: the enterprise pipeline across all 5 stages (SALES.2). BMW 24-unit deal
  // is AT_RISK +3w — its deliverability resolves through Fulfillment (DLV-3312
  // EAR99 hold) + Manufacturing (HX2-0208 hold at Test, ECO-318/lot-88421), not a
  // hardcoded flag. Feasibility mix across the rest.
  await db.deal.createMany({
    data: [
      {
        account: "BMW",
        config: `${CODES.product} ×24`,
        value: 4_800_000,
        stage: "COMMIT",
        closeDate: d("+30d"),
        feasibility: "AT_RISK",
      },
      {
        account: "Kawasaki",
        config: `${CODES.product} ×6`,
        value: 1_200_000,
        stage: "NEGOTIATION",
        closeDate: d("+60d"),
        feasibility: "ON_TIME",
      },
      {
        account: "Tesla",
        config: "HX-1 ×30",
        value: 1_740_000,
        stage: "NEGOTIATION",
        closeDate: d("+50d"),
        feasibility: "ON_TIME",
      },
      {
        account: "Foxconn",
        config: `${CODES.product} ×40`,
        value: 8_000_000,
        stage: "PROPOSAL",
        closeDate: d("+85d"),
        feasibility: "NOT_CHECKED",
      },
      {
        account: "Maersk",
        config: `${CODES.product} ×12`,
        value: 2_400_000,
        stage: "PROPOSAL",
        closeDate: d("+75d"),
        feasibility: "NOT_CHECKED",
      },
      {
        account: "Siemens",
        config: `${CODES.product} ×8`,
        value: 1_600_000,
        stage: "DEMO",
        closeDate: d("+90d"),
        feasibility: "NOT_CHECKED",
      },
      {
        account: "Hyundai",
        config: "HX-1 ×20",
        value: 1_160_000,
        stage: "QUALIFY",
        closeDate: d("+120d"),
        feasibility: "NOT_CHECKED",
      },
      {
        account: "Boeing",
        config: "HX-1 ×15",
        value: 870_000,
        stage: "QUALIFY",
        closeDate: d("+110d"),
        feasibility: "NOT_CHECKED",
      },
    ],
  });

  // A real sales-orchestrator run so the AGENT TRACE block is populated (SALES.2).
  const salesAgent = await db.agent.findFirst({
    where: { moduleKey: "sales" },
    orderBy: { code: "asc" },
  });
  if (salesAgent) {
    await db.agentRun.create({
      data: {
        agentId: salesAgent.id,
        input: {
          prompt: "Work the funnel and deliverability-check the pipeline.",
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-6h").toISOString(),
            kind: "funnel",
            text: "8 deals · $21.8M pipeline across 5 stages",
          },
          {
            ts: d("-6h").toISOString(),
            kind: "forecast",
            text: "Q3 weighted forecast $9.4M",
          },
          {
            ts: d("-6h").toISOString(),
            kind: "deliverability",
            text: `BMW ${CODES.product}×24 → check ops build+deliver`,
          },
          {
            ts: d("-6h").toISOString(),
            kind: "at-risk",
            text: `DLV-3312 hold + HX2-0208 line hold → BMW slips +3w`,
          },
          {
            ts: d("-6h").toISOString(),
            kind: "propose",
            text: "flag BMW deliverability AT_RISK · notify AE (RBAC.4)",
          },
        ],
      },
    });
  }

  // Marketing: a multi-channel campaign set (MKT.2). Events dominate the pipeline
  // attribution; "Paid search Q3" is the flagged underperformer (roi < 1). Sourced
  // pipeline reconciles to the Sales pipeline (SALES.1) — not hardcoded.
  await db.campaign.createMany({
    data: [
      {
        name: "Automate 2026 (events)",
        channel: "events",
        mqls: 320,
        pipeline: 5_400_000,
        roi: 6.2,
        status: "ACTIVE",
      },
      {
        name: "Humanoid Summit (events)",
        channel: "events",
        mqls: 180,
        pipeline: 3_100_000,
        roi: 5.4,
        status: "ACTIVE",
      },
      {
        name: "LinkedIn ABM — enterprise",
        channel: "abm",
        mqls: 95,
        pipeline: 4_200_000,
        roi: 4.8,
        status: "ACTIVE",
      },
      {
        name: "Robotics whitepaper",
        channel: "content",
        mqls: 140,
        pipeline: 1_600_000,
        roi: 3.1,
        status: "ACTIVE",
      },
      {
        name: "Nurture sequence",
        channel: "email",
        mqls: 210,
        pipeline: 900_000,
        roi: 2.4,
        status: "ACTIVE",
      },
      {
        name: "Retargeting",
        channel: "paid",
        mqls: 60,
        pipeline: 400_000,
        roi: 1.1,
        status: "PAUSED",
      },
      {
        name: "Paid search Q3",
        channel: "paid",
        mqls: 41,
        pipeline: 220_000,
        roi: 0.7,
        status: "UNDERPERFORMING",
      }, // flagged
    ],
  });

  // A real marketing-orchestrator run so the AGENT TRACE block is populated (MKT.2).
  const mktAgent = await db.agent.findFirst({
    where: { moduleKey: "marketing" },
    orderBy: { code: "asc" },
  });
  if (mktAgent) {
    await db.agentRun.create({
      data: {
        agentId: mktAgent.id,
        input: {
          prompt:
            "Watch the demand funnel and reallocate underperforming spend.",
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-7h").toISOString(),
            kind: "funnel",
            text: "1046 MQLs → hand SQLs to Sales",
          },
          {
            ts: d("-7h").toISOString(),
            kind: "attribution",
            text: "events dominant · $8.5M sourced pipeline",
          },
          {
            ts: d("-7h").toISOString(),
            kind: "flag",
            text: "Paid search Q3 roi 0.7 → underperforming",
          },
          {
            ts: d("-7h").toISOString(),
            kind: "reallocate",
            text: "propose shift paid budget → ABM (roi 4.8)",
          },
          {
            ts: d("-7h").toISOString(),
            kind: "handoff",
            text: "SQLs → Sales · reconcile to pipeline (RBAC.4)",
          },
        ],
      },
    });
  }

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
