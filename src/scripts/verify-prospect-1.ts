/**
 * Verify PROSPECT.1 — the GENERIC prospect-demo tenant mechanism. Marque-free by
 * construction; the DB isolation check uses the committed EXAMPLE config (no real
 * brand). Run: pnpm verify:prospect-1
 *
 *   1. The mechanism is committed + generic: prospects/ is gitignored, NOTHING is
 *      tracked under prospects/, "prospects" is excluded from the SEED.1 marque scan,
 *      and every committed mechanism file is marque-free (verify:seed-1 stays green).
 *   2. Isolation (DB): a prospect org seeded via the mechanism is invisible from
 *      another org, and cannot see the other org's data (dbForOrg both ways).
 *
 * (The rich, prospect-specific checks — the MISPICK-118 ripple, memory recall,
 * branding — run LOCALLY only, with the untracked prospects/<name>/ config present;
 * they are intentionally NOT in this committed verify.)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BANNED_RE, scanForMarques } from "./lib/anonymization";
import exampleConfig from "./fixtures/prospect-example/prospect.config";

const EXAMPLE_ORG_ID = "org_prospect_example";
const DEMO_ORG_ID = "org_axona_demo";

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

async function run(): Promise<void> {
  console.log(
    "\nVerifying PROSPECT.1 — generic prospect-demo tenant mechanism\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1. committed + generic + marque-free ──
  await check("prospects/ is gitignored", () => {
    const gi = read(".gitignore");
    return /^\/?prospects\/?\s*$/m.test(gi);
  });
  await check(
    "NOTHING is tracked under prospects/ (no prospect brand committed)",
    () => {
      const tracked = execSync("git ls-files prospects/", { cwd: root })
        .toString()
        .trim();
      if (tracked) console.log("      tracked under prospects/:", tracked);
      return tracked.length === 0;
    },
  );
  await check('"prospects" is excluded from the SEED.1 marque scan', () => {
    const anon = read("src/scripts/lib/anonymization.ts");
    return /"prospects"/.test(anon); // present in IGNORE_DIRS
  });
  await check("the generic mechanism files are marque-free", () => {
    const files = [
      "packages/db/src/prospect/types.ts",
      "src/scripts/lib/prospect-seed.ts",
      "src/scripts/seed-prospect.ts",
      "src/scripts/fixtures/prospect-example/prospect.config.ts",
      "src/scripts/verify-prospect-1.ts",
      "docs/prospect-demo.md",
    ];
    const dirty = files.filter((f) => BANNED_RE.test(read(f)));
    if (dirty.length) console.log("      marque in:", dirty);
    return dirty.length === 0;
  });
  await check(
    "verify:seed-1 scope stays clean (no marque in apps/packages/exports/docs)",
    () => {
      return (
        scanForMarques(root, ["apps", "packages", "exports", "docs"]).length ===
        0
      );
    },
  );

  // ── 2. isolation (DB) ──
  if (!process.env.DATABASE_URL) {
    console.log("  SKIP isolation check — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static only)`);
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { seedProspectOrg, clearOrgData } = await import("./lib/prospect-seed");
  try {
    await seedProspectOrg(exampleConfig, {
      configDir: join(root, "src/scripts/fixtures/prospect-example"),
    });

    const prospectDb = dbForOrg(EXAMPLE_ORG_ID);
    const demoDb = dbForOrg(DEMO_ORG_ID);

    await check(
      "prospect org seeded its own data (visible within the org)",
      async () => {
        const supplier = await prospectDb.supplier.findFirst({
          where: { name: "Example Supplier Co" },
        });
        const ncr = await prospectDb.nCR.findFirst({
          where: { code: "PX-001" },
        });
        return !!supplier && !!ncr;
      },
    );

    await check(
      "isolation: the demo org CANNOT see the prospect org's data",
      async () => {
        const leaked = await demoDb.supplier.findFirst({
          where: { name: "Example Supplier Co" },
        });
        const leakedNcr = await demoDb.nCR.findFirst({
          where: { code: "PX-001" },
        });
        return leaked === null && leakedNcr === null;
      },
    );

    await check(
      "isolation: the prospect org CANNOT see the demo org's SPECIFIC rows",
      async () => {
        // PROSPECT.3: the prospect now carries the full base narrative, so it has its
        // OWN "Tier-1 Actuator Co" + NCR-118 (org-scoped copies, different rows). True
        // isolation = the prospect's scoped client cannot retrieve the DEMO's specific
        // rows (by id) — org-scoping injects the prospect orgId, so a demo id never matches.
        const demoSupplier = await demoDb.supplier.findFirst({
          where: { name: "Tier-1 Actuator Co" },
          select: { id: true },
        });
        const demoNcr = await demoDb.nCR.findFirst({
          where: { code: "NCR-118" },
          select: { id: true },
        });
        const prospectSeesDemoSupplier = demoSupplier
          ? await prospectDb.supplier.findFirst({
              where: { id: demoSupplier.id },
            })
          : null;
        const prospectSeesDemoNcr = demoNcr
          ? await prospectDb.nCR.findFirst({ where: { id: demoNcr.id } })
          : null;
        return (
          prospectSeesDemoSupplier === null && prospectSeesDemoNcr === null
        );
      },
    );
  } finally {
    // self-clean: remove the example org entirely (MIGRATE.1)
    await clearOrgData(EXAMPLE_ORG_ID);
    await prisma.org.delete({ where: { id: EXAMPLE_ORG_ID } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
