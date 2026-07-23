import type { OrgScopedDb } from "../../src";
import { freezeConfigSnapshot } from "../../src";
import { CODES } from "./constants";

// PLM.1a (spine) + PLM.2–5 (screen richness) — seed the Unit spine, the as-designed
// BOM, as-built capture and time-resolved config as ONE coherent thread that
// EXTENDS (never forks) the ONT.1 narrative:
//
//   Unit SN-2208 (HX-2, built then deployed)
//     └─ as-built A-14: SERVO-204 rev B, lot 88421  ← SUBSTITUTION vs designed rev C
//     └─ as-built B-07: HARN-220 rev B (ECO-314 rev bump) · C-03: alt-vendor cells
//     └─ config: HW rev B + firmware v4.1.0 → v4.2.1 → CFG-HX2-r4.2 (baselined)
//     └─ ECO-318: supersede SERVO-204 → SERVO-205, effectivity from SN-2210
//          └─ affected units via the ONT.1 graph → field service
//
// Seed richness = mock richness (CLAUDE.md): every unit carries a resolvable
// config + software state and a full as-built set, so /units renders as populated
// as `Unit Registry.dc.html` and its model · config · sw · lot · site · status
// filters all return real, non-empty sets.
//
// Non-breaking: WorkOrderMfg (build) + Robot (deploy) keep working; Unit links
// them by scalar id and is backfilled from every existing serial, taking its
// site/customer FROM the Robot (one truth with Fleet). Anonymized customers/sites
// only (SEED.1). TestRun/FieldEvent/RCA are PLM.1b.

const DAY = 24 * 60 * 60 * 1000;

/** The lot whose quarantine drives the whole demo thread (NCR-118 → ECO-318). */
const SUSPECT_LOT = "88421";

/**
 * The units that consumed the suspect lot. HX2-0208/HX2-0214 are the serials the
 * ONT.1 graph already links to the lot; SN-2208/09/10 are the PLM thread's units.
 * Seeding as-built lot records for BOTH sets is what makes the graph traversal
 * and the as-built capture query agree on "who has lot 88421" (PLM.5).
 */
const LOT_COHORT = [
  "SN-2208",
  "SN-2209",
  "SN-2210",
  "HX2-0208",
  "HX2-0214",
] as const;

interface BomSpec {
  position: string;
  part: string;
  rev: string;
  /** Lot-traced classes carry a lot code as-built; the rest legitimately do not. */
  lotTraced?: boolean;
}

// The as-designed BOM per model. Positions + part vocabulary follow
// `As-Built Diff.dc.html` (A-14/A-15/B-07/B-08/B-19/C-03/C-04/D-01) so the diff
// screen renders against real rows of the shape its design specifies.
const BOM_HX2: BomSpec[] = [
  { position: "A-14", part: "SERVO-204", rev: "C", lotTraced: true },
  { position: "A-15", part: "SERVO-204", rev: "C", lotTraced: true },
  { position: "B-07", part: "HARN-220", rev: "A", lotTraced: true },
  { position: "B-08", part: "SENS-12", rev: "2" },
  { position: "B-19", part: "SENS-12", rev: "2" },
  { position: "C-03", part: "BATT-48V", rev: "2", lotTraced: true },
  { position: "C-04", part: "BMS-9", rev: "4" },
  { position: "D-01", part: "CHASSIS-2", rev: "B" },
  { position: "D-06", part: "CTRL-100", rev: "A" },
  { position: "E-02", part: "GRIP-300", rev: "A" },
];
const BOM_HX1: BomSpec[] = [
  { position: "A-14", part: "SERVO-204", rev: "C", lotTraced: true },
  { position: "B-07", part: "HARN-220", rev: "A", lotTraced: true },
  { position: "B-08", part: "SENS-12", rev: "2" },
  { position: "C-03", part: "BATT-48V", rev: "2", lotTraced: true },
  { position: "D-01", part: "CHASSIS-2", rev: "B" },
  { position: "D-06", part: "CTRL-100", rev: "A" },
];

