/**
 * Verify PLM.1a — the Unit spine + as-designed BOM + as-built + time-resolved
 * config. Static checks always run; the data checks are gated on DATABASE_URL
 * (they SKIP cleanly in CI, like every other DB-gated verify). Run: pnpm verify:plm-1a
 *
 *   1. All 9 models exist in the schema + are in TENANT_MODELS (per-tenant isolation).
 *   2. Unit backfilled; SN-2208 links its build (WorkOrderMfg) + deployment (Robot).
 *   3. asBuiltDiff(SN-2208) flags the SERVO-204 rev-B substitution w/ lot 88421.
 *   4. resolveConfigAt(past) ≠ resolveConfigAt(now) — time-resolution works.
 *   5. ECO-318 has effectivity; affectedUnits(ECO-318) returns a real multi-unit
 *      set via ONT.1 getBlastRadius.
 *   6. CSV import is idempotent (re-import = no new rows) + reports malformed rows
 *      per-row without partial writes.
 *   7. Per-tenant isolation: a second org resolves ZERO of the first org's units.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const MODELS = [
  "ProductModel",
  "PartMaster",
  "PartRevision",
  "BomLine",
  "Unit",
  "AsBuiltRecord",
  "SoftwareRelease",
  "UnitSoftwareState",
  "ConfigurationVersion",
];

async function run(): Promise<void> {
  console.log(
    "\nVerifying PLM.1a — the Unit spine + configuration data model\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1 (static): models in schema + TENANT_MODELS ──
  const schema = read("packages/db/prisma/schema.prisma");
  const client = read("packages/db/src/client.ts");
  await check("all 9 PLM models exist in the schema", () =>
    MODELS.every((m) => new RegExp(`model ${m} \\{`).test(schema)),
  );
  await check("all 9 PLM models are in TENANT_MODELS (isolation)", () =>
    MODELS.every((m) => new RegExp(`"${m}"`).test(client)),
  );
  await check(
    "keystone logic + façade exist (resolveConfigAt · asBuiltDiff · importUnits/Bom · affectedUnits)",
    () =>
      /resolveConfigAt/.test(read("packages/db/src/plm/config.ts")) &&
      /asBuiltDiff/.test(read("packages/db/src/plm/config.ts")) &&
      /importUnits/.test(read("packages/db/src/plm/import.ts")) &&
      /affectedUnits/.test(read("packages/agents/src/tools/plm.ts")),
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static)`);
    return;
  }

  const { dbForOrg, prisma, resolveConfigAt, asBuiltDiff, importUnits } =
    await import("@axona/db");
  const { affectedUnits } = await import("@axona/agents");
  const { captureSeededState } = await import("./lib/self-clean");
  const DEMO = "org_axona_demo";
  const SECOND = "org_isolation_test";
  const db = dbForOrg(DEMO);

  const sn2208 = await db.unit.findFirst({ where: { serial: "SN-2208" } });

  // ── 2: Unit backfilled; SN-2208 links build + deployment ──
  await check(
    "Unit backfilled from serials; SN-2208 links its build (WorkOrderMfg) + deployment (Robot)",
    async () => {
      const total = await db.unit.count();
      return (
        !!sn2208 &&
        total > 5 && // registry populated from existing serials
        !!sn2208.workOrderMfgId &&
        !!sn2208.robotId
      );
    },
  );

  // ── 3: asBuiltDiff flags the substitution ──
  await check(
    "asBuiltDiff(SN-2208) flags the SERVO-204 rev-B substitution with lot 88421",
    async () => {
      if (!sn2208) return false;
      const diff = await asBuiltDiff(db, sn2208.id);
      const sub = diff.lines.find((l) => l.isSubstitution);
      return (
        diff.summary.substitutions >= 1 &&
        !!sub &&
        sub.actual?.partNumber === "SERVO-204" &&
        sub.actual?.rev === "B" &&
        sub.actual?.lotCode === "88421" &&
        sub.expected?.rev === "C" // designed rev C, built rev B
      );
    },
  );

  // ── 4: resolveConfigAt differs across time ──
  await check(
    "resolveConfigAt(past) ≠ resolveConfigAt(now) — the firmware upgrade is time-resolved",
    async () => {
      if (!sn2208) return false;
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60d ago (pre-upgrade)
      const atNow = await resolveConfigAt(db, sn2208.id, now);
      const atPast = await resolveConfigAt(db, sn2208.id, past);
      return (
        atNow.sw?.version === "v4.2.1" &&
        atPast.sw?.version === "v4.1.0" &&
        atNow.configVersion?.name === "CFG-HX2-r4.2" &&
        atPast.configVersion?.name === "CFG-HX2-r4.1" // distinct configs ⇒ time-resolution works
      );
    },
  );

  // ── 5: ECO effectivity + affectedUnits via ONT.1 ──
  await check(
    "ECO-318 has effectivity; affectedUnits(ECO-318) returns a multi-unit set via ONT.1",
    async () => {
      const eco = await db.eCO.findFirst({ where: { code: "ECO-318" } });
      const res = await affectedUnits(db, { ecoId: "ECO-318" });
      return (
        !!eco?.effectiveFromSerial &&
        eco.rolloutStatus !== "pending" &&
        res.source === "blast-radius" &&
        res.units.length >= 2 && // a real multi-unit set
        res.units.some((u) => u.serial === "SN-2208")
      );
    },
  );

  // ── 6: CSV import idempotent + per-row errors without partial writes ──
  await check(
    "CSV import: idempotent re-import + malformed rows error per-row (no partial writes)",
    async () => {
      const guard = await captureSeededState(db as never, ["Unit"]);
      try {
        const csv = [
          "serial,model,status",
          "SN-TEST-1,HX-2,active", // valid
          "SN-TEST-2,HX-2,active", // valid
          "SN-TEST-3,NOPE,active", // malformed: unknown model
          "SN-TEST-4,HX-2,not_a_status", // malformed: bad enum
        ].join("\n");
        const first = await importUnits(db, csv);
        const afterFirst = await db.unit.count({
          where: { serial: { startsWith: "SN-TEST-" } },
        });
        const second = await importUnits(db, csv); // re-import
        const afterSecond = await db.unit.count({
          where: { serial: { startsWith: "SN-TEST-" } },
        });
        return (
          first.created === 2 &&
          first.errors.length === 2 && // the two malformed rows
          afterFirst === 2 && // ONLY the valid rows were written
          second.created === 0 &&
          second.updated === 2 && // idempotent — no duplicates
          afterSecond === 2
        );
      } finally {
        await guard.restore(); // MIGRATE.1 — leave the seeded state intact
      }
    },
  );

  // ── 7: per-tenant isolation ──
  await check(
    "isolation: the second org resolves ZERO of the first org's units",
    async () => {
      const other = dbForOrg(SECOND);
      const theirUnits = await other.unit.count();
      const leaked = await other.unit.findFirst({
        where: { serial: "SN-2208" },
      });
      return theirUnits === 0 && leaked === null;
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
