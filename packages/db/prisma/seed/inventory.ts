import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// INV.1 — multi-echelon inventory seed (idempotent within a full re-seed). Sets
// the days-of-cover consumption stand-in (Part.dailyUse), adds the remaining
// critical parts the design shows, and lays stock across Central · Line-side ·
// Field edge caches (Rotterdam/Osaka/Detroit) · Finished goods — plus an
// inv-orchestrator AgentRun. Ties to the seeded narrative: SERVO-204 below
// reorder → Procurement's incoming PO; Osaka edge cache near the DLV-3312 fleet.

type PartSpec = {
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  leadDays: number;
  dailyUse: number;
};

// Extra critical parts (SERVO-204/-205 + a battery already exist from value-chain).
const EXTRA_PARTS: PartSpec[] = [
  {
    sku: "LIDAR-88",
    name: "Lidar module",
    onHand: 11,
    reorderPoint: 8,
    leadDays: 20,
    dailyUse: 2,
  },
  {
    sku: "HARN-220",
    name: "Wiring harness",
    onHand: 180,
    reorderPoint: 40,
    leadDays: 12,
    dailyUse: 5,
  },
  {
    sku: "PK-48",
    name: "Service kit · PK-48",
    onHand: 8,
    reorderPoint: 4,
    leadDays: 9,
    dailyUse: 1,
  },
  {
    sku: "LOT-88421",
    name: "SERVO-204 lot · quarantined",
    onHand: 18,
    reorderPoint: 0,
    leadDays: 0,
    dailyUse: 1,
  },
  {
    sku: "AX2-UNIT",
    name: "AX-2 · finished unit",
    onHand: 18,
    reorderPoint: 0,
    leadDays: 0,
    dailyUse: 1,
  },
];

// dailyUse for the parts value-chain already created (consumption stand-in).
const DAILY_USE: Record<string, number> = {
  [CODES.servoOld]: 3, // SERVO-204: 6 on hand → ~2 builds of cover
  [CODES.servoNew]: 2, // SERVO-205: new rev, not yet stocked
  "BATT-AX2": 2,
};

type StockSpec = {
  sku: string;
  location: string;
  kind: "CENTRAL" | "LINE_SIDE" | "EDGE_CACHE" | "FINISHED_GOODS" | "PLANT";
  onHand: number;
  reserved: number;
  minLevel?: number;
  valueUsd: number;
};

