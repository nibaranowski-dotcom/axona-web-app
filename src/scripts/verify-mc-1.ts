/**
 * Verify MC.1 — Mission Control launcher.
 * Run: pnpm verify:mc-1   (data checks require a seeded DB / DATABASE_URL)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function check(
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying MC.1 — Mission Control launcher\n");

  const page = read(join(base, "app/page.tsx")); // DS.1: launcher at root
  await check(
    "launcher page replaces placeholder",
    () => /Launcher/.test(page) && !/TODO MC\.1/.test(page),
  );
  await check(
    "AppTile + Launcher components exist",
    () =>
      existsSync(join(base, "components/core/Launcher.tsx")) &&
      existsSync(join(base, "components/core/AppTile.tsx")),
  );
  await check("moduleMeta map present", () =>
    /moduleMeta/.test(read(join(base, "lib/module-meta.ts"))),
  );
  await check("alerts scoped via dbForOrg", () =>
    /dbForOrg/.test(read(join(base, "lib/module-alerts.ts"))),
  );
  await check(
    "alert chip is lime accent (no red) — DS.1 dark launchpad",
    () => {
      const t = read(join(base, "components/core/AppTile.tsx"));
      return /bg-accent/.test(t) && !/#?(red|f00|ff0000)/i.test(t);
    },
  );
  await check("search field routes to /search", () =>
    /\/search/.test(read(join(base, "components/core/Launcher.tsx"))),
  );
  await check("no emoji / no raw hex in core components", () => {
    const t =
      read(join(base, "components/core/Launcher.tsx")) +
      read(join(base, "components/core/AppTile.tsx"));
    return (
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(t)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { getModuleAlerts } =
      await import("../../apps/web/lib/module-alerts");
    const { prisma } = await import("@axona/db");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    await check(
      "alerts present where narrative implies (quality/fleet/finance/procurement)",
      async () => {
        if (!org) return false;
        const a = await getModuleAlerts(org.id);
        return (
          (a.quality ?? 0) >= 1 &&
          (a.fleet ?? 0) >= 1 &&
          (a.finance ?? 0) >= 1 &&
          (a.procurement ?? 0) >= 1
        );
      },
    );
    await check("every moduleMeta key matches a seeded module", async () => {
      const { moduleMeta } = await import("../../apps/web/lib/module-meta");
      const keys = new Set(
        (await prisma.module.findMany({ select: { key: true } })).map(
          (m) => m.key,
        ),
      );
      return Object.keys(moduleMeta).every((k) => keys.has(k));
    });
    await prisma.$disconnect();
  }

  if (failed === 0) {
    console.log(`\nPASSED — ${passed} checks`);
  } else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

void run();
