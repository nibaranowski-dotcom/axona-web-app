/**
 * Verify QUAL.2 — Quality screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:qual-2
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
  console.log("\nVerifying QUAL.2 — Quality screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/quality/page.tsx")) &&
      ["QualityView", "SpcChart", "DefectPareto", "CertList", "NcrTable"].every(
        (c) => existsSync(join(base, `components/quality/${c}.tsx`)),
      ),
  );

  await check("route renders getQualityData", () =>
    /getQualityData/.test(read(join(base, "app/(shell)/quality/page.tsx"))),
  );

  const spc = read(join(base, "components/quality/SpcChart.tsx"));
  await check(
    "SPC chart shows UCL/LCL/mean reference lines + a breach marker",
    () =>
      /ucl/i.test(spc) &&
      /lcl/i.test(spc) &&
      /mean/.test(spc) &&
      // out-of-control points rendered in ink (critical), not red
      /value > p\.ucl \|\| p\.value < p\.lcl/.test(spc) &&
      /var\(--ink-strong\)/.test(spc),
  );

  await check("read-only screen — no mutations in quality components", () => {
    const all = readdirSync(join(base, "components/quality"))
      .map((f) => read(join(base, "components/quality", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in quality components", () => {
    const all = readdirSync(join(base, "components/quality"))
      .map((f) => read(join(base, "components/quality", f)))
      .join("\n");
    return (
      !/\bred\b|#f00|ff0000/i.test(all) &&
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(all)
    );
  });

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
      await check("SPC series has a torque breach to render", () => {
        const s = data.spcSeries.find(
          (x) => x.characteristic === "drive_torque_Nm",
        );
        return (
          !!s &&
          s.breach &&
          s.points.some((p) => p.value > p.ucl || p.value < p.lcl)
        );
      });
      await check("NCR-118 present as a CRITICAL ncr", () =>
        data.ncrs.some(
          (n) => n.code === "NCR-118" && n.severity === "CRITICAL",
        ),
      );
      await check(
        "certs + defect pareto present",
        () => data.certs.length > 0 && data.defectPareto.length > 0,
      );
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
