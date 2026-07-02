/**
 * Verify ENG.2 — Engineering screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:eng-2
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  console.log("\nVerifying ENG.2 — Engineering screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/engineering/page.tsx")) &&
      ["EngineeringView", "EcoTable", "CompatMatrix", "FirmwareReleases"].every(
        (c) => existsSync(join(base, `components/engineering/${c}.tsx`)),
      ),
  );

  await check("route renders getEngineeringData", () =>
    /getEngineeringData/.test(
      read(join(base, "app/(shell)/engineering/page.tsx")),
    ),
  );

  await check(
    "change orders is a TABLE (ECO·Change·Type·Affected·Stage)",
    () => {
      const t = read(join(base, "components/engineering/EcoTable.tsx"));
      return (
        /ECO<\/span>/.test(t) &&
        /Change<\/span>/.test(t) &&
        /Type<\/span>/.test(t) &&
        /Affected<\/span>/.test(t) &&
        /Stage<\/span>/.test(t)
      );
    },
  );

  await check("compat matrix renders axes + cell states", () => {
    const t = read(join(base, "components/engineering/CompatMatrix.tsx"));
    return (
      /hwRevs/.test(t) &&
      /fwVersions/.test(t) &&
      /cert/.test(t) &&
      /in-test/.test(t)
    );
  });

  const actions = read(join(base, "app/(shell)/engineering/actions.ts"));
  await check(
    "advanceEco: requireRole FIRST, org-scoped, revalidates, AUDIT.3 seam",
    () =>
      /requireRole\(user, \["ENGINEER", "ADMIN"\]\)/.test(actions) &&
      /dbForOrg/.test(actions) &&
      /revalidatePath/.test(actions) &&
      /AUDIT\.3/.test(actions) &&
      actions.indexOf("requireRole(") < actions.indexOf("dbForOrg("),
  );
  await check(
    "release is the human step (APPROVED→RELEASED in the machine)",
    () => /APPROVED:\s*"RELEASED"/.test(actions),
  );

  await check(
    "no red · no emoji · no raw hex in engineering components",
    () => {
      const all = readdirSync(join(base, "components/engineering"))
        .map((f) => read(join(base, "components/engineering", f)))
        .join("\n");
      return (
        !/\bred\b|#f00|ff0000/i.test(all) &&
        !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
        !/#[0-9a-fA-F]{3,6}\b/.test(all)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getEngineeringData } =
      await import("../../apps/web/lib/engineering");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getEngineeringData(org.id);
      await check("ECO-318 present in Review", () =>
        data.ecos.some((e) => e.code === "ECO-318" && e.stage === "REVIEW"),
      );
      await check("compat matrix has axes + cells to render", () => {
        const m = data.compatMatrix;
        return (
          m.hwRevs.length >= 4 &&
          m.fwVersions.length >= 4 &&
          m.cells.length >= 12
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
