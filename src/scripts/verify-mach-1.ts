/**
 * Verify MACH.1 — Machines read model + screen. Static checks always run; data
 * checks are gated on DATABASE_URL. Run: pnpm verify:mach-1
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
  console.log("\nVerifying MACH.1 — Machines read model + screen\n");

  await check(
    "route + component + routes exist",
    () =>
      existsSync(join(base, "app/(shell)/machines/page.tsx")) &&
      existsSync(join(base, "components/machines/MachinesView.tsx")) &&
      existsSync(join(base, "app/api/machines/route.ts")) &&
      existsSync(join(base, "app/api/machines/summary/route.ts")),
  );

  const lib = read(join(base, "lib/machines.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getMachinesData/.test(lib) &&
      /listMachines/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["route.ts", "summary/route.ts"]
      .map((r) => read(join(base, `app/api/machines/${r}`)))
      .join("\n");
    const view = read(join(base, "components/machines/MachinesView.tsx"));
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes + view,
    );
  });
  await check("screen renders both groups + the needs-service filter", () => {
    const v = read(join(base, "components/machines/MachinesView.tsx"));
    return (
      /getMachinesData/.test(
        read(join(base, "app/(shell)/machines/page.tsx")),
      ) &&
      /needsService/.test(v) &&
      /needsOnly/.test(v) &&
      /Needs service/.test(v)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getMachinesData, listMachines } =
      await import("../../apps/web/lib/machines");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getMachinesData(org.id);

      await check("groups Fixed + Mobile, both populated", () => {
        const fixed = data.groups.find((g) => g.kind === "FIXED");
        const mobile = data.groups.find((g) => g.kind === "MOBILE");
        return (
          !!fixed &&
          !!mobile &&
          fixed.machines.length >= 3 &&
          mobile.machines.length >= 3 &&
          data.rollup.total >= 15
        );
      });
      await check("needs-service flag + rollup bind", () => {
        const r = data.rollup;
        const flagged = data.groups
          .flatMap((g) => g.machines)
          .filter((m) => m.needsService).length;
        return (
          r.needsService >= 1 &&
          r.needsService === flagged &&
          r.running >= 1 &&
          r.avgUtilization > 0 &&
          r.telemetryOnline >= 1
        );
      });
      await check("machines carry telemetry signals (cells populate)", () => {
        const withSignal = data.groups
          .flatMap((g) => g.machines)
          .filter((m) => m.latestSignal != null).length;
        return withSignal >= data.rollup.total - 2; // most have a signal
      });
      await check("listMachines paginates + filters by kind", async () => {
        const page = await listMachines(org.id, { take: 5 });
        const mobile = await listMachines(org.id, { kind: "MOBILE" });
        return (
          page.items.length <= 5 &&
          "nextCursor" in page &&
          mobile.items.every((m) => m.kind === "MOBILE") &&
          mobile.items.length >= 3
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getMachinesData("org_does_not_exist");
        return empty.groups.length === 0 && empty.rollup.total === 0;
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
