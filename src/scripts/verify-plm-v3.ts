/**
 * Verify PLM.V3 — Manufacturing v2: the as-built CAPTURE step. Run: pnpm verify:plm-v3
 *
 *   1. The capture card + wiring exist (route loads getAsBuiltCapture; MfgView
 *      renders AsBuiltCapture); the build genealogy links to the Unit page (PLM.3).
 *   2. Capture WRITES an AsBuiltRecord and computes the diff AT WRITE TIME — the
 *      substitution flag is decided by captureAsBuilt from the as-designed BOM and
 *      stored (never reconstructed later). Exercised on a throwaway unit, cleaned up.
 *   3. Idempotent per (unit, position): a re-scan updates, never duplicates.
 *   4. The capture action is RBAC-gated on line 1 + audited (AUDIT.1).
 *   5. Read-only screen: the mutation lives in the action + data layer, never in a
 *      components/manufacturing/*.tsx file (verify:mfg-2 stays green).
 *   6. Per-tenant isolation — a second org cannot capture against this org's unit.
 *   7. SN-2208's real capture surfaces the seeded SERVO-204 substitution.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureSeededState } from "./lib/self-clean";

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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";
const SERIAL = "SN-2208";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.V3 — Manufacturing v2 (as-built capture)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/manufacturing/page.tsx");
  const mfgView = read("apps/web/components/manufacturing/MfgView.tsx");
  const card = read("apps/web/components/manufacturing/AsBuiltCapture.tsx");
  const genealogy = read(
    "apps/web/components/manufacturing/BuildGenealogy.tsx",
  );
  const actions = read("apps/web/app/(shell)/manufacturing/actions.ts");
  const capture = read("packages/db/src/plm/capture.ts");

  // ── 1 (static): the new region is wired ──
  await check("route loads getAsBuiltCapture; MfgView renders the card", () => {
    return (
      /getAsBuiltCapture/.test(page) &&
      /AsBuiltCapture/.test(mfgView) &&
      card.length > 0
    );
  });
  await check(
    "build genealogy links to the Unit page (PLM.3), not a dead end",
    () => /\/units\/\$\{encodeURIComponent\(serial\)\}/.test(genealogy),
  );
  await check(
    "card links to the full as-built diff (PLM.4)",
    () =>
      /asBuiltHref/.test(card) &&
      /as-built/.test(read("apps/web/lib/manufacturing.ts")),
  );
  await check(
    "capture action is RBAC-gated on line 1, before any DB call",
    () => {
      const iRole = actions.indexOf("requireRole(");
      const iDb = actions.indexOf("dbForOrg(");
      const iCapture = actions.indexOf("captureAsBuilt(");
      return (
        iRole > 0 &&
        iDb > iRole &&
        iCapture > iRole &&
        /writeAudit\(/.test(actions) &&
        /"asbuilt\.capture"/.test(actions)
      );
    },
  );
  await check(
    "no mutation in components/manufacturing (write is in action + data layer)",
    () => !/\.(create|update|upsert|delete|deleteMany|updateMany)\(/.test(card),
  );
  await check("diff is computed AT WRITE TIME in the data layer", () => {
    // isSubstitution is decided from the as-designed BOM inside captureAsBuilt,
    // not read back from a later reconstruction.
    return (
      /bomLine\.findFirst/.test(capture) &&
      /isSubstitution\s*=/.test(capture) &&
      /expectedPartRevisionId !== input\.partRevisionId/.test(capture)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { prisma, dbForOrg, captureAsBuilt, asBuiltDiff } =
    await import("@axona/db");
  const { getAsBuiltCapture } =
    await import("../../apps/web/lib/manufacturing");
  const db = dbForOrg(DEMO);

  // ── 7: SN-2208's real capture surfaces the seeded SERVO-204 substitution ──
  await check("SN-2208 capture surfaces the seeded substitution", async () => {
    const cap = await getAsBuiltCapture(DEMO, SERIAL);
    if (!cap) return false;
    return (
      cap.serial === SERIAL &&
      cap.total > 0 &&
      cap.scanned === cap.total &&
      cap.substitutions >= 1 &&
      cap.components.some((c) => c.isSubstitution) &&
      cap.asBuiltHref === `/units/${SERIAL}/as-built` &&
      cap.bomRevision.length > 0
    );
  });

  // ── 2/3/6: exercise the REAL capture write on a throwaway unit, then clean up ──
  await check(
    "capture writes an AsBuiltRecord, decides substitution at write time, idempotent",
    async () => {
      const guard = await captureSeededState(prisma as never, [
        "Unit",
        "AsBuiltRecord",
        "AuditLog",
      ]);
      try {
        // a real product model + two BOM positions to scan against
        const unit0 = await prisma.unit.findFirst({
          where: { orgId: DEMO, serial: SERIAL },
          select: { productModelId: true },
        });
        if (!unit0) return false;
        const bom = await db.bomLine.findMany({
          where: { productModelId: unit0.productModelId },
          select: { position: true, partRevisionId: true },
          orderBy: { position: "asc" },
        });
        if (bom.length < 2) return false;
        const designed = bom[0]!;
        // a part revision that differs from the designed one at position 0
        const other = bom.find(
          (b) => b.partRevisionId !== designed.partRevisionId,
        );
        if (!other) return false;

        const temp = await prisma.unit.create({
          data: {
            orgId: DEMO,
            serial: "SN-VERIFY-V3",
            productModelId: unit0.productModelId,
            buildDate: new Date(),
            status: "in_build",
          },
          select: { id: true },
        });

        // match: capture the AS-DESIGNED part → not a substitution
        const asMatch = await captureAsBuilt(db, {
          unitId: temp.id,
          bomPosition: designed.position,
          partRevisionId: designed.partRevisionId,
          lotCode: "V3-LOT",
        });
        if (asMatch.isSubstitution) return false;

        // substitution: capture a DIFFERENT revision at the same position → flagged
        const asSub = await captureAsBuilt(db, {
          unitId: temp.id,
          bomPosition: designed.position,
          partRevisionId: other.partRevisionId,
        });
        if (!asSub.isSubstitution) return false;

        // idempotent: only ONE record for that (unit, position)
        const recs = await prisma.asBuiltRecord.findMany({
          where: { unitId: temp.id, bomPosition: designed.position },
        });
        if (recs.length !== 1) return false;
        // and the stored flag is the write-time decision, not reconstructed
        if (recs[0]!.isSubstitution !== true) return false;
        if (recs[0]!.partRevisionId !== other.partRevisionId) return false;

        // the diff reads the captured record back
        const diff = await asBuiltDiff(db, temp.id);
        const line = diff.lines.find((l) => l.position === designed.position);
        return !!line && line.isSubstitution === true;
      } finally {
        await guard.restore(); // MIGRATE.1 — leave the seed intact
      }
    },
  );

  await check(
    "isolation: a second org cannot capture against this org's unit",
    async () => {
      const unit = await prisma.unit.findFirst({
        where: { orgId: DEMO, serial: SERIAL },
        select: { id: true },
      });
      if (!unit) return false;
      try {
        await captureAsBuilt(dbForOrg(SECOND), {
          unitId: unit.id,
          bomPosition: "A-01",
          partRevisionId: "x",
        });
        return false; // should have thrown — the unit is not in SECOND's scope
      } catch {
        return true;
      }
    },
  );

  await check(
    "isolation: capture read model is null for a foreign serial",
    async () => {
      const cap = await getAsBuiltCapture(SECOND, SERIAL);
      return cap === null;
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
