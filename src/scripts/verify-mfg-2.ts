/**
 * Verify MFG.2 — Manufacturing screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:mfg-2
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
  console.log("\nVerifying MFG.2 — Manufacturing screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/manufacturing/page.tsx")) &&
      ["MfgView", "LineFlowBoard", "BuildGenealogy", "ThroughputPanel"].every(
        (c) => existsSync(join(base, `components/manufacturing/${c}.tsx`)),
      ),
  );

  await check("route renders getManufacturingData + getGenealogy", () => {
    const t = read(join(base, "app/(shell)/manufacturing/page.tsx"));
    return /getManufacturingData/.test(t) && /getGenealogy/.test(t);
  });

  await check("line-flow board is the station pipeline (signature)", () => {
    const t = read(join(base, "components/manufacturing/LineFlowBoard.tsx"));
    return /LINE_STATIONS/.test(t) && /nodeState/.test(t) && /lineFlow/.test(t);
  });

  await check(
    "build-genealogy shows the as-built trace + ONT.2 pointer",
    () => {
      const t = read(join(base, "components/manufacturing/BuildGenealogy.tsx"));
      return /GenealogyStep/.test(t) && /as-built/i.test(t) && /ONT\.2/.test(t);
    },
  );

  await check("read-only screen — no mutations in mfg components", () => {
    const all = readdirSync(join(base, "components/manufacturing"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/manufacturing", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in mfg components", () => {
    const all = readdirSync(join(base, "components/manufacturing"))
      .map((f) => read(join(base, "components/manufacturing", f)))
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
    const { getManufacturingData, getGenealogy } =
      await import("../../apps/web/lib/manufacturing");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getManufacturingData(org.id);
      await check("line renders full — units across ≥4 stations", () => {
        const active = data.lineFlow.filter((s) => s.count > 0);
        return active.length >= 4 && data.throughput.total >= 10;
      });
      await check(
        "SERVO-205 clean unit — full multi-station as-built trace",
        async () => {
          const g = await getGenealogy(org.id, "HX2-0221");
          return (
            g.steps.length >= 5 &&
            g.steps.every(
              (s, i) => i === 0 || s.order >= g.steps[i - 1]!.order,
            ) &&
            g.steps.every((s) => s.status.toUpperCase() === "DONE")
          );
        },
      );
      await check(
        "lot-88421 defect unit — trace ends HOLD at Test",
        async () => {
          const g = await getGenealogy(org.id, "HX2-0208");
          const last = g.steps[g.steps.length - 1];
          return (
            g.steps.length >= 4 &&
            last?.station === "Test" &&
            last?.status.toUpperCase() === "HOLD"
          );
        },
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
