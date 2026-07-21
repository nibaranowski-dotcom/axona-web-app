import type { OrgScopedDb } from "../../src";
import { CODES } from "./constants";

// PLM.1a — seed the Unit spine + as-designed BOM + as-built + time-resolved config
// as ONE coherent thread that EXTENDS (never forks) the ONT.1 narrative:
//
//   Unit SN-2208 (built HX-line, deployed as SN-2208)
//     └─ as-built: SERVO-204 rev B, lot 88421  ← SUBSTITUTION vs as-designed rev C
//     └─ config: HW rev B + firmware v4.1 → v4.2  → ConfigurationVersion SBX-B-4.2 (baselined)
//     └─ ECO-318: supersede SERVO-204 → SERVO-205, effectivity from SN-2210
//          └─ affected units (SN-2208/2209/2210) via the ONT.1 graph → field service
//
// Non-breaking: WorkOrderMfg (build) + Robot (deploy) keep working; Unit links
// them by scalar id and is backfilled from every existing serial. Anonymized
// customers/sites only (SEED.1). TestRun/FieldEvent/RCA are PLM.1b.

const DAY = 24 * 60 * 60 * 1000;

export async function seedPlm(db: OrgScopedDb): Promise<{
  units: number;
  substitutions: number;
}> {
  const now = new Date();
  const build = new Date(now.getTime() - 90 * DAY); // unit built 90d ago
  const upgrade = new Date(now.getTime() - 30 * DAY); // firmware v4.1 → v4.2 at 30d
  const revBFrom = new Date(now.getTime() - 400 * DAY);
  const revCFrom = new Date(now.getTime() - 120 * DAY);

  // ── 1. Design side — one product model + its BOM ──────────────────────────
  const model = await db.productModel.create({
    data: { code: "SBX-1", name: "SBX picking cell", designRevision: "C" },
  });

  // Part masters + revisions. SERVO-204 has rev B (older) and rev C (as-designed);
  // SERVO-205 is the superseding drive (ECO-318). Two more parts give the BOM depth.
  const servo = await db.partMaster.create({
    data: {
      partNumber: CODES.servoOld, // SERVO-204
      description: "Harmonic-drive actuator",
      category: "actuator",
      lifecycleStatus: "ncr_hold",
      approvedVendorIds: [],
    },
  });
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
  const servoNew = await db.partMaster.create({
    data: {
      partNumber: CODES.servoNew, // SERVO-205
      description: "Harmonic-drive actuator (torque-comp)",
      category: "actuator",
      lifecycleStatus: "active",
      approvedVendorIds: [],
    },
  });
  await db.partRevision.create({
    data: {
      partMasterId: servoNew.id,
      rev: "A",
      effectiveFrom: revCFrom,
      originatingEcoId: CODES.eco,
    },
  });
  const ctrl = await db.partMaster.create({
    data: {
      partNumber: "CTRL-100",
      description: "Motion controller",
      category: "electronics",
      lifecycleStatus: "active",
      approvedVendorIds: [],
    },
  });
  const ctrlRevA = await db.partRevision.create({
    data: { partMasterId: ctrl.id, rev: "A", effectiveFrom: revBFrom },
  });
  const grip = await db.partMaster.create({
    data: {
      partNumber: "GRIP-300",
      description: "Adaptive gripper",
      category: "end-effector",
      lifecycleStatus: "active",
      approvedVendorIds: [],
    },
  });
  const gripRevA = await db.partRevision.create({
    data: { partMasterId: grip.id, rev: "A", effectiveFrom: revBFrom },
  });

  // As-designed BOM for SBX-1 rev C: the drive is designed as SERVO-204 rev C.
  await db.bomLine.createMany({
    data: [
      {
        orgId: db.$org,
        productModelId: model.id,
        designRevision: "C",
        position: "DRIVE",
        partRevisionId: servoRevC.id,
        qty: 1,
      },
      {
        orgId: db.$org,
        productModelId: model.id,
        designRevision: "C",
        position: "CONTROLLER",
        partRevisionId: ctrlRevA.id,
        qty: 1,
      },
      {
        orgId: db.$org,
        productModelId: model.id,
        designRevision: "C",
        position: "GRIPPER",
        partRevisionId: gripRevA.id,
        qty: 1,
      },
    ],
  });

  // ── 2. Software releases + configuration versions ─────────────────────────
  const fw41 = await db.softwareRelease.create({
    data: { component: "firmware", version: "v4.1" },
  });
  const fw42 = await db.softwareRelease.create({
    data: { component: "firmware", version: "v4.2", notes: "torque-comp" },
  });
  await db.configurationVersion.create({
    data: {
      name: "SBX-B-4.1",
      productModelId: model.id,
      hwSpec: { rev: "B" },
      swSpec: { firmware: "v4.1" },
      isBaseline: false,
    },
  });
  await db.configurationVersion.create({
    data: {
      name: "SBX-B-4.2",
      productModelId: model.id,
      hwSpec: { rev: "B" },
      swSpec: { firmware: "v4.2" },
      isBaseline: true,
    },
  });

  // ── 3. Build records + Unit spine ─────────────────────────────────────────
  // Create build (WorkOrderMfg) records for the three demo serials so the ONT.1
  // UNIT resolver (which resolves UNIT nodes via WorkOrderMfg.serial) reaches them.
  const demoSerials = ["SN-2208", "SN-2209", "SN-2210"];
  const buildBySerial = new Map<string, string>();
  for (const serial of demoSerials) {
    const wo = await db.workOrderMfg.create({
      data: {
        serial,
        product: "SBX picking cell",
        station: "Final QA",
        status: "DONE",
        startedAt: build,
      },
    });
    buildBySerial.set(serial, wo.id);
  }

  // Backfill Unit from EVERY existing serial (WorkOrderMfg build + Robot deploy),
  // deduped by serial — this is the non-breaking retrofit that gives each physical
  // unit one identity. The demo serials link BOTH records; SN-2208 also links the
  // deployed Robot SN-2208.
  const workOrders = await db.workOrderMfg.findMany();
  const robots = await db.robot.findMany();
  const woBySerial = new Map(workOrders.map((w) => [w.serial, w.id]));
  const robotBySerial = new Map(robots.map((r) => [r.serial, r.id]));
  const allSerials = [
    ...new Set([...woBySerial.keys(), ...robotBySerial.keys()]),
  ];

  const unitBySerial = new Map<string, string>();
  for (const serial of allSerials) {
    const robotId = robotBySerial.get(serial) ?? null;
    const status = robotId ? "active" : "in_test";
    const u = await db.unit.create({
      data: {
        serial,
        productModelId: model.id,
        buildDate: build,
        status,
        siteLabel: robotId ? "Site-3" : null,
        customerLabel: robotId ? "OEM-2" : null,
        workOrderMfgId: woBySerial.get(serial) ?? null,
        robotId,
      },
    });
    unitBySerial.set(serial, u.id);
  }

  // ── 4. As-built capture (the substitution) ────────────────────────────────
  // SN-2208/2209/2210 shipped with SERVO-204 rev B from lot 88421 where rev C was
  // designed → a flagged substitution. Controller + gripper match design.
  let substitutions = 0;
  for (const serial of demoSerials) {
    const unitId = unitBySerial.get(serial)!;
    await db.asBuiltRecord.createMany({
      data: [
        {
          orgId: db.$org,
          unitId,
          bomPosition: "DRIVE",
          partRevisionId: servoRevB.id,
          lotCode: "88421",
          installedAt: build,
          isSubstitution: true,
          note: "lot 88421 substituted rev B for rev C",
        },
        {
          orgId: db.$org,
          unitId,
          bomPosition: "CONTROLLER",
          partRevisionId: ctrlRevA.id,
          installedAt: build,
          isSubstitution: false,
        },
        {
          orgId: db.$org,
          unitId,
          bomPosition: "GRIPPER",
          partRevisionId: gripRevA.id,
          installedAt: build,
          isSubstitution: false,
        },
      ],
    });
    substitutions++;
  }

  // ── 5. Software state — SN-2208 upgraded v4.1 → v4.2 (config-at-time works) ──
  const sn2208 = unitBySerial.get("SN-2208")!;
  await db.unitSoftwareState.createMany({
    data: [
      {
        orgId: db.$org,
        unitId: sn2208,
        softwareReleaseId: fw41.id,
        effectiveFrom: build,
        effectiveTo: upgrade,
      },
      {
        orgId: db.$org,
        unitId: sn2208,
        softwareReleaseId: fw42.id,
        effectiveFrom: upgrade,
      },
    ],
  });
  for (const serial of ["SN-2209", "SN-2210"]) {
    await db.unitSoftwareState.create({
      data: {
        orgId: db.$org,
        unitId: unitBySerial.get(serial)!,
        softwareReleaseId: fw42.id,
        effectiveFrom: build,
      },
    });
  }

  // ── 6. ECO-318 effectivity + the affected-units graph edges ───────────────
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

  // EntityLinks (extend the ONT.1 thread). UNIT nodes resolve via WorkOrderMfg.serial
  // in getBlastRadius, so the toId is the build (WorkOrderMfg) id.
  const links: {
    fromType: "ECO" | "LOT";
    fromId: string;
    toSerial: string;
    note: string;
  }[] = [];
  if (eco)
    for (const serial of demoSerials)
      links.push({
        fromType: "ECO",
        fromId: eco.id,
        toSerial: serial,
        note: "unit carries the superseded drive",
      });
  if (lot)
    for (const serial of ["SN-2208", "SN-2209"])
      links.push({
        fromType: "LOT",
        fromId: lot.id,
        toSerial: serial,
        note: "consumed lot 88421",
      });

  for (const l of links) {
    const woId = buildBySerial.get(l.toSerial);
    if (!woId) continue;
    await db.entityLink.create({
      data: {
        fromType: l.fromType,
        fromId: l.fromId,
        relation: "AFFECTS",
        toType: "UNIT",
        toId: woId,
        note: l.note,
      },
    });
  }

  return { units: unitBySerial.size, substitutions };
}
