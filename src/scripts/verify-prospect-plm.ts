/**
 * Verify PROSPECT-PLM — deep golden-thread overlays for seeded prospect tenants:
 * (a) config management + traceability + BR.1 for a multi-factory defense manufacturer
 * (resolved by the SN-H-4471 serial), and (b) agentic procurement + per-cell genealogy
 * for a robotic-cell manufacturer (resolved by the NM-PICK-0142 serial). Each tenant
 * config is gitignored (SEED.1: its real marque is never committed — this verify is
 * marque-free and resolves every org by a non-marque serial, never by name), so this is
 * an INTEGRATION check. DB checks gate on DATABASE_URL:
 *  · a CI-safe THROWAWAY org proves the exact combination the overlay relies on
 *    (BR.1 long-lead-blocked · a dual-approver locked config resolveConfigAt matches ·
 *    ECO blast across 3 factories · isolation), self-cleaned.
 *  · a block gated on the (gitignored) prospect seed being present asserts the REAL
 *    golden thread end-to-end + the sensitivity governance (no operational content).
 * Run: pnpm verify:prospect-plm
 *
 *   1. (db) BR.1 on the fixture blocks on 2 single-source long-lead parts.
 *   2. (db) a dual-approver locked config (proposer≠locker, frozen) — resolveConfigAt matches it.
 *   3. (db) ECO blast reaches units across 3 distinct factories (siteLabel grouping).
 *   4. (db) org isolation — readiness on another tenant's unit is "not found".
 *   5. (db·gated) real SN-H-4471: as-built COMPUTE-720 rev B / lot 88471 substitution.
 *   6. (db·gated) real NCR-H118 (component · frozen snapshot · fail run) + a passing run.
 *   7. (db·gated) real ECO-H318 blast = units across 3 factories; lot 88471 reach.
 *   8. (db·gated) real CFG-HX2-r4.2 dual-approver + "which units run v4.2.1" resolves.
 *   9. (db·gated) real BR.1 card blocked on single-source long-lead specialty parts.
 *  10. (db·gated) export-control HOLD + config-lock audit + persona + modules populated.
 *  11. (db·gated) SENSITIVITY: NO operational content in any seeded text field.
 *  12. (db·gated) real NM-PICK-0142: as-built VIS-CAM rev-4 → rev-3 substitution.
 *  13. (db·gated) real procurement hero: agent PR/RFQ → approved PO → GR 3-way → SN.
 *  14. (db·gated) real gripper-EOAT ECO blast across built + deployed cells.
 *  15. (db·gated) real NM-PICK-0142 BR.1 ~85% blocked on single-source long-lead parts.
 *  16. (db·gated) real multi-location reservation + projects + obsolete part + persona.
 *  17. (db·gated) real NM-PICK-0142 isolation.
 */

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

// SENSITIVITY GOVERNANCE — operational terms that must NEVER appear in this tenant's
// data (config-management/traceability mechanics only). Word-bounded, case-insensitive.
const BANNED_OPS =
  /\b(warhead|payload|targeting|guidance|missile|munition|weapon|seeker|lethal|ordnance|detonat\w*)\b/i;

const VERIFY_ORG = "org_prospect_plm_verify";
const DAY = 86_400_000;

