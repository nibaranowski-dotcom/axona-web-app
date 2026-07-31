/**
 * Verify MFX.1 — the MedTech-device-maker demo seed (procurement + build-readiness
 * wedge). Marque-free (SEED.3): the tenant's real name is never committed — the
 * real-seed block resolves the org by a non-marque serial (CE-2026-007), never by name.
 * Static checks always run. DB checks gate on DATABASE_URL:
 *  · a CI-safe THROWAWAY org proves the mechanism (xlsx BOM → IO.1 → item IDs;
 *    a 60-shaped readiness fixture reads 85% / 2 blocking; org isolation), and is
 *    self-cleaned (org.delete cascades the fixture).
 *  · a block gated on the (gitignored) org_mfx_demo being seeded asserts the REAL
 *    unit #007 reads ~85% / exactly 2 blocking + the hero thread + populated modules.
 * Run: pnpm verify:mfx-1
 *
 *   1. (static) the bomLine descriptor is registered + IO.1 has an xlsx front-end.
 *   2. (static) importBom is a thin caller (no second BOM path); xlsx dep present.
 *   3. (static) the BomLine natural-key unique is additive (migration + schema).
 *   4. (db) a sample .xlsx BOM imports via IO.1 (bomLine descriptor) → creates item IDs.
 *   5. (db) computeBuildReadiness on the MFX-shaped fixture = 85% in-house, 2 blocking.
 *   6. (db) the 2 blocking are the single-source + long-lead specialty parts.
 *   7. (db) org isolation — readiness on another tenant's unit is "not found".
 *   8. (db·gated on org_mfx_demo) real #007 ≈ 85% / 2 blocking + hero thread + modules.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const VERIFY_ORG = "org_mfx_verify";
const VMODEL = "MFXV-1";
const VREV = "A";

// Build a valid .xlsx BOM (first sheet · header row + lines) as bytes.
function bomXlsx(pns: string[]): Uint8Array {
  const aoa: (string | number)[][] = [
    ["model", "revision", "position", "partnumber", "rev", "qty"],
    ...pns.map((pn, i) => [
      VMODEL,
      VREV,
      `P-${String(i + 1).padStart(2, "0")}`,
      pn,
      "A",
      1,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOM");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

async function run(): Promise<void> {
  console.log("\nVerifying MFX.1 — MedTech demo seed\n");

  // ── 1-3 · static: the committed IO.1 build-on-top ──────────────────────────
  await check(
    "IO.1 gains a bomLine descriptor + an xlsx front-end feeding the same importEntity",
    () => {
      const core = decomment(read("packages/db/src/io/import-core.ts"));
      return (
        /export const bomLineDescriptor/.test(core) &&
        /bomLine: bomLineDescriptor/.test(core) &&
        /export function parseWorkbook/.test(core) &&
        /source\.bytes\s*\?\s*parseWorkbook/.test(core) &&
        /bytes\?: Uint8Array/.test(core)
      );
    },
  );
  await check(
    "importBom is a thin caller over the descriptor (no second BOM path); xlsx dep present",
    () => {
      const imp = decomment(read("packages/db/src/plm/import.ts"));
      const pkg = read("packages/db/package.json");
      return (
        /importEntity\(db, bomLineDescriptor, src, opts\)/.test(imp) &&
        !/revByKey/.test(imp) && // the old inline BOM validation is gone
        /"xlsx":/.test(pkg)
      );
    },
  );
  await check(
    "BomLine natural-key unique is additive (migration + schema) — no db push",
    () => {
      const mig = read(
        "packages/db/prisma/migrations/20260731130000_mfx1_bomline_unique/migration.sql",
      ).replace(/--[^\n]*/g, "");
      const schema = read("packages/db/prisma/schema.prisma");
      return (
        /CREATE UNIQUE INDEX .* ON "BomLine"/.test(mig) &&
        !/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i.test(mig) &&
        /@@unique\(\[orgId, productModelId, designRevision, position\]\)/.test(
          schema,
        )
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP db checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma, dbForOrg, computeBuildReadiness, importBom } =
    await import("@axona/db");

  // ── the CI-safe throwaway org: prove the mechanism end-to-end ──────────────
  // 20-line BOM: 17 in-house (85%), 1 on-order, 1 late, 1 missing (blocking = 2).
  const BLOCK_LATE = "MFXV-LATE-1";
  const BLOCK_MISS = "MFXV-MISS-1";
  const ON_ORDER = "MFXV-ONORD-1";
  const inHouse = Array.from({ length: 17 }, (_, i) => `MFXV-IH-${i + 1}`);
  const allPns = [...inHouse, ON_ORDER, BLOCK_LATE, BLOCK_MISS];
  const single = new Set([BLOCK_LATE, BLOCK_MISS]);
  const leadOf = (pn: string) =>
    pn === BLOCK_LATE ? 40 : pn === BLOCK_MISS ? 50 : 10;
  const onHandOf = (pn: string) => (inHouse.includes(pn) ? 5 : 0);

  await prisma.org.deleteMany({ where: { id: VERIFY_ORG } }); // clean any prior run
  await prisma.org.create({
    data: {
      id: VERIFY_ORG,
      name: "MFX Verify Co",
      slug: "mfx-verify",
      enabledModules: [],
    },
  });
  const db = dbForOrg(VERIFY_ORG);

  try {
    const model = await db.productModel.create({
      data: {
        orgId: VERIFY_ORG,
        code: VMODEL,
        name: "MFX verify model",
        designRevision: VREV,
      },
    });
    // part masters + revisions + procurement parts (the sku side of the bridge).
    for (const pn of allPns) {
      const pm = await db.partMaster.create({
        data: {
          orgId: VERIFY_ORG,
          partNumber: pn,
          description: `${pn} part`,
          category: "test",
          lifecycleStatus: "active",
          approvedVendorIds: single.has(pn)
            ? ["Vendor Solo"]
            : ["Vendor A", "Vendor B"],
        },
      });
      await db.partRevision.create({
        data: {
          orgId: VERIFY_ORG,
          partMasterId: pm.id,
          rev: "A",
          effectiveFrom: new Date(Date.now() - 1e9),
        },
      });
      await db.part.create({
        data: {
          orgId: VERIFY_ORG,
          sku: pn,
          name: `${pn} part`,
          onHand: onHandOf(pn),
          reorderPoint: 3,
          leadDays: leadOf(pn),
          dailyUse: 1,
        },
      });
    }
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
        onTimePct: 85,
      },
    });
    // covering POs: on-order (future eta), late (past eta); missing has NONE.
    await db.purchaseOrder.create({
      data: {
        orgId: VERIFY_ORG,
        code: "PO-V-1",
        supplierId: supplier.id,
        partId: partIdBySku.get(ON_ORDER)!,
        qty: 4,
        value: 1000,
        status: "SENT",
        eta: new Date(Date.now() + 10 * 86400000),
      },
    });
    await db.purchaseOrder.create({
      data: {
        orgId: VERIFY_ORG,
        code: "PO-V-2",
        supplierId: supplier.id,
        partId: partIdBySku.get(BLOCK_LATE)!,
        qty: 2,
        value: 5000,
        status: "SENT",
        eta: new Date(Date.now() - 5 * 86400000),
      },
    });

    // ── 4 · the sample .xlsx BOM imports via IO.1 (bomLine descriptor) ─────────
    await check(
      "a .xlsx BOM imports via IO.1 (bomLine descriptor) → creates the 20 item lines",
      async () => {
        const bytes = bomXlsx(allPns);
        const res = await importBom(db, { bytes });
        const count = await db.bomLine.count();
        // idempotent: re-import the SAME BOM as CSV updates in place (no dupes).
        const csv =
          "model,revision,position,partnumber,rev,qty\n" +
          allPns
            .map(
              (pn, i) =>
                `${VMODEL},${VREV},P-${String(i + 1).padStart(2, "0")},${pn},A,1`,
            )
            .join("\n");
        const again = await importBom(db, csv);
        const count2 = await db.bomLine.count();
        return (
          res.created === 20 &&
          res.errors.length === 0 &&
          count === 20 &&
          again.updated === 20 &&
          again.created === 0 &&
          count2 === 20
        );
      },
    );

    const unit = await db.unit.create({
      data: {
        orgId: VERIFY_ORG,
        serial: "MFXV-007",
        productModelId: model.id,
        status: "in_build",
        buildDate: new Date(Date.now() - 5 * 86400000),
      },
    });

    // ── 5 · readiness = 85% in-house, exactly 2 blocking ──────────────────────
    await check(
      "computeBuildReadiness on the MFX-shaped fixture = 85% in-house, blocked on 2",
      async () => {
        const r = await computeBuildReadiness(db, unit.id);
        return (
          r.lineCount === 20 &&
          r.pctInHouse === 85 &&
          r.counts.in_house === 17 &&
          r.blockingParts.length === 2 &&
          r.blockingParts.some(
            (b) => b.partNumber === BLOCK_LATE && b.state === "late",
          ) &&
          r.blockingParts.some(
            (b) => b.partNumber === BLOCK_MISS && b.state === "missing",
          )
        );
      },
    );

    // ── 6 · the 2 blocking are single-source + long-lead ──────────────────────
    await check(
      "the 2 blocking parts are single-source (1 vendor) + long-lead (≥30d)",
      async () => {
        const r = await computeBuildReadiness(db, unit.id);
        for (const b of r.blockingParts) {
          const pm = await db.partMaster.findFirst({
            where: { partNumber: b.partNumber },
            select: { approvedVendorIds: true },
          });
          const part = await db.part.findFirst({
            where: { sku: b.partNumber },
            select: { leadDays: true },
          });
          if (pm?.approvedVendorIds.length !== 1) return false;
          if ((part?.leadDays ?? 0) < 30) return false;
        }
        return r.blockingParts.length === 2;
      },
    );

    // ── 7 · org isolation ─────────────────────────────────────────────────────
    await check(
      "org isolation: readiness on this unit via another tenant is 'not found'",
      async () => {
        let threw = false;
        try {
          await computeBuildReadiness(
            dbForOrg("org_no_such_tenant_xyz"),
            unit.id,
          );
        } catch {
          threw = true;
        }
        return threw;
      },
    );
  } finally {
    // self-clean: cascade-delete the throwaway org (removes the whole fixture).
    await prisma.org.deleteMany({ where: { id: VERIFY_ORG } });
  }

  // ── 8 · the REAL seed, when present (gitignored config → local only). Resolve the
  //    org by a NON-marque anchor (the hero serial), never by name (SEED.3). ────────
  const heroUnit = await prisma.unit.findFirst({
    where: { serial: "CE-2026-007" },
    select: { id: true, orgId: true },
  });
  if (!heroUnit?.orgId) {
    console.log(
      "\n  SKIP real-seed checks — the demo tenant is not seeded (run its gitignored config)",
    );
  } else {
    const mdb = dbForOrg(heroUnit.orgId);
    const hero = { id: heroUnit.id };

    await check(
      "real #007 reads ~85% in-house, blocked on exactly 2",
      async () => {
        if (!hero) return false;
        const r = await computeBuildReadiness(mdb, hero.id);
        return (
          r.pctInHouse >= 83 &&
          r.pctInHouse <= 87 &&
          r.blockingParts.length === 2
        );
      },
    );

    await check(
      "real #007's 2 blockers are single-source + long-lead specialty parts",
      async () => {
        if (!hero) return false;
        const r = await computeBuildReadiness(mdb, hero.id);
        for (const b of r.blockingParts) {
          const pm = await mdb.partMaster.findFirst({
            where: { partNumber: b.partNumber },
            select: { approvedVendorIds: true },
          });
          const part = await mdb.part.findFirst({
            where: { sku: b.partNumber },
            select: { leadDays: true },
          });
          if (pm?.approvedVendorIds.length !== 1 || (part?.leadDays ?? 0) < 30)
            return false;
        }
        return r.blockingParts.length === 2;
      },
    );

    await check(
      "hero thread: an agent-drafted PR/RFQ + 3 propose→approve→audit hooks",
      async () => {
        const drafted = await mdb.purchaseOrder.count({
          where: {
            status: "AWAITING_APPROVAL",
            draftedByAgentId: { not: null },
          },
        });
        const hooks = await Promise.all(
          ["po.draft", "goods.verify", "supplier.chase"].map((a) =>
            mdb.auditLog.count({ where: { action: a, actorType: "AGENT" } }),
          ),
        );
        return drafted >= 1 && hooks.every((c) => c >= 1);
      },
    );

    await check("every key module is populated for the MFX org", async () => {
      const [agents, suppliers, parts, pos, bom, units, audit, invoices] =
        await Promise.all([
          mdb.agent.count(),
          mdb.supplier.count(),
          mdb.part.count(),
          mdb.purchaseOrder.count(),
          mdb.bomLine.count(),
          mdb.unit.count(),
          mdb.auditLog.count(),
          mdb.invoice.count(),
        ]);
      return [agents, suppliers, parts, pos, bom, units, audit, invoices].every(
        (c) => c > 0,
      );
    });

    await check(
      "persona is fictional (a .test demo login on the MFX org)",
      async () => {
        const u = await mdb.user.findFirst({
          where: { email: { endsWith: "-demo.test" } },
          select: { name: true },
        });
        return !!u && !!u.name && u.name.length > 0;
      },
    );

    await check(
      "real #007 isolation: another tenant cannot resolve it",
      async () => {
        if (!hero) return false;
        let threw = false;
        try {
          await computeBuildReadiness(
            dbForOrg("org_no_such_tenant_xyz"),
            hero.id,
          );
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
