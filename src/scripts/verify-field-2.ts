/**
 * Verify FIELD.2 — Field Service screen. Static checks always run; data checks
 * are gated on DATABASE_URL. Run: pnpm verify:field-2
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
  console.log("\nVerifying FIELD.2 — Field Service screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/field-service/page.tsx")) &&
      ["FieldServiceView", "DispatchBoard", "WorkOrderQueue"].every((c) =>
        existsSync(join(base, `components/field-service/${c}.tsx`)),
      ),
  );

  await check("route renders getFieldServiceData", () =>
    /getFieldServiceData/.test(
      read(join(base, "app/(shell)/field-service/page.tsx")),
    ),
  );

  await check(
    "dispatch board is a per-tech board + cert gate (signature)",
    () => {
      const t = read(join(base, "components/field-service/DispatchBoard.tsx"));
      return /board/.test(t) && /certExpiring/.test(t) && /initials/.test(t);
    },
  );

  await check("work-order queue shows a live SLA countdown", () => {
    const t = read(join(base, "components/field-service/WorkOrderQueue.tsx"));
    return /slaLabel/.test(t) && /SLA/.test(t) && /Unassigned/.test(t);
  });

  await check("read-only screen — no mutations in field components", () => {
    const all = readdirSync(join(base, "components/field-service"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/field-service", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in field components", () => {
    const all = readdirSync(join(base, "components/field-service"))
      .map((f) => read(join(base, "components/field-service", f)))
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
    const { getFieldServiceData } =
      await import("../../apps/web/lib/field-service");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFieldServiceData(org.id);
      await check("WO-5521 on Osei's column with a live SLA countdown", () => {
        const col = data.board.find((c) => c.tech.name === "M. Osei");
        const wo = col?.workOrders.find((w) => w.code === "WO-5521");
        return !!wo && wo.slaMsLeft != null && col!.tech.certExpiring === true;
      });
      await check(
        "board + queue render full (≥5 techs, ≥5 work orders)",
        () => {
          return data.technicians.length >= 5 && data.workOrders.length >= 5;
        },
      );
      await check(
        "queue spans statuses incl. an unassigned WO",
        () =>
          data.workOrders.some((w) => w.techId === null) &&
          new Set(data.workOrders.map((w) => w.status)).size >= 3,
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
