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
  // 14-day window: eight stable days on p-12, then the p-13 canary regression
  // on Site-3 (rate drops, takeovers climb) → INC-201.
  const points = [
    { rate: 98.8, to: 1.2, pol: "p-12" },
    { rate: 99.0, to: 1.0, pol: "p-12" },
    { rate: 98.7, to: 1.3, pol: "p-12" },
    { rate: 98.9, to: 1.1, pol: "p-12" },
    { rate: 98.6, to: 1.4, pol: "p-12" },
    { rate: 98.8, to: 1.2, pol: "p-12" },
    { rate: 98.7, to: 1.3, pol: "p-12" },
    { rate: 98.9, to: 1.1, pol: "p-12" },
    { rate: 97.4, to: 2.6, pol: CODES.policy },
    { rate: 97.0, to: 2.9, pol: CODES.policy },
    { rate: 96.9, to: 3.1, pol: CODES.policy },
    { rate: 96.7, to: 3.3, pol: CODES.policy },
    { rate: 96.5, to: 3.5, pol: CODES.policy },
    { rate: 96.3, to: 3.6, pol: CODES.policy },
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
  // Technicians first (WorkOrderField.techId references Technician). Each carries
  // a cert matrix across 5 cert types — hx2Service · hx1Service · hvBattery ·
  // safetyLoto · commissioning — with a VALID / EXPIRING / TRAINING / (missing)
  // mix (PPL.2). M. Osei's hvBattery is EXPIRING (12d) — the Field Service
  // dispatch gate. A missing key = "not held". (TRAINING certs sit far out so the
  // 30d expiring-window doesn't flag them.)
  const cert = (state: string, when: string) => ({
    state,
    expiresAt: d(when).toISOString(),
  });
  const osei = await db.technician.create({
    data: {
      name: "M. Osei",
      initials: "MO",
      site: "Site-3",
      status: "ON_JOB",
      certs: {
        hx2Service: cert("VALID", "+9m"),
        hx1Service: cert("VALID", "+9m"),
        hvBattery: cert("EXPIRING", "+12d"), // the dispatch gate
        safetyLoto: cert("VALID", "+7m"),
        commissioning: cert("VALID", "+10m"),
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
        hx2Service: cert("VALID", "+8m"),
        hx1Service: cert("TRAINING", "+6m"),
        hvBattery: cert("VALID", "+8m"),
        safetyLoto: cert("VALID", "+11m"),
      },
    },
  });
  // The rest of the field-service crew (FIELD.2 dispatch board).
  await db.technician.createMany({
    data: [
      {
        name: "A. Brandt",
        initials: "AB",
        site: "Site-3",
        status: "ON_SITE",
        certs: {
          hx2Service: cert("VALID", "+10m"),
          hx1Service: cert("VALID", "+10m"),
          hvBattery: cert("VALID", "+10m"),
          safetyLoto: cert("VALID", "+9m"),
          commissioning: cert("TRAINING", "+6m"),
        },
      },
      {
        name: "J. Rivera",
        initials: "JR",
        site: "Site-2",
        status: "ON_SITE",
        certs: {
          hx2Service: cert("VALID", "+6m"),
          hx1Service: cert("VALID", "+6m"),
          safetyLoto: cert("VALID", "+7m"),
          commissioning: cert("VALID", "+12m"),
        },
      },
      {
        name: "K. Tanaka",
        initials: "KT",
        site: "Site-1",
        status: "AVAILABLE",
        certs: {
          hx2Service: cert("VALID", "+14m"),
          hx1Service: cert("VALID", "+14m"),
          hvBattery: cert("VALID", "+14m"),
          safetyLoto: cert("VALID", "+12m"),
        },
      },
      {
        name: "L. Sato",
        initials: "LS",
        site: "Site-2",
        status: "SCHEDULED",
        certs: {
          hx2Service: cert("TRAINING", "+6m"),
          hx1Service: cert("VALID", "+9m"),
          hvBattery: cert("EXPIRING", "+21d"),
          safetyLoto: cert("VALID", "+8m"),
        },
      },
    ],
  });

  // Fleet — deployed units across 3 sites (Detroit / Rotterdam / Osaka). SN-2196
  // (Tier-1 Auto OEM, Site-3 Osaka) is WATCH for a thermal anomaly → hands to Field Service.
  // Site coords: Site-1 Detroit, Site-2 Rotterdam, Site-3 Osaka.
  const DET = { lat: 42.331, lng: -83.046 };
  const ROT = { lat: 51.924, lng: 4.478 };
  const OSA = { lat: 34.694, lng: 135.502 };
  const sn2196 = await db.robot.create({
    data: {
      serial: CODES.robot, // SN-2196
      model: CODES.product,
      customer: "Tier-1 Auto OEM",
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
        customer: "Tier-1 Auto OEM",
        site: "Site-2",
        uptimePct: 99.4,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...ROT,
      },
      {
        serial: "SN-2188",
        model: CODES.product,
        customer: "Tier-1 Auto OEM",
        site: "Site-3",
        uptimePct: 99.2,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...OSA,
      },
      {
        serial: "SN-2184",
        model: "HX-1",
        customer: "OEM-2",
        site: "Site-1",
        uptimePct: 99.7,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...DET,
      },
      {
        serial: "SN-2150",
        model: CODES.product,
        customer: "Tier-1 Auto OEM",
        site: "Site-3",
        uptimePct: 97.1,
        firmware: "v4.0.2",
        status: "WATCH",
        ...OSA,
      },
      {
        serial: "SN-2133",
        model: "HX-1",
        customer: "OEM-2",
        site: "Site-1",
        uptimePct: 85.3,
        firmware: "v4.2.1",
        status: "OFFLINE",
        ...DET,
      },
      {
        serial: "SN-2120",
        model: "HX-1",
        customer: "OEM-2",
        site: "Site-2",
        uptimePct: 91.0,
        firmware: "v4.1.0",
        status: "FAULT",
        ...ROT,
      },
      {
        serial: "SN-2101",
        model: CODES.product,
        customer: "Tier-1 Auto OEM",
        site: "Site-2",
        uptimePct: 99.0,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...ROT,
      },
      {
        serial: "SN-2050",
        model: CODES.product,
        customer: "OEM-2",
        site: "Site-1",
        uptimePct: 99.6,
        firmware: "v4.2.0",
        status: "ACTIVE",
        ...DET,
      },
      {
        serial: "SN-2072",
        model: CODES.product,
        customer: "Tier-1 Auto OEM",
        site: "Site-2",
        uptimePct: 98.9,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...ROT,
      },
      {
        serial: "SN-2044",
        model: "HX-1",
        customer: "OEM-2",
        site: "Site-1",
        uptimePct: 99.3,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...DET,
      },
      {
        serial: "SN-2039",
        model: CODES.product,
        customer: "Tier-1 Auto OEM",
        site: "Site-3",
        uptimePct: 98.1,
        firmware: "v4.2.0",
        status: "ACTIVE",
        ...OSA,
      },
      {
        serial: "SN-2027",
        model: "HX-1",
        customer: "OEM-4",
        site: "Site-2",
        uptimePct: 97.6,
        firmware: "v4.1.0",
        status: "WATCH",
        ...ROT,
      },
      {
        serial: "SN-2015",
        model: CODES.product,
        customer: "OEM-2",
        site: "Site-1",
        uptimePct: 99.5,
        firmware: "v4.2.1",
        status: "ACTIVE",
        ...DET,
      },
      {
        serial: "SN-2003",
        model: "HX-1",
        customer: "OEM-4",
        site: "Site-3",
        uptimePct: 96.8,
        firmware: "v4.0.2",
        status: "WATCH",
        ...OSA,
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
      ...series(idOf("SN-2072")!, "battery_pct", [82, 83, 82, 84, 83]),
      ...series(idOf("SN-2044")!, "battery_pct", [70, 71, 70, 72, 71]),
      ...series(idOf("SN-2039")!, "battery_pct", [88, 89, 88, 90, 89]),
      ...series(idOf("SN-2027")!, "battery_pct", [55, 52, 50, 48, 46]),
      ...series(idOf("SN-2015")!, "battery_pct", [93, 94, 93, 95, 94]),
      ...series(idOf("SN-2003")!, "battery_pct", [60, 58, 57, 55, 54]),
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
            text: "telemetry · 15 units · signals/min",
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

  // Field service — the SN-2196 battery swap (routed to Osei, whose HV/battery
  // cert is expiring → dispatch gate) plus the surrounding work-order queue and
  // dispatch board (FIELD.2). SLA clocks run live off slaDueAt.
  const crew = await db.technician.findMany({
    select: { id: true, name: true },
  });
  const tid = (name: string) => crew.find((t) => t.name === name)?.id ?? null;
  await db.workOrderField.createMany({
    data: [
      {
        code: "WO-5521",
        robotSerial: CODES.robot, // SN-2196
        site: "Site-3",
        issue: "Thermal anomaly — battery swap",
        slaDueAt: d("+2h"),
        techId: osei.id,
        status: "DISPATCH",
        severity: "MAJOR",
      },
      {
        code: "WO-5518",
        robotSerial: "SN-2150",
        site: "Site-3",
        issue: "Actuator recalibration",
        slaDueAt: d("+5h"),
        techId: tid("A. Brandt"),
        status: "ON_SITE",
        severity: "MAJOR",
      },
      {
        code: "WO-5515",
        robotSerial: "SN-2184",
        site: "Site-1",
        issue: "Skin panel gap > 1.2 mm",
        slaDueAt: d("+28h"),
        techId: null,
        status: "OPEN",
        severity: "MINOR",
      },
      {
        code: "WO-5510",
        robotSerial: "Fleet PM",
        site: "Site-1",
        issue: "Quarterly preventive maintenance",
        slaDueAt: null,
        techId: tid("K. Tanaka"),
        status: "SCHEDULED",
        severity: "MINOR",
      },
      {
        code: "WO-5508",
        robotSerial: "SN-2120",
        site: "Site-2",
        issue: "Fault triage — motor controller",
        slaDueAt: d("+1h"),
        techId: tid("J. Rivera"),
        status: "EN_ROUTE",
        severity: "CRITICAL",
      },
      {
        code: "WO-5505",
        robotSerial: "SN-2208",
        site: "Site-2",
        issue: "Firmware reflash v4.2.1",
        slaDueAt: d("-1d"),
        techId: tid("J. Rivera"),
        status: "CLOSED",
        severity: "MINOR",
      },
      {
        code: "WO-5502",
        robotSerial: "SN-2101",
        site: "Site-2",
        issue: "Sensor calibration",
        slaDueAt: d("+2d"),
        techId: null,
        status: "OPEN",
        severity: "MINOR",
      },
    ],
  });

  // A real fs-orchestrator run so the AGENT TRACE block is populated (FIELD.2).
  const fsAgent = await db.agent.findFirst({
    where: { moduleKey: "field-service" },
    orderBy: { code: "asc" },
  });
  if (fsAgent) {
    await db.agentRun.create({
      data: {
        agentId: fsAgent.id,
        input: {
          prompt: `Dispatch the ${CODES.robot} battery swap within SLA.`,
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-30m").toISOString(),
            kind: "intake",
            text: `WO-5521 · ${CODES.robot} thermal fault (from Fleet)`,
          },
          {
            ts: d("-30m").toISOString(),
            kind: "triage",
            text: "critical · SLA 2h",
          },
          {
            ts: d("-30m").toISOString(),
            kind: "parts",
            text: "reserve PK-48 · edge cache",
          },
          {
            ts: d("-30m").toISOString(),
            kind: "dispatch",
            text: "route M. Osei · ETA 48m · battery-cert",
          },
          {
            ts: d("-30m").toISOString(),
            kind: "knowledge",
            text: "push swap procedure → tablet",
          },
        ],
      },
    });
  }

  // Engineering — the NCR-118 → ECO-318 change thread, plus the surrounding ECO
  // board, firmware ladder, and HW↔firmware compat matrix (Engineering.dc.html).
  // PLM.12 — each ECO carries a change CLASS (SUPERSEDE/REVISE/DEVIATION), a source,
  // agent-drafted provenance, and a reviewer roster (per-reviewer approval state).
  const ecoSpecs: {
    code: string;
    title: string;
    changeType: string;
    changeClass: string;
    affected: string;
    stage: string;
    source: string | null;
    agent?: { conf: number };
    effectiveFromSerial?: string;
    /** [initials-role, pending?] — role ∈ admin|engineer|ops. */
    reviewers: { role: "admin" | "engineer" | "ops"; pending: boolean }[];
  }[] = [
    {
      code: CODES.eco, // ECO-318
      title: `Supersede ${CODES.servoOld} → -205 (tighter tolerance)`,
      changeType: "HW",
      changeClass: "SUPERSEDE",
      affected: `${CODES.lot} · 3 units · ${CODES.ncr} · Tier-1 Auto OEM order`,
      stage: "REVIEW",
      source: `From ${CODES.ncr}`,
      agent: { conf: 0.86 },
      reviewers: [
        { role: "admin", pending: true },
        { role: "engineer", pending: false },
      ],
    },
    {
      code: "ECO-321",
      title: "Deviation · accept lot 88422 at ±3.1%",
      changeType: "HW",
      changeClass: "DEVIATION",
      affected: "6 units · lot-scoped",
      stage: "REVIEW",
      source: "From lot review",
      agent: { conf: 0.74 },
      reviewers: [
        { role: "admin", pending: true },
        { role: "ops", pending: false },
      ],
    },
    {
      code: "ECO-316",
      title: "Firmware v4.2.2 — actuator torque compensation",
      changeType: "FW",
      changeClass: "REVISE",
      affected: "fleet-wide",
      stage: "REVIEW",
      source: "Fleet-wide",
      reviewers: [
        { role: "admin", pending: true },
        { role: "engineer", pending: false },
      ],
    },
    {
      code: "ECO-319",
      title: "Revise calibration profile cal-2026.06",
      changeType: "SW",
      changeClass: "REVISE",
      affected: "44 units",
      stage: "REVIEW",
      source: "Design study",
      effectiveFromSerial: "SN-2242",
      reviewers: [
        { role: "engineer", pending: false },
        { role: "ops", pending: true },
      ],
    },
    {
      code: "ECO-314",
      title: "Harness connector keying (mis-mate fix)",
      changeType: "HW",
      changeClass: "REVISE",
      affected: "in production",
      stage: "APPROVED",
      source: "From NCR-114",
      effectiveFromSerial: "SN-2190",
      reviewers: [{ role: "ops", pending: false }],
    },
    {
      code: "ECO-310",
      title: "Battery pack thermal shim (cell-4 hotspot)",
      changeType: "HW",
      changeClass: "REVISE",
      affected: `HX-2 · ${CODES.robot} thermal watch`,
      stage: "APPROVED",
      source: "From field service",
      reviewers: [{ role: "ops", pending: false }],
    },
    {
      code: "ECO-322",
      title: "Chassis weight reduction −1.2 kg",
      changeType: "HW",
      changeClass: "REVISE",
      affected: "next build",
      stage: "DRAFT",
      source: "Design study",
      reviewers: [],
    },
    {
      code: "ECO-320",
      title: "Deviation · single-source LIDAR-88 rev C",
      changeType: "HW",
      changeClass: "DEVIATION",
      affected: "3 units · lot-scoped",
      stage: "DRAFT",
      source: null,
      reviewers: [],
    },
    {
      code: "ECO-305",
      title: "Autonomy stack update — obstacle re-plan latency",
      changeType: "SW",
      changeClass: "REVISE",
      affected: "fleet-wide · Site-3 canary",
      stage: "RELEASED",
      source: "Fleet-wide",
      reviewers: [
        { role: "ops", pending: false },
        { role: "engineer", pending: false },
      ],
    },
    {
      code: "ECO-311",
      title: "Lidar module revision bump rev C → D",
      changeType: "HW",
      changeClass: "REVISE",
      affected: "96 units",
      stage: "RELEASED",
      source: "From design study",
      effectiveFromSerial: "SN-2172",
      reviewers: [{ role: "ops", pending: false }],
    },
  ];

  // Resolve reviewer users once (admin/engineer/ops) for the roster below.
  const reviewerUsers = {
    admin: await db.user.findFirst({ where: { role: "ADMIN" } }),
    engineer: await db.user.findFirst({ where: { role: "ENGINEER" } }),
    ops: await db.user.findFirst({ where: { role: "OPS" } }),
  };
  const initials = (name: string | null | undefined) =>
    (name ?? "??")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  for (const spec of ecoSpecs) {
    const eco = await db.eCO.create({
      data: {
        code: spec.code,
        title: spec.title,
        changeType: spec.changeType,
        changeClass: spec.changeClass,
        affected: spec.affected,
        stage: spec.stage,
        source: spec.source,
        effectiveFromSerial: spec.effectiveFromSerial ?? null,
        draftedByAgentId: spec.agent ? "agent:engineering" : null,
        confidence: spec.agent?.conf ?? null,
      },
    });
    for (const r of spec.reviewers) {
      const u = reviewerUsers[r.role];
      if (!u) continue;
      await db.ecoReviewer.create({
        data: {
          ecoId: eco.id,
          userId: u.id,
          label: initials(u.name),
          state: r.pending ? "pending" : "approved",
        },
      });
    }
  }

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
            text: `3 units · ${CODES.lot} · 2 BOMs · Tier-1 Auto OEM order`,
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

  // Autonomy — the p-13 canary regressing on Site-3 → INC-201; policy versions
  // + the safety-incident log + per-site autonomy series (AUTO.2).
  await db.policyVersion.createMany({
    data: [
      {
        version: "p-12",
        note: "Current · 90% of fleet · stable",
        state: "current",
      },
      {
        version: CODES.policy,
        note: "Canary · 10% (Site-3) · +interventions",
        state: "canary",
      }, // p-13
      { version: "p-11", note: "Previous · rollback ready", state: "standby" },
    ],
  });

  // Per-site autonomy series: Site-1 / Site-2 stable, Site-3 regresses on p-13.
  const stableSeries = (site: string, base: number, to: number) =>
    [0, 1, 2, 3, 4, 5].map((i) => ({
      site,
      ts: d(`-${6 - i}d`),
      autonomyRate: base + (i % 2 === 0 ? 0.1 : -0.1),
      takeoversPer1k: to + (i % 2 === 0 ? -0.1 : 0.1),
      policyVersion: "p-12",
    }));
  await db.autonomyMetric.createMany({
    data: [
      ...autonomySeries(), // Site-3 p-13 regression
      ...stableSeries("Site-1", 99.1, 0.9),
      ...stableSeries("Site-2", 98.7, 1.3),
    ],
  });

  await db.safetyIncident.createMany({
    data: [
      {
        code: "INC-204",
        type: "Safe-stop · thermal guard",
        robotSerial: CODES.robot,
        site: "Site-2",
        severity: "CRITICAL",
        status: "CONTAINED",
      },
      {
        code: CODES.incident,
        type: "Proximity near-miss",
        robotSerial: CODES.robot,
        site: "Site-3",
        severity: "MAJOR",
        status: "REVIEW",
      }, // INC-201
      {
        code: "INC-198",
        type: "Safety-zone violation",
        robotSerial: "SN-2133",
        site: "Site-1",
        severity: "MINOR",
        status: "CLOSED",
      },
      {
        code: "INC-195",
        type: "Unexpected stop",
        robotSerial: "SN-2184",
        site: "Site-1",
        severity: "MINOR",
        status: "CLOSED",
      },
    ],
  });

  // A real auto-orchestrator run so the AGENT TRACE block is populated (AUTO.2).
  const autoAgent = await db.agent.findFirst({
    where: { moduleKey: "autonomy" },
    orderBy: { code: "asc" },
  });
  if (autoAgent) {
    await db.agentRun.create({
      data: {
        agentId: autoAgent.id,
        input: {
          prompt: `Investigate the Site-3 takeover regression on ${CODES.policy}.`,
        },
        status: "SUCCEEDED",
        trace: [
          {
            ts: d("-45m").toISOString(),
            kind: "monitor",
            text: "12,480 tasks · 98.6% autonomous",
          },
          {
            ts: d("-45m").toISOString(),
            kind: "intervention",
            text: "Site-3 takeovers up → regression",
          },
          {
            ts: d("-45m").toISOString(),
            kind: "correlate",
            text: `${CODES.policy} canary cohort`,
          },
          {
            ts: d("-45m").toISOString(),
            kind: "safety",
            text: `${CODES.incident} proximity near-miss · review`,
          },
          {
            ts: d("-45m").toISOString(),
            kind: "recommend",
            text: "rollback Site-3 → p-12",
          },
        ],
      },
    });
  }
}
