/**
 * Verify QUAL.1 — Quality data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:qual-1
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
  console.log("\nVerifying QUAL.1 — Quality data/API\n");

  await check(
    "routes exist (spc / ncrs / certs)",
    () =>
      existsSync(join(base, "app/api/quality/spc/route.ts")) &&
      existsSync(join(base, "app/api/quality/ncrs/route.ts")) &&
      existsSync(join(base, "app/api/quality/certs/route.ts")),
  );

  const lib = read(join(base, "lib/quality.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getQualityData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["spc", "ncrs", "certs"]
      .map((r) => read(join(base, `app/api/quality/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });
  await check(
    "UCL/LCL compare via $queryRaw (orgId pinned)",
    () => /\$queryRaw/.test(lib) && /value > ucl OR value < lcl/.test(lib),
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getQualityData } = await import("../../apps/web/lib/quality");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getQualityData(org.id);

      await check(
        "spcSeries grouped with breach flag (drive_torque_Nm breaches UCL)",
        () => {
          const s = data.spcSeries.find(
            (x) => x.characteristic === "drive_torque_Nm",
          );
          if (!s || !s.breach || s.points.length < 2) return false;
          // ordered by ts ascending
          const ordered = s.points.every(
            (p, i) =>
              i === 0 ||
              new Date(p.ts).getTime() >=
                new Date(s.points[i - 1]!.ts).getTime(),
          );
          const outOfControl = s.points.some(
            (p) => p.value > s.ucl || p.value < s.lcl,
          );
          return ordered && outOfControl;
        },
      );
      await check("NCR-118 present as a CRITICAL ncr", () =>
        data.ncrs.some(
          (n) =>
            n.code === "NCR-118" &&
            n.severity === "CRITICAL" &&
            /lot 88421/.test(n.linkedTo),
        ),
      );
      await check(
        "certs present with audit-ready / expiring flags",
        () =>
          data.certs.length > 0 &&
          data.certs.every(
            (c) =>
              typeof c.auditReady === "boolean" &&
              typeof c.expiring === "boolean",
          ),
      );
      await check(
        "defectPareto present, descending, includes the NCR-118 defect",
        () =>
          data.defectPareto.length > 0 &&
          data.defectPareto.every(
            (b, i) => i === 0 || b.count <= data.defectPareto[i - 1]!.count,
          ) &&
          data.defectPareto.some((b) => /torque/i.test(b.defect)),
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getQualityData("org_does_not_exist");
        return empty.spcSeries.length === 0 && empty.ncrs.length === 0;
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