/** Deterministic per-serial pseudo-variation (no Math.random — reproducible seed). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function seedPlm(db: OrgScopedDb): Promise<{
  units: number;
  substitutions: number;
}> {
  const now = new Date();
  const build = new Date(now.getTime() - 90 * DAY); // demo unit built 90d ago
  const upgrade = new Date(now.getTime() - 30 * DAY); // firmware v4.1.0 → v4.2.1
  const baselinedAt = new Date(now.getTime() - 34 * DAY);
  const revBFrom = new Date(now.getTime() - 400 * DAY);
  const revCFrom = new Date(now.getTime() - 120 * DAY);

  // ── 1. Design side — the product models ───────────────────────────────────
  // HX-2 + HX-1 are the models the rest of the seed already builds and deploys
  // (WorkOrderMfg.product / Robot.model), so the Unit spine reuses them rather
  // than inventing a parallel catalogue.
  const hx2 = await db.productModel.create({
    data: { code: "HX-2", name: "HX-2 humanoid", designRevision: "C" },
  });
  const hx1 = await db.productModel.create({
    data: { code: "HX-1", name: "HX-1 humanoid", designRevision: "D" },
  });

  // ── 2. Part masters + revisions ───────────────────────────────────────────
  const mkPart = async (
    partNumber: string,
    description: string,
    category: string,
    lifecycleStatus: string,
  ) =>
    db.partMaster.create({
      data: {
        partNumber,
        description,
        category,
        lifecycleStatus,
        approvedVendorIds: [],
      },
    });

  // SERVO-204: rev B (older, superseded by rev C) — the substitution's actual part.
  const servo = await mkPart(
    CODES.servoOld, // SERVO-204
    "Harmonic-drive actuator",
    "actuator",
    "ncr_hold",
  );
  const servoRevB = await db.partRevision.create({
    data: {
      partMasterId: servo.id,
      rev: "B",
      effectiveFrom: revBFrom,
      effectiveTo: revCFrom,
    },
  });
  const servoRevC = await db.partRevision.create({
    data: { partMasterId: servo.id, rev: "C", effectiveFrom: revCFrom },
  });

  // SERVO-205 — the superseding drive introduced by ECO-318.
  const servoNew = await mkPart(
    CODES.servoNew, // SERVO-205
    "Harmonic-drive actuator (torque-comp)",
    "actuator",
    "active",
  );
  await db.partRevision.create({
    data: {
      partMasterId: servoNew.id,
      rev: "A",
      effectiveFrom: revCFrom,
      originatingEcoId: CODES.eco,
    },
  });

  // HARN-220 carries two revisions — rev B is the ECO-314 connector-keying fix
  // that lands mid-build (the "built NEWER than the BOM baseline" substitution).
  const harn = await mkPart(
    "HARN-220",
    "Main wiring harness",
    "harness",
    "active",
  );
  const harnRevA = await db.partRevision.create({
    data: {
      partMasterId: harn.id,
      rev: "A",
      effectiveFrom: revBFrom,
      effectiveTo: revCFrom,
    },
  });
  const harnRevB = await db.partRevision.create({
    data: {
      partMasterId: harn.id,
      rev: "B",
      effectiveFrom: revCFrom,
      originatingEcoId: "ECO-314",
    },
  });

  const simpleParts: [string, string, string, string][] = [
    ["SENS-12", "Vision sensor", "sensor", "2"],
    ["BATT-48V", "48V battery pack", "power", "2"],
    ["BMS-9", "Battery management board", "electronics", "4"],
    ["CHASSIS-2", "Chassis frame", "structure", "B"],
    ["CTRL-100", "Motion controller", "electronics", "A"],
    ["GRIP-300", "Adaptive gripper", "end-effector", "A"],
  ];
  // partNumber:rev → PartRevision id (the BOM + as-built both resolve through this)
  const revByKey = new Map<string, string>([
    [`${CODES.servoOld}:B`, servoRevB.id],
    [`${CODES.servoOld}:C`, servoRevC.id],
    ["HARN-220:A", harnRevA.id],
    ["HARN-220:B", harnRevB.id],
  ]);
  for (const [partNumber, description, category, rev] of simpleParts) {
    const pm = await mkPart(partNumber, description, category, "active");
    const pr = await db.partRevision.create({
      data: { partMasterId: pm.id, rev, effectiveFrom: revBFrom },
    });
    revByKey.set(`${partNumber}:${rev}`, pr.id);
  }
  const revId = (part: string, rev: string): string => {
    const id = revByKey.get(`${part}:${rev}`);
    if (!id) throw new Error(`PLM seed: no PartRevision ${part} rev ${rev}`);
    return id;
  };

  // ── 3. As-designed BOM per model ──────────────────────────────────────────
  const bomFor = (code: string) => (code === "HX-1" ? BOM_HX1 : BOM_HX2);
  for (const [model, bom] of [
    [hx2, BOM_HX2],
    [hx1, BOM_HX1],
  ] as const) {
    await db.bomLine.createMany({
      data: bom.map((b) => ({
        orgId: db.$org,
        productModelId: model.id,
        designRevision: model.designRevision,
        position: b.position,
        partRevisionId: revId(b.part, b.rev),
        qty: 1,
      })),
    });
  }

  // ── 4. Software releases + configuration versions ─────────────────────────
  // The firmware versions are the SAME strings Fleet already carries on Robot
  // (v4.0.2 … v4.2.1) — the Unit spine resolves them rather than storing a second,
  // divergent truth (PLM.V4 later makes Fleet read through here).
  const FW = ["v4.0.2", "v4.1.0", "v4.2.0", "v4.2.1"] as const;
  const swByVersion = new Map<string, string>();
  for (const version of FW) {
    const r = await db.softwareRelease.create({
      data: {
        component: "firmware",
        version,
        notes: version === "v4.2.1" ? "torque compensation" : null,
      },
    });
    swByVersion.set(version, r.id);
  }

  // Named configurations = (hw rev, firmware) pairs. CFG-HX2-r4.2 is the locked
  // baseline the demo unit resolves to today.
  const configs: {
    name: string;
    model: string;
    hwRev: string;
    fw: string;
    baseline: boolean;
  }[] = [
    {
      name: "CFG-HX2-r4.0",
      model: "HX-2",
      hwRev: "B",
      fw: "v4.0.2",
      baseline: false,
    },
    {
      name: "CFG-HX2-r4.1",
      model: "HX-2",
      hwRev: "B",
      fw: "v4.1.0",
      baseline: false,
    },
    {
      name: "CFG-HX2-r4.1b",
      model: "HX-2",
      hwRev: "B",
      fw: "v4.2.0",
      baseline: false,
    },
    {
      name: "CFG-HX2-r4.2",
      model: "HX-2",
      hwRev: "B",
      fw: "v4.2.1",
      baseline: true,
    },
    {
      name: "CFG-HX1-r4.9",
      model: "HX-1",
      hwRev: "A",
      fw: "v4.1.0",
      baseline: false,
    },
    {
      name: "CFG-HX1-r5.0",
      model: "HX-1",
      hwRev: "A",
      fw: "v4.2.1",
      baseline: true,
    },
  ];
  for (const c of configs) {
    await db.configurationVersion.create({
      data: {
        name: c.name,
        productModelId: c.model === "HX-1" ? hx1.id : hx2.id,
        hwSpec: { rev: c.hwRev },
        swSpec: { firmware: c.fw },
        isBaseline: c.baseline,
        lockedAt: c.baseline ? baselinedAt : null,
      },
    });
  }

  // ── 5. Build records + the Unit spine ─────────────────────────────────────
  // The three demo serials get build records so the whole thread (build → deploy)
  // exists for them; every other serial already has one or the other.
  const demoSerials = ["SN-2208", "SN-2209", "SN-2210"];
  for (const serial of demoSerials) {
    const existing = await db.workOrderMfg.findFirst({ where: { serial } });
    if (!existing)
      await db.workOrderMfg.create({
        data: {
          serial,
          product: "HX-2",
          station: "Final QA",
          status: "DONE",
          startedAt: build,
        },
      });
  }

  // Backfill Unit from EVERY existing serial (WorkOrderMfg build + Robot deploy),
  // deduped by serial — the non-breaking retrofit giving each physical unit one
  // identity. Site/customer come FROM the Robot (not a hardcoded default), so the
  // registry's site/customer filters mean the same thing Fleet means.
  const workOrders = await db.workOrderMfg.findMany();
  const robots = await db.robot.findMany();
  const woBySerial = new Map(workOrders.map((w) => [w.serial, w]));
  const robotBySerial = new Map(robots.map((r) => [r.serial, r]));
  const allSerials = [
    ...new Set([...woBySerial.keys(), ...robotBySerial.keys()]),
  ].sort();

  const unitBySerial = new Map<
    string,
    { id: string; modelCode: string; buildDate: Date }
  >();
  for (const serial of allSerials) {
    const robot = robotBySerial.get(serial) ?? null;
    const wo = woBySerial.get(serial) ?? null;
    // The model is whatever the build/deploy record already says this unit is.
    const modelCode = robot?.model ?? wo?.product ?? "HX-2";
    const model = modelCode === "HX-1" ? hx1 : hx2;
    // Status: deployed once a Robot exists; otherwise it is still on the line.
    const status = robot
      ? "deployed"
      : wo?.status?.toUpperCase() === "DONE"
        ? "in_test"
        : "in_build";
    // Stagger build dates so "last event" ordering in the registry is real.
    const buildDate =
      wo?.startedAt ?? new Date(build.getTime() - (hash(serial) % 120) * DAY);
    // A deployed unit's site/customer is its Robot's (one truth with Fleet). A unit
    // still on the line sits at a PLANT and has no customer yet — that difference is
    // exactly what the registry spans and Fleet does not.
    const siteLabel = robot?.site ?? `Plant-${(hash(serial) % 2) + 1}`;
    const u = await db.unit.create({
      data: {
        serial,
        productModelId: model.id,
        buildDate,
        status,
        siteLabel,
        customerLabel: robot?.customer ?? null,
        workOrderMfgId: wo?.id ?? null,
        robotId: robot?.id ?? null,
      },
    });
    unitBySerial.set(serial, {
      id: u.id,
      modelCode: model.code,
      buildDate,
    });
  }

  // ── 6. As-built capture ───────────────────────────────────────────────────
  // Every unit is captured against its model's BOM (as-built is CAPTURED, never
  // reconstructed — the invariant). Most positions match design; the divergences
  // are the demo thread. Substitutions are the NORMAL case, flagged not errored.
  let substitutions = 0;
  for (const [serial, unit] of unitBySerial) {
    const bom = bomFor(unit.modelCode);
    const h = hash(serial);
    const inLotCohort = (LOT_COHORT as readonly string[]).includes(serial);
    const installedAt = unit.buildDate;

    const records = bom.map((b, i) => {
      // A-14 on the lot cohort: SERVO-204 rev B out of the quarantined lot 88421
      // where rev C was designed — the substitution the whole narrative hangs on.
      if (b.position === "A-14" && inLotCohort) {
        return {
          orgId: db.$org,
          unitId: unit.id,
          bomPosition: b.position,
          partRevisionId: revId(CODES.servoOld, "B"),
          lotCode: SUSPECT_LOT,
          installedAt,
          isSubstitution: true,
          note: "Same part number, but from a lot later quarantined by Quality (NCR-118 — torque out of spec).",
        };
      }
      // SN-2208 additionally carries the two other divergence SHAPES a real
      // as-built diff has: a mid-build rev bump, and an approved alternate.
      if (serial === "SN-2208" && b.position === "B-07") {
        return {
          orgId: db.$org,
          unitId: unit.id,
          bomPosition: b.position,
          partRevisionId: revId("HARN-220", "B"),
          lotCode: "5567",
          installedAt,
          isSubstitution: true,
          note: "Superseded to rev B mid-build under ECO-314 (connector keying fix). Newer than the BOM baseline.",
        };
      }
      if (serial === "SN-2208" && b.position === "C-03") {
        return {
          orgId: db.$org,
          unitId: unit.id,
          bomPosition: b.position,
          partRevisionId: revId(b.part, b.rev),
          lotCode: "7741",
          installedAt,
          isSubstitution: true,
          note: "Approved alternate — primary vendor was short at build time. Same revision, second-source cell.",
        };
      }
      // Everything else matches as-designed.
      return {
        orgId: db.$org,
        unitId: unit.id,
        bomPosition: b.position,
        partRevisionId: revId(b.part, b.rev),
        lotCode: b.lotTraced ? String(70000 + ((h + i * 977) % 25000)) : null,
        installedAt,
        isSubstitution: false,
        note: null,
      };
    });
    await db.asBuiltRecord.createMany({ data: records });
    substitutions += records.filter((r) => r.isSubstitution).length;
  }

  // ── 7. Software state (the time series config-at-time resolves over) ──────
  // SN-2208 is the unit with a REAL upgrade history: v4.1.0 from build until 30d
  // ago, v4.2.1 since. That is what makes resolveConfigAt(past) ≠ resolveConfigAt
  // (now) — an event dated before the upgrade must render the pre-upgrade config.
  const sn2208 = unitBySerial.get("SN-2208");
  if (sn2208) {
    await db.unitSoftwareState.createMany({
      data: [
        {
          orgId: db.$org,
          unitId: sn2208.id,
          softwareReleaseId: swByVersion.get("v4.1.0")!,
          effectiveFrom: sn2208.buildDate,
          effectiveTo: upgrade,
        },
        {
          orgId: db.$org,
          unitId: sn2208.id,
          softwareReleaseId: swByVersion.get("v4.2.1")!,
          effectiveFrom: upgrade,
        },
      ],
    });
  }
  // Every other unit gets the firmware its Robot reports (deployed) or a build-line
  // default — so EVERY registry row resolves a real sw + config version.
  for (const [serial, unit] of unitBySerial) {
    if (serial === "SN-2208") continue;
    const robot = robotBySerial.get(serial);
    const version =
      robot?.firmware && swByVersion.has(robot.firmware)
        ? robot.firmware
        : FW[hash(serial) % FW.length]!;
    await db.unitSoftwareState.create({
      data: {
        orgId: db.$org,
        unitId: unit.id,
        softwareReleaseId: swByVersion.get(version)!,
        effectiveFrom: unit.buildDate,
      },
    });
  }

  // ── 8. ECO-318 effectivity + the affected-units graph edges ───────────────
  const eco = await db.eCO.findFirst({ where: { code: CODES.eco } });
  if (eco) {
    await db.eCO.update({
      where: { id: eco.id },
      data: {
        effectiveFromSerial: "SN-2210",
        effectiveFromDate: revCFrom,
        rolloutStatus: "in_progress",
      },
    });
  }
  const lot = await db.part.findFirst({ where: { sku: "LOT-88421" } });

  // EntityLinks extending the ONT.1 thread. UNIT nodes are the Unit SPINE (PLM.2 —
  // the ontology resolver reads db.unit), so toId is the Unit id.
  const links: {
    fromType: "ECO" | "LOT" | "NCR";
    fromId: string;
    toSerial: string;
    note: string;
  }[] = [];

  // NCR-118 is raised against SN-2208 — the ONE demo thread the PRD states
  // (SN-2208 → SERVO-204 lot 88421 → NCR-118 → ECO-318). ONT.1 also links the NCR
  // to HX2-0208; both are real units that consumed the lot, so both edges stand.
  const ncr = await db.nCR.findFirst({ where: { code: CODES.ncr } });
  if (ncr)
    links.push({
      fromType: "NCR",
      fromId: ncr.id,
      toSerial: "SN-2208",
      note: "torque out of spec on the drive from lot 88421",
    });
  if (eco)
    for (const serial of demoSerials)
      links.push({
        fromType: "ECO",
        fromId: eco.id,
        toSerial: serial,
        note: "unit carries the superseded drive",
      });
  if (lot)
    for (const serial of LOT_COHORT)
      links.push({
        fromType: "LOT",
        fromId: lot.id,
        toSerial: serial,
        note: "consumed lot 88421",
      });

  for (const l of links) {
    const unit = unitBySerial.get(l.toSerial);
    if (!unit) continue;
    // The ONT.1 seed already wires LOT→HX2-0208/HX2-0214; don't double-edge them.
    const existing = await db.entityLink.findFirst({
      where: {
        fromType: l.fromType,
        fromId: l.fromId,
        toType: "UNIT",
        toId: unit.id,
      },
    });
    if (existing) continue;
    await db.entityLink.create({
      data: {
        fromType: l.fromType,
        fromId: l.fromId,
        relation: "AFFECTS",
        toType: "UNIT",
        toId: unit.id,
        note: l.note,
      },
    });
  }

  // ── 9. PLM.1b — test traceability · RCA · field event · change request ────
  // Extend (never fork) the SN-2208 thread with the deferred tier. Every frozen
  // snapshot is materialized HERE, at the event's own time, so it captures the
  // config-at-then — TR-8802 pre-upgrade (v4.1.0), TR-8841 post-upgrade (v4.2.1).
  if (sn2208) {
    const tr8802At = new Date(upgrade.getTime() - 5 * DAY); // pre-upgrade → v4.1.0
    const tr8841At = new Date(now.getTime() - 2 * DAY); // post-upgrade → v4.2.1

    // Prior PASS on the pre-upgrade build — the comparison the test explorer shows.
    const pass = await db.testRun.create({
      data: {
        code: CODES.testPass,
        unitId: sn2208.id,
        procedure: "Payload endurance · SBX-B",
        operatorId: null,
        startedAt: tr8802At,
        outcome: "pass",
        configSnapshot: await freezeConfigSnapshot(db, sn2208.id, tr8802At),
        environment: { tempC: 22, humidityPct: 45, rig: "SBX-B" },
      },
    });
    await db.testResult.createMany({
      data: [
        {
          orgId: db.$org,
          testRunId: pass.id,
          step: "Left drive torque",
          measurement: 4.1,
          unitOfMeasure: "N·m",
          lowerLimit: 3.5,
          upperLimit: 4.6,
          passed: true,
        },
        {
          orgId: db.$org,
          testRunId: pass.id,
          step: "Cycle time",
          measurement: 2.9,
          unitOfMeasure: "s",
          lowerLimit: null,
          upperLimit: 3.2,
          passed: true,
        },
      ],
    });

    // The FAIL on the post-upgrade build — drive torque over UCL (the NCR-118 cause).
    const fail = await db.testRun.create({
      data: {
        code: CODES.testFail,
        unitId: sn2208.id,
        procedure: "Payload endurance · SBX-B",
        operatorId: null,
        startedAt: tr8841At,
        outcome: "fail",
        configSnapshot: await freezeConfigSnapshot(db, sn2208.id, tr8841At),
        environment: { tempC: 24, humidityPct: 44, rig: "SBX-B" },
      },
    });
    await db.testResult.createMany({
      data: [
        {
          orgId: db.$org,
          testRunId: fail.id,
          step: "Left drive torque",
          measurement: 4.8, // over the 4.6 UCL — the failure
          unitOfMeasure: "N·m",
          lowerLimit: 3.5,
          upperLimit: 4.6,
          passed: false,
        },
        {
          orgId: db.$org,
          testRunId: fail.id,
          step: "Cycle time",
          measurement: 3.0,
          unitOfMeasure: "s",
          lowerLimit: null,
          upperLimit: 3.2,
          passed: true,
        },
      ],
    });

    // RCA on NCR-118 → component (the quarantined lot 88421 drive), linked to the
    // unit + the failing test run, with the config-at-failure frozen in.
    if (ncr) {
      await db.nCR.update({
        where: { id: ncr.id },
        data: {
          rootCause: "component",
          unitId: sn2208.id,
          testRunId: fail.id,
          configSnapshot: await freezeConfigSnapshot(db, sn2208.id, tr8841At),
        },
      });
    }

    // A field modification: gripper swap at Site-3 — recorded + approved. Config
    // drifts in the field; the snapshot freezes the config as it was at the swap.
    const fieldAt = new Date(now.getTime() - 6 * DAY);
    const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
    await db.fieldEvent.create({
      data: {
        unitId: sn2208.id,
        kind: "field_modification",
        summary:
          "Gripper swap at Site-3 (GRIP-300 rev A → rev B) — recorded + approved",
        occurredAt: fieldAt,
        configSnapshot: await freezeConfigSnapshot(db, sn2208.id, fieldAt),
        approvedById: admin?.id ?? null,
      },
    });

    // The ECR that originated ECO-318 (the upstream "why"), linked to the ECO.
    if (eco) {
      await db.changeRequest.create({
        data: {
          code: CODES.changeReq,
          title: "Supersede SERVO-204 after lot 88421 torque failures",
          rationale:
            "NCR-118 (drive torque over UCL) traced to lot 88421 (quarantined). Supersede SERVO-204 → SERVO-205.",
          state: "released",
          ecoId: eco.id,
        },
      });
      await db.eCO.update({
        where: { id: eco.id },
        data: { changeRequestId: CODES.changeReq },
      });
    }
  }

  // ── 10. PLM.6 — test-explorer richness (mock richness = seed richness) ─────
  // A handful more runs across procedures + units so /tests renders grouped +
  // populated like `Test Explorer.dc.html`. TR-8841/TR-8802 stay the hero pair;
  // these are the surrounding fleet-scale context. Each frozen at its own time.
  const RICH: {
    code: string;
    serial: string;
    procedure: string;
    outcome: "pass" | "fail";
    torque: number; // the key measurement (N·m)
    daysAgo: number;
  }[] = [
    {
      code: "TR-8720",
      serial: "SN-2196",
      procedure: "Actuator torque test",
      outcome: "pass",
      torque: 4.0,
      daysAgo: 40,
    },
    {
      code: "TR-8402",
      serial: "SN-2188",
      procedure: "Actuator torque test",
      outcome: "fail",
      torque: 4.7,
      daysAgo: 12,
    },
    {
      code: "TR-8390",
      serial: "SN-2184",
      procedure: "Actuator torque test",
      outcome: "pass",
      torque: 4.2,
      daysAgo: 20,
    },
    {
      code: "TR-8615",
      serial: "SN-2210",
      procedure: "Payload load test",
      outcome: "pass",
      torque: 24.0,
      daysAgo: 9,
    },
    {
      code: "TR-8541",
      serial: "SN-2196",
      procedure: "Payload load test",
      outcome: "fail",
      torque: 26.1,
      daysAgo: 4,
    },
    {
      code: "TR-8712",
      serial: "SN-2209",
      procedure: "Acceptance · full",
      outcome: "pass",
      torque: 142,
      daysAgo: 15,
    },
  ];
  for (const r of RICH) {
    const u = unitBySerial.get(r.serial);
    if (!u) continue;
    const at = new Date(now.getTime() - r.daysAgo * DAY);
    const isTorque = r.procedure === "Actuator torque test";
    const upper = isTorque ? 4.6 : 25.0;
    const tr = await db.testRun.create({
      data: {
        code: r.code,
        unitId: u.id,
        procedure: `${r.procedure} · SBX-B`,
        startedAt: at,
        outcome: r.outcome,
        configSnapshot: await freezeConfigSnapshot(db, u.id, at),
        environment: { tempC: 22, humidityPct: 45, rig: "SBX-B" },
      },
    });
    await db.testResult.create({
      data: {
        orgId: db.$org,
        testRunId: tr.id,
        step: isTorque ? "Left drive torque" : "Payload hold",
        measurement: r.torque,
        unitOfMeasure: isTorque ? "N·m" : "kg",
        lowerLimit: isTorque ? 3.5 : null,
        upperLimit: upper,
        passed: r.outcome === "pass",
      },
    });
  }

  return { units: unitBySerial.size, substitutions };
}
