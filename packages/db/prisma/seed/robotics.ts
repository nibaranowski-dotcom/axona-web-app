import type { OrgScopedDb } from "../../src";
import { CODES, d } from "./constants";

// Robotics slice of the §3.7 narrative: SN-2196 (thermal) → battery-swap field
// WO → Tech M. Osei (HV/battery cert expiring 12d); ECO-318 from NCR-118 +
// firmware v4.2.2 + compat matrix; Site-3 p-13 canary regression → INC-201.

function autonomySeries(): {
  site: string;
  ts: Date;
  autonomyRate: number;
  takeoversPer1k: number;
  policyVersion: string;
}[] {
  // autonomy regresses after the p-13 canary on Site-3
  const points = [
    { rate: 98.9, to: 1.1, pol: "p-12" },
    { rate: 98.7, to: 1.3, pol: "p-12" },
    { rate: 98.8, to: 1.2, pol: "p-12" },
    { rate: 97.4, to: 2.6, pol: CODES.policy },
    { rate: 96.9, to: 3.1, pol: CODES.policy },
    { rate: 96.5, to: 3.5, pol: CODES.policy },
  ];
  return points.map((p, i) => ({
    site: "Site-3",
    ts: d(`-${(points.length - i) * 1}d`),
    autonomyRate: p.rate,
    takeoversPer1k: p.to,
    policyVersion: p.pol,
  }));
}

export async function seedRobotics(db: OrgScopedDb): Promise<void> {
  // Technicians first (WorkOrderField.techId references Technician)
  const osei = await db.technician.create({
    data: {
      name: "M. Osei",
      initials: "MO",
      site: "Site-3",
      status: "ON_JOB",
      certs: {
        hvBattery: { state: "EXPIRING", expiresAt: d("+12d").toISOString() },
      },
    },
  });
  await db.technician.create({
    data: {
      name: "R. Caldwell",
      initials: "RC",
      site: "Site-1",
      status: "AVAILABLE",
      certs: {
        hvBattery: { state: "VALID", expiresAt: d("+8m").toISOString() },
      },
    },
  });

  // Fleet robots — SN-2196 (BMW, Site-3) flagged WATCH for thermal anomaly
  const sn2196 = await db.robot.create({
    data: {
      serial: CODES.robot,
      model: CODES.product,
      customer: "BMW",
      site: "Site-3",
      uptimePct: 96.4,
      firmware: "v4.2.1",
      status: "WATCH",
      lat: 34.6937,
      lng: 135.5023,
    },
  });
  await db.robot.create({
    data: {
      serial: "SN-2188",
      model: CODES.product,
      customer: "BMW",
      site: "Site-3",
      uptimePct: 99.2,
      firmware: "v4.2.1",
      status: "ACTIVE",
      lat: 34.69,
      lng: 135.5,
    },
  });
  await db.robot.create({
    data: {
      serial: "SN-2050",
      model: CODES.product,
      customer: "Kawasaki",
      site: "Site-1",
      uptimePct: 99.6,
      firmware: "v4.2.0",
      status: "ACTIVE",
      lat: 34.6,
      lng: 135.2,
    },
  });

  // Telemetry — a thermal climb on SN-2196
  await db.telemetryPoint.createMany({
    data: [3, 2, 1, 0].map((daysAgo, i) => ({
      robotId: sn2196.id,
      ts: d(`-${daysAgo}d`),
      metric: "battery_temp_c",
      value: 38 + i * 4,
    })),
  });

  // Field service — battery swap on SN-2196, SLA clock running, routed to Osei
  await db.workOrderField.create({
    data: {
      code: "WO-5521",
      robotSerial: CODES.robot,
      site: "Site-3",
      issue: "Thermal anomaly — battery swap",
      slaDueAt: d("+6h"),
      techId: osei.id,
      status: "DISPATCH",
      severity: "MAJOR",
    },
  });

  // Engineering — ECO-318 from NCR-118 supersedes -204 with -205; firmware torque-comp
  await db.eCO.create({
    data: {
      code: CODES.eco,
      title: `Supersede ${CODES.servoOld} → ${CODES.servoNew} (torque-comp)`,
      changeType: "SUPERSEDE",
      affected: `${CODES.servoOld}; ${CODES.ncr}; BMW order; ${CODES.product}`,
      stage: "REVIEW",
    },
  });
  await db.firmwareRelease.create({
    data: {
      version: CODES.firmware,
      note: "Torque-comp; awaiting HX-1 cert before Fleet OTA",
      state: "RC",
    },
  });
  await db.firmwareRelease.create({
    data: {
      version: "v4.2.1",
      note: "Current fleet firmware",
      state: "RELEASED",
    },
  });
  await db.compatCell.createMany({
    data: [
      { hwRev: "HX-1", fwVersion: CODES.firmware, state: "in-test" },
      { hwRev: "HX-2", fwVersion: CODES.firmware, state: "cert" },
      { hwRev: "HX-1", fwVersion: "v4.2.1", state: "compatible" },
      { hwRev: "HX-2", fwVersion: "v4.2.1", state: "compatible" },
    ],
  });

  // Autonomy — Site-3 p-13 canary regression → INC-201; policy versions
  await db.policyVersion.create({
    data: { version: "p-12", note: "Stable baseline", state: "current" },
  });
  await db.policyVersion.create({
    data: { version: CODES.policy, note: "Canary on Site-3", state: "canary" },
  });
  await db.policyVersion.create({
    data: { version: "p-11", note: "Prior baseline", state: "standby" },
  });
  await db.autonomyMetric.createMany({ data: autonomySeries() });
  await db.safetyIncident.create({
    data: {
      code: CODES.incident,
      type: "near-miss",
      robotSerial: CODES.robot,
      site: "Site-3",
      severity: "MAJOR",
      status: "REVIEW",
    },
  });
}