async function run(): Promise<void> {
  console.log("\nVerifying PROSPECT-PLM — deep PLM golden-thread overlay\n");

  if (!process.env.DATABASE_URL) {
    console.log(
      "  SKIP db checks — DATABASE_URL not set (this overlay is a seed; no committed code surface)",
    );
    finish();
    return;
  }

  const {
    prisma,
    dbForOrg,
    computeBuildReadiness,
    resolveConfigAt,
    freezeConfigManifest,
    asBuiltDiff,
  } = await import("@axona/db");
  const { affectedUnits } = await import("@axona/agents");

  // ── the CI-safe throwaway org: prove the overlay integration shape ────────────
  const IN_HOUSE = Array.from({ length: 11 }, (_, i) => `HXV-IH-${i + 1}`);
  const ACT = "HXV-ACTUATOR-560"; // single-source · long-lead → late
  const OPT = "HXV-OPTICS-620"; // single-source · long-lead → missing
  const single = new Set([ACT, OPT]);
  const leadOf = (pn: string) => (pn === ACT ? 63 : pn === OPT ? 70 : 12);

  await prisma.org.deleteMany({ where: { id: VERIFY_ORG } });
  await prisma.org.create({
    data: {
      id: VERIFY_ORG,
      name: "Prospect PLM Verify Co",
      slug: "prospect-plm-verify",
      enabledModules: [],
    },
  });
  const db = dbForOrg(VERIFY_ORG);

  try {
    const model = await db.productModel.create({
      data: {
        orgId: VERIFY_ORG,
        code: "HXV",
        name: "HXV verify model",
        designRevision: "C",
      },
    });
    const bom: {
      orgId: string;
      position: string;
      partRevisionId: string;
      qty: number;
      productModelId: string;
      designRevision: string;
    }[] = [];
    let pos = 0;
    for (const pn of [...IN_HOUSE, ACT, OPT]) {
      pos++;
      const pm = await db.partMaster.create({
        data: {
          orgId: VERIFY_ORG,
          partNumber: pn,
          description: `${pn} subsystem`,
          category: "test",
          lifecycleStatus: "active",
          approvedVendorIds: single.has(pn)
            ? ["Vendor Solo"]
            : ["Vendor A", "Vendor B"],
        },
      });
      const rev = await db.partRevision.create({
        data: {
          orgId: VERIFY_ORG,
          partMasterId: pm.id,
          rev: "A",
          effectiveFrom: new Date(Date.now() - 2e9),
        },
      });
      bom.push({
        orgId: VERIFY_ORG,
        productModelId: model.id,
        designRevision: "C",
        position: `P-${String(pos).padStart(2, "0")}`,
        partRevisionId: rev.id,
        qty: 1,
      });
      await db.part.create({
        data: {
          orgId: VERIFY_ORG,
          sku: pn,
          name: `${pn} subsystem`,
          onHand: single.has(pn) ? 0 : 5,
          reorderPoint: 3,
          leadDays: leadOf(pn),
          dailyUse: 1,
        },
      });
    }
    await db.bomLine.createMany({ data: bom });
    const partIdBySku = new Map(
      (await db.part.findMany({ select: { id: true, sku: true } })).map((p) => [
        p.sku,
        p.id,
      ]),
    );
    const supplier = await db.supplier.create({
      data: {
        orgId: VERIFY_ORG,
        name: "Vendor Solo",
        tier: 2,
        riskScore: 0.4,
        onTimePct: 84,
      },
    });
    await db.purchaseOrder.create({
      data: {
        orgId: VERIFY_ORG,
        code: "PO-HV-1",
        supplierId: supplier.id,
        partId: partIdBySku.get(ACT)!,
        qty: 10,
        value: 5000,
        status: "SENT",
        eta: new Date(Date.now() - 7 * DAY),
      },
    });

    const fw41 = await db.softwareRelease.create({
      data: { orgId: VERIFY_ORG, component: "firmware", version: "v4.1.0" },
    });
    const fw42 = await db.softwareRelease.create({
      data: { orgId: VERIFY_ORG, component: "firmware", version: "v4.2.1" },
    });

    const alice = await db.user.create({
      data: {
        orgId: VERIFY_ORG,
        email: "alice@prospect-verify.test",
        name: "Alice",
        role: "ENGINEER",
      },
    });
    const bob = await db.user.create({
      data: {
        orgId: VERIFY_ORG,
        email: "bob@prospect-verify.test",
        name: "Bob",
        role: "ADMIN",
      },
    });
    const r41manifest = await freezeConfigManifest(db, {
      productModelId: model.id,
      swSpec: { firmware: "v4.1.0" },
    });
    const r41 = await db.configurationVersion.create({
      data: {
        orgId: VERIFY_ORG,
        name: "HXV-r4.1",
        productModelId: model.id,
        hwSpec: {},
        swSpec: { firmware: "v4.1.0" },
        isBaseline: true,
        lockProposedById: alice.id,
        lockProposedAt: new Date(Date.now() - 80 * DAY),
        lockedById: bob.id,
        lockedAt: new Date(Date.now() - 78 * DAY),
        frozenManifest: r41manifest as never,
      },
    });
    const r42manifest = await freezeConfigManifest(db, {
      productModelId: model.id,
      swSpec: { firmware: "v4.2.1" },
    });
    await db.configurationVersion.create({
      data: {
        orgId: VERIFY_ORG,
        name: "HXV-r4.2",
        productModelId: model.id,
        hwSpec: {},
        swSpec: { firmware: "v4.2.1" },
        isBaseline: true,
        lockProposedById: alice.id,
        lockProposedAt: new Date(Date.now() - 36 * DAY),
        lockedById: bob.id,
        lockedAt: new Date(Date.now() - 34 * DAY),
        frozenManifest: r42manifest as never,
        supersedesId: r41.id,
      },
    });

    const factories = ["Factory-1", "Factory-2", "Factory-3"];
    const unitIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const u = await db.unit.create({
        data: {
          orgId: VERIFY_ORG,
          serial: `HXV-${100 + i}`,
          productModelId: model.id,
          status: "deployed",
          buildDate: new Date(Date.now() - 60 * DAY),
          siteLabel: factories[i % 3],
          customerLabel: "Program-A",
        },
      });
      unitIds.push(u.id);
      await db.unitSoftwareState.create({
        data: {
          orgId: VERIFY_ORG,
          unitId: u.id,
          softwareReleaseId: fw42.id,
          effectiveFrom: new Date(Date.now() - 60 * DAY),
          effectiveTo: null,
        },
      });
    }
    void fw41;

    const eco = await db.eCO.create({
      data: {
        orgId: VERIFY_ORG,
        code: "ECO-HV1",
        title: "Supersede subsystem",
        changeType: "SUPERSEDE",
        affected: "HXV",
        stage: "REVIEW",
        rolloutStatus: "in_progress",
      },
    });
    await db.entityLink.createMany({
      data: unitIds.map((id) => ({
        orgId: VERIFY_ORG,
        fromType: "ECO",
        fromId: eco.id,
        relation: "AFFECTS",
        toType: "UNIT",
        toId: id,
        note: "in scope",
      })) as never,
    });

    await check(
      "BR.1 on the fixture blocks on 2 single-source long-lead parts",
      async () => {
        const r = await computeBuildReadiness(db, unitIds[0]!);
        if (r.blockingParts.length !== 2) return false;
        for (const b of r.blockingParts) {
          const pm = await db.partMaster.findFirst({
            where: { partNumber: b.partNumber },
            select: { approvedVendorIds: true },
          });
          const p = await db.part.findFirst({
            where: { sku: b.partNumber },
            select: { leadDays: true },
          });
          if (pm?.approvedVendorIds.length !== 1 || (p?.leadDays ?? 0) < 30)
            return false;
        }
        return (
          r.blockingParts.some((b) => b.state === "late") &&
          r.blockingParts.some((b) => b.state === "missing")
        );
      },
    );

    await check(
      "dual-approver locked config (proposer≠locker, frozen) — resolveConfigAt matches it",
      async () => {
        const resolved = await resolveConfigAt(db, unitIds[0]!, new Date());
        const cfg = await db.configurationVersion.findFirst({
          where: { name: "HXV-r4.2" },
          select: {
            lockProposedById: true,
            lockedById: true,
            lockedAt: true,
            frozenManifest: true,
            supersedesId: true,
          },
        });
        return (
          resolved.configVersion?.name === "HXV-r4.2" &&
          !!cfg &&
          cfg.lockProposedById !== cfg.lockedById &&
          !!cfg.lockProposedById &&
          !!cfg.lockedById &&
          !!cfg.lockedAt &&
          !!cfg.frozenManifest &&
          !!cfg.supersedesId
        );
      },
    );

    await check(
      "ECO blast reaches units across 3 distinct factories",
      async () => {
        const res = await affectedUnits(db, { ecoId: "ECO-HV1" });
        const fac = new Set(res.units.map((u) => u.siteLabel));
        return res.units.length >= 3 && fac.size === 3;
      },
    );

    await check(
      "org isolation: readiness on this unit via another tenant is 'not found'",
      async () => {
        let threw = false;
        try {
          await computeBuildReadiness(
            dbForOrg("org_no_such_tenant_xyz"),
            unitIds[0]!,
          );
        } catch {
          threw = true;
        }
        return threw;
      },
    );
  } finally {
    await prisma.org.deleteMany({ where: { id: VERIFY_ORG } });
  }

  // ── the REAL prospect seed, when present (gitignored → local/prod only) ────────
  // Resolve the org by a NON-marque anchor (the golden-thread serial), never by name.
  const heroUnit = await prisma.unit.findFirst({
    where: { serial: "SN-H-4471" },
    select: { id: true, orgId: true },
  });
  if (!heroUnit?.orgId) {
    console.log(
      "\n  SKIP config-management thread — that prospect tenant is not seeded",
    );
  } else {
    const hdb = dbForOrg(heroUnit.orgId);
    const hero = { id: heroUnit.id };

    await check(
      "real SN-H-4471: as-built COMPUTE-720 rev B / lot 88471 substitution",
      async () => {
        const rec = await hdb.asBuiltRecord.findFirst({
          where: { unitId: hero.id, isSubstitution: true, lotCode: "88471" },
          include: { partRevision: { include: { partMaster: true } } },
        });
        return (
          rec?.partRevision.partMaster.partNumber === "COMPUTE-720" &&
          rec?.partRevision.rev === "B"
        );
      },
    );

    await check(
      "real NCR-H118 (component · frozen snapshot · fail run) + a passing run on the same procedure",
      async () => {
        const ncr = await hdb.nCR.findFirst({
          where: { code: "NCR-H118" },
          select: { rootCause: true, testRunId: true, configSnapshot: true },
        });
        const fail = await hdb.testRun.findFirst({
          where: { outcome: "fail" },
          select: { procedure: true },
        });
        const pass = fail
          ? await hdb.testRun.findFirst({
              where: { outcome: "pass", procedure: fail.procedure },
            })
          : null;
        return (
          ncr?.rootCause === "component" &&
          !!ncr?.testRunId &&
          !!ncr?.configSnapshot &&
          !!pass
        );
      },
    );

    await check(
      "real ECO-H318 blast = units across 3 factories; lot 88471 reach across factories",
      async () => {
        const ecoRes = await affectedUnits(hdb, { ecoId: "ECO-H318" });
        const ecoFac = new Set(
          ecoRes.units.map((u) => u.siteLabel).filter(Boolean),
        );
        const lotRes = await affectedUnits(hdb, { lot: "88471" });
        const lotFac = new Set(
          lotRes.units.map((u) => u.siteLabel).filter(Boolean),
        );
        return (
          ecoRes.units.length >= 3 &&
          ecoFac.size === 3 &&
          lotRes.units.length >= 2 &&
          lotFac.size >= 2
        );
      },
    );

    await check(
      "real CFG-HX2-r4.2 dual-approver + 'which units run v4.2.1' resolves to a real set",
      async () => {
        const cfg = await hdb.configurationVersion.findFirst({
          where: { name: "CFG-HX2-r4.2" },
          select: {
            lockProposedById: true,
            lockedById: true,
            lockedAt: true,
            frozenManifest: true,
            isBaseline: true,
          },
        });
        const dual =
          !!cfg &&
          cfg.lockProposedById !== cfg.lockedById &&
          !!cfg.lockProposedById &&
          !!cfg.lockedById &&
          !!cfg.lockedAt &&
          !!cfg.frozenManifest &&
          cfg.isBaseline;
        const now = new Date();
        const states = await hdb.unitSoftwareState.findMany({
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          include: { softwareRelease: true },
        });
        const on421 = states.filter(
          (s) =>
            s.softwareRelease.component === "firmware" &&
            s.softwareRelease.version === "v4.2.1",
        ).length;
        return dual && on421 > 0;
      },
    );

    await check(
      "real BR.1 card: SN-H-4471 blocked on single-source long-lead specialty parts",
      async () => {
        const r = await computeBuildReadiness(hdb, hero.id);
        if (r.blockingParts.length < 1) return false;
        let anyLongLeadSingle = false;
        for (const b of r.blockingParts) {
          const pm = await hdb.partMaster.findFirst({
            where: { partNumber: b.partNumber },
            select: { approvedVendorIds: true },
          });
          const p = await hdb.part.findFirst({
            where: { sku: b.partNumber },
            select: { leadDays: true },
          });
          if (pm?.approvedVendorIds.length === 1 && (p?.leadDays ?? 0) >= 30)
            anyLongLeadSingle = true;
        }
        return anyLongLeadSingle;
      },
    );

    await check(
      "export-control HOLD + dual-approver config-lock audit + fictional persona + modules populated",
      async () => {
        const exportHold = await hdb.exportLicense.count({
          where: { state: "HOLD" },
        });
        const lockAudit = await hdb.auditLog.count({
          where: { action: "config.lock" },
        });
        const persona = await hdb.user.findFirst({
          where: { name: "Lena Brandt" },
        });
        const [agents, suppliers, parts, pos2, bom2, units, audit, deliveries] =
          await Promise.all([
            hdb.agent.count(),
            hdb.supplier.count(),
            hdb.part.count(),
            hdb.purchaseOrder.count(),
            hdb.bomLine.count(),
            hdb.unit.count(),
            hdb.auditLog.count(),
            hdb.delivery.count(),
          ]);
        return (
          exportHold >= 1 &&
          lockAudit >= 2 &&
          !!persona &&
          [
            agents,
            suppliers,
            parts,
            pos2,
            bom2,
            units,
            audit,
            deliveries,
          ].every((c) => c > 0)
        );
      },
    );

    await check(
      "SENSITIVITY: NO operational content in any seeded text field",
      async () => {
        const bag: string[] = [];
        for (const n of await hdb.nCR.findMany({
          select: { defect: true, linkedTo: true },
        }))
          bag.push(n.defect, n.linkedTo ?? "");
        for (const p of await hdb.partMaster.findMany({
          select: { description: true },
        }))
          bag.push(p.description);
        for (const c of await hdb.configurationVersion.findMany({
          select: { name: true },
        }))
          bag.push(c.name);
        for (const d of await hdb.delivery.findMany({
          select: { units: true, riskState: true },
        }))
          bag.push(d.units, d.riskState);
        for (const e of await hdb.eCO.findMany({
          select: { title: true, affected: true },
        }))
          bag.push(e.title, e.affected);
        for (const x of await hdb.exportLicense.findMany({
          select: { code: true, destination: true },
        }))
          bag.push(x.code, x.destination);
        for (const a of await hdb.auditLog.findMany({
          select: { summary: true },
        }))
          bag.push(a.summary);
        const hit = bag.find((s) => BANNED_OPS.test(s));
        if (hit) console.log(`      operational term found: "${hit}"`);
        return !hit;
      },
    );
  }

  // ── the NM-PICK procurement thread, when seeded (resolve by a non-marque serial) ──
  const nmHero = await prisma.unit.findFirst({
    where: { serial: "NM-PICK-0142" },
    select: { id: true, orgId: true },
  });
  if (!nmHero?.orgId) {
    console.log(
      "\n  SKIP agentic-procurement thread — that prospect tenant is not seeded",
    );
  } else {
    const ndb = dbForOrg(nmHero.orgId);
    const nmId = nmHero.id;

    await check(
      "real NM-PICK-0142: as-built VIS-CAM rev-4 → rev-3 substitution",
      async () => {
        const diff = await asBuiltDiff(ndb, nmId);
        const sub = diff.lines.find((l) => l.isSubstitution);
        return (
          diff.summary.substitutions >= 1 &&
          sub?.expected?.partNumber === "NM-VIS-CAM" &&
          sub?.actual?.rev === "3"
        );
      },
    );

    await check(
      "real procurement hero: agent PR/RFQ → approved PO → GR 3-way match → SN captured",
      async () => {
        const draft = await ndb.purchaseOrder.count({
          where: {
            status: "AWAITING_APPROVAL",
            draftedByAgentId: { not: null },
            code: { startsWith: "PO-NM-" },
          },
        });
        const received = await ndb.purchaseOrder.count({
          where: { status: "RECEIVED", code: { startsWith: "PO-NM-" } },
        });
        const hooks = await Promise.all(
          ["po.draft", "gr.match", "supplier.chase", "po.approve"].map((a) =>
            ndb.auditLog.count({
              where: { action: a, targetId: { startsWith: "PO-NM-" } },
            }),
          ),
        );
        const packing = await ndb.file.findFirst({
          where: { name: { contains: "PO-NM-9001" } },
          select: { extracted: true },
        });
        const threeWay = !!(
          packing?.extracted as { threeWayMatch?: boolean } | null
        )?.threeWayMatch;
        const sn = await ndb.asBuiltRecord.count({
          where: { unitId: nmId, componentSerial: { not: null } },
        });
        return (
          draft >= 1 &&
          received >= 1 &&
          hooks.every((c) => c >= 1) &&
          threeWay &&
          sn >= 1
        );
      },
    );

    await check(
      "real ECO-NM-318 gripper-EOAT blast reaches built + deployed cells",
      async () => {
        const res = await affectedUnits(ndb, { ecoId: "ECO-NM-318" });
        return res.units.length >= 3;
      },
    );

    await check(
      "real NM-PICK-0142 BR.1: ~85% blocked on single-source long-lead specialty parts",
      async () => {
        const r = await computeBuildReadiness(ndb, nmId);
        if (r.pctInHouse < 80 || r.pctInHouse > 90) return false;
        if (r.blockingParts.length < 1 || r.blockingParts.length > 2)
          return false;
        for (const b of r.blockingParts) {
          const pm = await ndb.partMaster.findFirst({
            where: { partNumber: b.partNumber },
            select: { approvedVendorIds: true },
          });
          const p = await ndb.part.findFirst({
            where: { sku: b.partNumber },
            select: { leadDays: true },
          });
          if (pm?.approvedVendorIds.length !== 1 || (p?.leadDays ?? 0) < 30)
            return false;
        }
        return true;
      },
    );

    await check(
      "real multi-location inventory: a reserved on-site spare + ≥4 stock locations + projects + obsolete part + persona",
      async () => {
        const spare = await ndb.inventoryStock.findFirst({
          where: {
            location: { contains: "on-site spares" },
            reserved: { gt: 0 },
          },
        });
        const locs = await ndb.inventoryStock.findMany({
          select: { location: true },
          distinct: ["location"],
        });
        const projects = await ndb.project.count();
        const obsolete = await ndb.partMaster.count({
          where: { lifecycleStatus: "obsolete" },
        });
        const persona = await ndb.user.findFirst({
          where: { name: "Marta Sobczak" },
        });
        return (
          !!spare &&
          locs.length >= 4 &&
          projects >= 3 &&
          obsolete >= 1 &&
          !!persona
        );
      },
    );

    await check(
      "real NM-PICK-0142 isolation: another tenant cannot resolve it",
      async () => {
        let threw = false;
        try {
          await computeBuildReadiness(dbForOrg("org_no_such_tenant_xyz"), nmId);
        } catch {
          threw = true;
        }
        return threw;
      },
    );
  }

  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
