/**
 * Verify ENG.1 — Engineering data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:eng-1
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
  console.log("\nVerifying ENG.1 — Engineering data/API\n");

  await check(
    "routes exist (ecos / firmware / compat)",
    () =>
      existsSync(join(base, "app/api/engineering/ecos/route.ts")) &&
      existsSync(join(base, "app/api/engineering/firmware/route.ts")) &&
      existsSync(join(base, "app/api/engineering/compat/route.ts")),
  );

  const lib = read(join(base, "lib/engineering.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getEngineeringData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["ecos", "firmware", "compat"]
      .map((r) => read(join(base, `app/api/engineering/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

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

      await check("ecos incl ECO-316 + ECO-314 beside ECO-318", () => {
        const codes = data.ecos.map((e) => e.code);
        return ["ECO-318", "ECO-316", "ECO-314"].every((c) =>
          codes.includes(c),
        );
      });
      await check("ECO-318 in REVIEW, references NCR-118", () => {
        const eco = data.ecos.find((e) => e.code === "ECO-318");
        return !!eco && eco.stage === "REVIEW" && /NCR-118/.test(eco.affected);
      });
      await check(
        "firmwareReleases present (v4.2.2-rc RC · v4.2.1 · v4.1.0)",
        () =>
          data.firmwareReleases.some(
            (f) => f.version === "v4.2.2-rc" && f.state === "RC",
          ) &&
          data.firmwareReleases.some((f) => f.version === "v4.2.1") &&
          data.firmwareReleases.some((f) => f.version === "v4.1.0"),
      );
      await check("compatMatrix 4×4 axes + cells", () => {
        const m = data.compatMatrix;
        return (
          m.hwRevs.length >= 4 &&
          m.fwVersions.length >= 4 &&
          m.cells.length >= 12 &&
          m.hwRevs[0] === "HX-2 r4" && // rows newest-first
          m.fwVersions[0] === "v4.0.2" && // cols oldest-first
          m.cells.some((c) => c.state === "cert") &&
          m.cells.some((c) => c.state === "in-test")
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getEngineeringData("org_does_not_exist");
        return (
          empty.compatMatrix.cells.length === 0 &&
          empty.ecos.length === 0 &&
          empty.firmwareReleases.length === 0
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
