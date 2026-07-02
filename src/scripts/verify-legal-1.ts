/**
 * Verify LEGAL.1 — Legal data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:legal-1
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

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying LEGAL.1 — Legal data/API\n");

  await check(
    "routes exist (obligations / export-licenses / matters)",
    () =>
      existsSync(join(base, "app/api/legal/obligations/route.ts")) &&
      existsSync(join(base, "app/api/legal/export-licenses/route.ts")) &&
      existsSync(join(base, "app/api/legal/matters/route.ts")),
  );

  const lib = read(join(base, "lib/legal.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getLegalData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["obligations", "export-licenses", "matters"]
      .map((r) => read(join(base, `app/api/legal/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getLegalData } = await import("../../apps/web/lib/legal");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getLegalData(org.id);

      await check("BMW 99.5% fleet SLA obligation is AT_RISK", () => {
        const o = data.obligations.find((x) => x.account === "BMW");
        return (
          !!o &&
          /99\.5%/.test(o.obligation) &&
          o.atRisk === true &&
          o.state.toUpperCase() === "AT_RISK"
        );
      });
      await check("DLV-3312 EAR99 export license is on HOLD", () => {
        const e = data.exportLicenses.find((x) => /DLV-3312/.test(x.code));
        return (
          !!e && /EAR99/.test(e.code) && e.onHold === true && e.state === "HOLD"
        );
      });
      await check("ECO-318 patent (IP) matter linked to engineering", () => {
        const m = data.legalMatters.find((x) => x.linkedTo === "ECO-318");
        return (
          !!m &&
          m.type === "IP" &&
          m.module === "engineering" &&
          m.open === true
        );
      });
      await check("INC-201 liability matter linked to autonomy", () => {
        const m = data.legalMatters.find((x) => x.linkedTo === "INC-201");
        return (
          !!m &&
          m.type === "LIABILITY" &&
          m.module === "autonomy" &&
          m.open === true
        );
      });
      await check(
        "rollup (obligations at-risk / export holds / open matters)",
        () =>
          data.rollup.obligationsAtRisk >= 1 &&
          data.rollup.exportHolds >= 1 &&
          data.rollup.openMatters >= 2,
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getLegalData("org_does_not_exist");
        return (
          empty.obligations.length === 0 &&
          empty.exportLicenses.length === 0 &&
          empty.legalMatters.length === 0 &&
          empty.rollup.openMatters === 0
        );
      });
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
