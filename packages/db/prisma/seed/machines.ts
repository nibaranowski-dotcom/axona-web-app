import type { OrgScopedDb } from "../../src";
import { d } from "./constants";

// 21 machines: 8 FIXED plant + 13 MOBILE units, each with a few signals.

type M = {
  assetId: string;
  name: string;
  kind: KindStr;
  category: string;
  location: string;
  status: StatusStr;
  utilization: number;
  health: string;
  healthLevel: HealthStr;
  telemetryOnline: boolean;
};

type KindStr = "FIXED" | "MOBILE";
type StatusStr = "RUNNING" | "IDLE" | "MAINTENANCE" | "CHARGING" | "FAULT";
type HealthStr = "OK" | "WATCH" | "BAD";

const FIXED: M[] = [
  {
    assetId: "CNC-01",
    name: "CNC mill 1",
    kind: "FIXED",
    category: "CNC",
    location: "Plant A",
    status: "RUNNING",
    utilization: 78,
    health: "Healthy",
    healthLevel: "OK",
    telemetryOnline: true,
  },
  {
    assetId: "CNC-02",
    name: "CNC mill 2",
    kind: "FIXED",
    category: "CNC",
    location: "Plant A",
    status: "RUNNING",
    utilization: 81,
    health: "Healthy",
    healthLevel: "OK",
    telemetryOnline: true,
  },
  {
    assetId: "SMT-01",
    name: "SMT line 1",
    kind: "FIXED",
    category: "SMT",
    location: "Plant A",
    status: "RUNNING",
    utilization: 64,
    health: "Re-cal due in 4d",
    healthLevel: "WATCH",
    telemetryOnline: true,
  },
  {
    assetId: "SMT-02",
    name: "SMT line 2",
    kind: "FIXED",
    category: "SMT",
    location: "Plant B",
    status: "IDLE",
    utilization: 22,
    health: "Healthy",
    healthLevel: "OK",
    telemetryOnline: true,
  },
  {
    assetId: "TEST-01",
    name: "Drive test rig 1",
    kind: "FIXED",
    category: "test-rig",
    location: "Plant A",
    status: "FAULT",
    utilization: 0,
    health: "Torque sensor drift",
    healthLevel: "BAD",
    telemetryOnline: true,
  },
  {
    assetId: "TEST-02",
    name: "Drive test rig 2",
    kind: "FIXED",
    category: "test-rig",
    location: "Plant A",
    status: "RUNNING",
    utilization: 73,
    health: "Healthy",
    healthLevel: "OK",
    telemetryOnline: true,
  },
  {
    assetId: "OVEN-01",
    name: "Reflow oven",
    kind: "FIXED",
    category: "oven",
    location: "Plant A",
    status: "RUNNING",
    utilization: 69,
    health: "Healthy",
    healthLevel: "OK",
    telemetryOnline: true,
  },
  {
    assetId: "PRESS-01",
    name: "Hydraulic press",
    kind: "FIXED",
    category: "press",
    location: "Plant B",
    status: "MAINTENANCE",
    utilization: 0,
    health: "PM in progress",
    healthLevel: "WATCH",
    telemetryOnline: false,
  },
];

const MOBILE: M[] = Array.from({ length: 13 }, (_, i) => {
  const n = i + 1;
  const isAmr = i % 2 === 0;
  return {
    assetId: `${isAmr ? "AMR" : "FLT"}-${String(n).padStart(2, "0")}`,
    name: `${isAmr ? "AMR" : "Forklift"} ${n}`,
    kind: "MOBILE" as const,
    category: isAmr ? "AMR" : "forklift",
    location: i % 3 === 0 ? "Plant A" : "Plant B",
    status: (["RUNNING", "CHARGING", "IDLE"] as StatusStr[])[i % 3] ?? "IDLE",
    utilization: 40 + ((i * 7) % 55),
    health: i === 4 ? "Battery degraded" : "Healthy",
    healthLevel: i === 4 ? ("WATCH" as HealthStr) : ("OK" as HealthStr),
    telemetryOnline: true,
  };
});

export async function seedMachines(
  db: OrgScopedDb,
): Promise<{ total: number; fixed: number }> {
  const all = [...FIXED, ...MOBILE];
  for (const m of all) {
    const machine = await db.machine.create({ data: m });
    await db.machineSignal.createMany({
      data: [3, 2, 1].map((daysAgo) => ({
        machineId: machine.id,
        ts: d(`-${daysAgo}d`),
        metric: "utilization_pct",
        value: m.utilization + ((daysAgo * 3) % 9) - 4,
      })),
    });
  }
  return { total: all.length, fixed: FIXED.length };
}
