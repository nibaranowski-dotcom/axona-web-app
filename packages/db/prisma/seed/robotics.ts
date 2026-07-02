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

  // Fleet — deployed units across 3 sites (Detroit / Rotterdam / Osaka). SN-2196
  // (BMW, Site-3 Osaka) is WATCH for a thermal anomaly → hands to Field Service.
  // Site coords: Site-1 Detroit, Site-2 Rotterdam, Site-3 Osaka.
  const DET = { lat: 42.331, lng: -83.046 };
  const ROT = { lat: 51.924, lng: 4.478 };
  const OSA = { lat: 34.694, lng: 135.502 };
  const sn2196 = await db.robot.create({
    data: {
      serial: CODES.robot, // SN-2196
      model: CODES.product,
      customer: "BMW",
      site: "Site-3",
      uptimePct: 96.4,
      firmware: "v4.2.1",
      status: "WATCH",
      ...OSA,
    },
  });
  await db.robot.createMany({
    data: [
      {
        serial: "SN-2208",
        model: CODES.product,
        customer: "BMW",
        site: "Site-2",
        uptimePct: 99.4,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...ROT,
      },
      {
        serial: "SN-2188",
        model: CODES.product,
        customer: "BMW",
        site: "Site-3",
        uptimePct: 99.2,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...OSA,
      },
      {
        serial: "SN-2184",
        model: "HX-1",
        customer: "Kawasaki",
        site: "Site-1",
        uptimePct: 99.7,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...DET,
      },
      {
        serial: "SN-2150",
        model: CODES.product,
        customer: "BMW",
        site: "Site-3",
        uptimePct: 97.1,
        firmware: "v4.0.2",
        status: "WATCH",
        ...OSA,
      },
      {
        serial: "SN-2133",
        model: "HX-1",
        customer: "Kawasaki",
        site: "Site-1",
        uptimePct: 85.3,
        firmware: "v4.2.1",
        status: "OFFLINE",
        ...DET,
      },
      {
        serial: "SN-2120",
        model: "HX-1",
        customer: "Kawasaki",
        site: "Site-2",
        uptimePct: 91.0,
        firmware: "v4.1.0",
        status: "FAULT",
        ...ROT,
      },
      {
        serial: "SN-2101",
        model: CODES.product,
        customer: "BMW",
        site: "Site-2",
        uptimePct: 99.0,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...ROT,
      },
      {
        serial: "SN-2050",
        model: CODES.product,
        customer: "Kawasaki",
        site: "Site-1",
        uptimePct: 99.6,
        firmware: "v4.2.0",
        status: "ACTIVE",
        ...DET,
      },
    ],
  });

  // Telemetry — a per-unit recent series for the sparklines; SN-2196 carries the
  // thermal climb (its predictive-alert signal). n points over the last n days.
  const fleet = await db.robot.findMany({ select: { id: true, serial: true } });
  const idOf = (sn: string) => fleet.find((r) => r.serial === sn)?.id;
  const series = (id: string, metric: string, vals: number[]) =>
    vals.map((value, i) => ({
      robotId: id,
      ts: d(`-${vals.length - 1 - i}d`),
      metric,
      value,
    }));
  await db.telemetryPoint.createMany({
    data: [
      ...series(sn2196.id, "battery_temp_c", [38, 42, 46, 50]),
      ...series(idOf("SN-2150")!, "battery_pct", [66, 63, 60, 58, 56]),
      ...series(idOf("SN-2120")!, "battery_pct", [30, 22, 14, 8, 4]),
      ...series(idOf("SN-2208")!, "battery_pct", [80, 82, 81, 83, 82]),
      ...series(idOf("SN-2188")!, "battery_pct", [90, 91, 90, 92, 91]),
      ...series(idOf("SN-2184")!, "battery_pct", [66, 67, 66, 68, 67]),
      ...series(idOf("SN-2101")!, "battery_pct", [77, 78, 77, 79, 78]),
      ...series(idOf("SN-2050")!, "battery_pct", [95, 96, 95, 96, 95]),
      ...series(idOf("SN-2133")!, "battery_pct", [4, 3, 2, 1, 0]),
    ],
  });

  // A real flt-orchestrator run so the AGENT TRACE block is populated (FLEET.2).
  const fltAgent = await db.agent.findFirst({
    where: { moduleKey: "fleet" },
    orderBy: { code: "asc" },
  });
  if (fltAgent) {
    await db.agentRun.create({
      data: {
        agentId: fltAgent.id,
        input: { prompt: `Watch ${CODES.robot} thermal and protect site SLA.` },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-1h").toISOString(),
            kind: "ingest",
            text: "telemetry · 9 units · signals/min",
          },
          {
            ts: d("-1h").toISOString(),
            kind: "predict",
            text: `${CODES.robot} cell-4 ΔV → degradation (36h to limit)`,
          },
          {
            ts: d("-1h").toISOString(),
            kind: "confidence",
            text: "predict failure · 0.91",
          },
          {
            ts: d("-1h").toISOString(),
            kind: "recovery",
            text: `safe-stop ${CODES.robot} · thermal guard`,
          },
          {
            ts: d("-1h").toISOString(),
            kind: "dispatch",
            text: "tech → Site-3 · ETA 3h · spare cached",
          },
        ],
      },
    });
  }

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

  // Engineering — the NCR-118 → ECO-318 change thread, plus the surrounding ECO
  // board, firmware ladder, and HW↔firmware compat matrix (Engineering.dc.html).
  await db.eCO.create({
    data: {
      code: CODES.eco, // ECO-318
      title: `Supersede ${CODES.servoOld} → -205 (tighter tolerance)`,
      changeType: "HW",
      affected: `${CODES.lot} · 3 units · ${CODES.ncr} · BMW order`,
      stage: "REVIEW",
    },
  });
  await db.eCO.create({
    data: {
      code: "ECO-316",
      title: "Firmware v4.2.2 — actuator torque compensation",
      changeType: "FW",
      affected: "fleet-wide",
      stage: "REVIEW",
    },
  });
  await db.eCO.create({
    data: {
      code: "ECO-314",
      title: "Harness connector keying (mis-mate fix)",
      changeType: "HW",
      affected: "in production",
      stage: "APPROVED",
    },
  });

  await db.firmwareRelease.create({
    data: {
      version: CODES.firmware, // v4.2.2-rc
      note: "Torque compensation · in test",
      state: "RC",
    },
  });
  await db.firmwareRelease.create({
    data: {
      version: "v4.2.1",
      note: "Current · 44 of 48 units",
      state: "RELEASED",
    },
  });
  await db.firmwareRelease.create({
    data: { version: "v4.1.0", note: "Maintenance only", state: "MAINT" },
  });

  // Compat matrix — HW revs × firmware; pairs not listed render as n/a (ENG.2).
  await db.compatCell.createMany({
    data: [
      { hwRev: "HX-2 r4", fwVersion: "v4.0.2", state: "compatible" },
      { hwRev: "HX-2 r4", fwVersion: "v4.1.0", state: "compatible" },
      { hwRev: "HX-2 r4", fwVersion: "v4.2.1", state: "cert" },
      { hwRev: "HX-2 r4", fwVersion: "v4.2.2", state: "in-test" },
      { hwRev: "HX-2 r3", fwVersion: "v4.0.2", state: "compatible" },
      { hwRev: "HX-2 r3", fwVersion: "v4.1.0", state: "cert" },
      { hwRev: "HX-2 r3", fwVersion: "v4.2.1", state: "cert" },
      { hwRev: "HX-2 r3", fwVersion: "v4.2.2", state: "in-test" },
      { hwRev: "HX-1 r5", fwVersion: "v4.0.2", state: "compatible" },
      { hwRev: "HX-1 r5", fwVersion: "v4.1.0", state: "compatible" },
      { hwRev: "HX-1 r5", fwVersion: "v4.2.1", state: "cert" },
      { hwRev: "HX-1 r5", fwVersion: "v4.2.2", state: "in-test" },
      { hwRev: "HX-1 r4", fwVersion: "v4.0.2", state: "cert" },
      { hwRev: "HX-1 r4", fwVersion: "v4.1.0", state: "compatible" },
    ],
  });

  // A real eng-orchestrator run so the AGENT TRACE block is populated (ENG.2).
  const engAgent = await db.agent.findFirst({
    where: { moduleKey: "engineering" },
    orderBy: { code: "asc" },
  });
  if (engAgent) {
    await db.agentRun.create({
      data: {
        agentId: engAgent.id,
        input: { prompt: `Assess ${CODES.ncr} and drive the change order.` },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-3h").toISOString(),
            kind: "ingest",
            text: `${CODES.ncr} (Quality) · ${CODES.servoOld} torque`,
          },
          {
            ts: d("-3h").toISOString(),
            kind: "draft",
            text: `${CODES.eco} supersede -204 → -205`,
          },
          {
            ts: d("-3h").toISOString(),
            kind: "impact",
            text: `3 units · ${CODES.lot} · 2 BOMs · BMW order`,
          },
          {
            ts: d("-3h").toISOString(),
            kind: "firmware",
            text: "ECO-316 v4.2.2 torque-comp · RC",
          },
          {
            ts: d("-3h").toISOString(),
            kind: "compat",
            text: "certify HX-2 r4,r3 · HX-1 in test",
          },
        ],
      },
    });
  }

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