const STOCK: StockSpec[] = [
  // Central warehouse — the bulk on-hand + open reservations.
  {
    sku: CODES.servoOld,
    location: "Central warehouse",
    kind: "CENTRAL",
    onHand: 6,
    reserved: 6,
    valueUsd: 24_000,
  },
  {
    sku: "LIDAR-88",
    location: "Central warehouse",
    kind: "CENTRAL",
    onHand: 9,
    reserved: 4,
    valueUsd: 40_000,
  },
  {
    sku: "BATT-AX2",
    location: "Central warehouse",
    kind: "CENTRAL",
    onHand: 22,
    reserved: 8,
    valueUsd: 33_000,
  },
  {
    sku: "HARN-220",
    location: "Central warehouse",
    kind: "CENTRAL",
    onHand: 160,
    reserved: 44,
    valueUsd: 16_000,
  },
  {
    sku: "LOT-88421",
    location: "Central warehouse",
    kind: "CENTRAL",
    onHand: 18,
    reserved: 0,
    valueUsd: 0,
  },
  // Line-side — small build buffers.
  {
    sku: "LIDAR-88",
    location: "Line-side",
    kind: "LINE_SIDE",
    onHand: 2,
    reserved: 0,
    valueUsd: 8_000,
  },
  {
    sku: "HARN-220",
    location: "Line-side",
    kind: "LINE_SIDE",
    onHand: 20,
    reserved: 0,
    valueUsd: 2_000,
  },
  {
    sku: "BATT-AX2",
    location: "Line-side",
    kind: "LINE_SIDE",
    onHand: 4,
    reserved: 0,
    valueUsd: 6_000,
  },
  // Field edge caches — spares near the deployed fleet (SN-2196 world).
  {
    sku: "PK-48",
    location: "Rotterdam",
    kind: "EDGE_CACHE",
    onHand: 2,
    reserved: 0,
    minLevel: 2,
    valueUsd: 260_000,
  },
  {
    sku: "LIDAR-88",
    location: "Rotterdam",
    kind: "EDGE_CACHE",
    onHand: 3,
    reserved: 0,
    minLevel: 2,
    valueUsd: 120_000,
  },
  // Osaka — below min on 3 SKUs (ties to the DLV-3312 fleet growth).
  {
    sku: "PK-48",
    location: "Osaka",
    kind: "EDGE_CACHE",
    onHand: 1,
    reserved: 0,
    minLevel: 3,
    valueUsd: 130_000,
  },
  {
    sku: "LIDAR-88",
    location: "Osaka",
    kind: "EDGE_CACHE",
    onHand: 1,
    reserved: 0,
    minLevel: 3,
    valueUsd: 40_000,
  },
  {
    sku: "BATT-AX2",
    location: "Osaka",
    kind: "EDGE_CACHE",
    onHand: 2,
    reserved: 0,
    minLevel: 4,
    valueUsd: 30_000,
  },
  // Detroit — co-located with central, stocked.
  {
    sku: "PK-48",
    location: "Detroit",
    kind: "EDGE_CACHE",
    onHand: 4,
    reserved: 0,
    minLevel: 2,
    valueUsd: 520_000,
  },
  {
    sku: "HARN-220",
    location: "Detroit",
    kind: "EDGE_CACHE",
    onHand: 30,
    reserved: 0,
    minLevel: 10,
    valueUsd: 380_000,
  },
  // Finished goods — units pre-delivery.
  {
    sku: "AX2-UNIT",
    location: "Finished goods",
    kind: "FINISHED_GOODS",
    onHand: 18,
    reserved: 6,
    valueUsd: 2_100_000,
  },
];

export async function seedInventory(
  db: OrgScopedDb,
): Promise<{ stock: number; parts: number }> {
  // 1. days-of-cover stand-in on the existing parts.
  for (const [sku, dailyUse] of Object.entries(DAILY_USE)) {
    await db.part.updateMany({ where: { sku }, data: { dailyUse } });
  }
  // 2. the extra critical parts (idempotent within a full re-seed).
  for (const p of EXTRA_PARTS) {
    await db.part.create({ data: p });
  }
  // 3. resolve part ids by sku, then lay the multi-echelon stock.
  const parts = await db.part.findMany({ select: { id: true, sku: true } });
  const idBySku = new Map(parts.map((p) => [p.sku, p.id]));
  let stock = 0;
  for (const s of STOCK) {
    const partId = idBySku.get(s.sku);
    if (!partId) continue;
    await db.inventoryStock.create({
      data: {
        partId,
        location: s.location,
        kind: s.kind,
        onHand: s.onHand,
        reserved: s.reserved,
        minLevel: s.minLevel ?? 0,
        valueUsd: s.valueUsd,
      },
    });
    stock++;
  }

  // 4. an inv-orchestrator run so the INV.2 agent pane has real context.
  const invAgent = await db.agent.findFirst({
    where: { moduleKey: "inventory" },
    orderBy: { code: "asc" },
  });
  if (invAgent) {
    await db.agentRun.create({
      data: {
        agentId: invAgent.id,
        input: {
          prompt: "Scan stock cover and edge-cache levels; flag exposure.",
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-2h").toISOString(),
            kind: "scan",
            text: "6 critical SKUs · 4 echelons · 3 edge caches",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "flag",
            text: `${CODES.servoOld} cover ~2 builds · below reorder → Procurement`,
          },
          {
            ts: d("-2h").toISOString(),
            kind: "flag",
            text: "edge cache Osaka below min on 3 SKUs (DLV-3312 fleet)",
          },
          {
            ts: d("-2h").toISOString(),
            kind: "propose",
            text: "draft transfer Detroit → Osaka · human approves (RBAC.4)",
          },
        ],
      },
    });
  }

  return { stock, parts: EXTRA_PARTS.length };
}
