/**
 * Verify FIELD.1 — Field Service data/API. Static checks always run; data checks
 * are gated on DATABASE_URL. Run: pnpm verify:field-1
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
  console.log("\nVerifying FIELD.1 — Field Service data/API\n");

  await check(
    "routes exist (work-orders / technicians)",
    () =>
      existsSync(join(base, "app/api/field/work-orders/route.ts")) &&
      existsSync(join(base, "app/api/field/technicians/route.ts")),
  );

  const lib = read(join(base, "lib/field-service.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getFieldServiceData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["work-orders", "technicians"]
      .map((r) => read(join(base, `app/api/field/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
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

      await check("WO-5521 present with a live SLA countdown", () => {
        const w = data.workOrders.find((x) => x.code === "WO-5521");
        return (
          !!w &&
          /SN-2196/.test(w.robotSerial) &&
          w.site === "Site-3" &&
          /battery/i.test(w.issue) &&
          w.slaMsLeft != null &&
          typeof w.slaBreached === "boolean" &&
          typeof w.dueSoon === "boolean"
        );
      });
      await check(
        "M. Osei present with an expiring cert (gates dispatch)",
        () => {
          const t = data.technicians.find((x) => x.name === "M. Osei");
          return (
            !!t && t.certExpiring === true && t.certs.some((c) => c.expiring)
          );
        },
      );
      await check("dispatch board — Osei's column carries WO-5521", () => {
        const col = data.board.find((c) => c.tech.name === "M. Osei");
        return !!col && col.workOrders.some((w) => w.code === "WO-5521");
      });
      await check(
        "SLA rollup (open / dueSoon / breached)",
        () =>
          typeof data.sla.open === "number" &&
          typeof data.sla.dueSoon === "number" &&
          typeof data.sla.breached === "number" &&
          data.sla.open >= 1,
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getFieldServiceData("org_does_not_exist");
        return (
          empty.workOrders.length === 0 &&
          empty.technicians.length === 0 &&
          empty.board.length === 0 &&
          empty.sla.open === 0
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
