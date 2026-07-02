/**
 * Verify LEGAL.2 — Legal screen. Static checks always run; data checks are gated
 * on DATABASE_URL. Run: pnpm verify:legal-2
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
  console.log("\nVerifying LEGAL.2 — Legal screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/legal/page.tsx")) &&
      ["LegalView", "ObligationsPanel", "ExportControl", "MattersTable"].every(
        (c) => existsSync(join(base, `components/legal/${c}.tsx`)),
      ),
  );

  await check("route renders getLegalData", () =>
    /getLegalData/.test(read(join(base, "app/(shell)/legal/page.tsx"))),
  );

  await check("obligations panel tracks state vs live ops", () => {
    const t = read(join(base, "components/legal/ObligationsPanel.tsx"));
    return (
      /obligation/i.test(t) && /actual/.test(t) && /obligationBadge/.test(t)
    );
  });

  await check("matters table links to the source module", () => {
    const t = read(join(base, "components/legal/MattersTable.tsx"));
    return /module/.test(t) && /linkedTo/.test(t) && /Linked to/.test(t);
  });

  await check("read-only screen — no mutations in legal components", () => {
    const all = readdirSync(join(base, "components/legal"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/legal", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in legal components", () => {
    const all = readdirSync(join(base, "components/legal"))
      .map((f) => read(join(base, "components/legal", f)))
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
    const { getLegalData } = await import("../../apps/web/lib/legal");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getLegalData(org.id);
      await check("BMW SLA at-risk + DLV-3312 EAR99 hold surface", () => {
        const bmw = data.obligations.find((o) => o.account === "BMW");
        const dlv = data.exportLicenses.find((e) => /DLV-3312/.test(e.code));
        return bmw?.atRisk === true && dlv?.onHold === true;
      });
      await check("ECO-318 + INC-201 matters link to their modules", () => {
        const eco = data.legalMatters.find((m) => m.linkedTo === "ECO-318");
        const inc = data.legalMatters.find((m) => m.linkedTo === "INC-201");
        return eco?.module === "engineering" && inc?.module === "autonomy";
      });
      await check(
        "renders full — ≥3 obligations, ≥3 licenses, ≥4 matters",
        () => {
          return (
            data.obligations.length >= 3 &&
            data.exportLicenses.length >= 3 &&
            data.legalMatters.length >= 4
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
