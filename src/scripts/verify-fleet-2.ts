/**
 * Verify FLEET.2 — Fleet screen. Static checks always run; data checks are gated
 * on DATABASE_URL. Run: pnpm verify:fleet-2
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
  console.log("\nVerifying FLEET.2 — Fleet screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/fleet/page.tsx")) &&
      [
        "FleetView",
        "FleetHealth",
        "DeploymentMap",
        "FirmwarePanel",
        "LiveUnits",
      ].every((c) => existsSync(join(base, `components/fleet/${c}.tsx`))),
  );

  await check("route renders getFleetData", () =>
    /getFleetData/.test(read(join(base, "app/(shell)/fleet/page.tsx"))),
  );

  await check(
    "deployment map projects lat/lng markers (signature artifact)",
    () => {
      const t = read(join(base, "components/fleet/DeploymentMap.tsx"));
      return (
        /lat/.test(t) && /lng/.test(t) && /left:/.test(t) && /top:/.test(t)
      );
    },
  );

  await check("live units render a telemetry sparkline", () => {
    const t = read(join(base, "components/fleet/LiveUnits.tsx"));
    return /polyline/.test(t) && /telemetry/i.test(t);
  });

  await check("read-only screen — no mutations in fleet components", () => {
    const all = readdirSync(join(base, "components/fleet"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/fleet", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in fleet components", () => {
    const all = readdirSync(join(base, "components/fleet"))
      .map((f) => read(join(base, "components/fleet", f)))
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
    const { getFleetData } = await import("../../apps/web/lib/fleet");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFleetData(org.id);
      await check("SN-2196 on the map (WATCH, has lat/lng)", () => {
        const r = data.robots.find((x) => x.serial === "SN-2196");
        return !!r && r.status === "WATCH" && r.lat != null && r.lng != null;
      });
      await check(
        "SN-2196 on the predictive-alert list (→ Field Service)",
        () => data.alerts.some((a) => a.serial === "SN-2196"),
      );
      await check("fleet renders full — ≥3 sites, ≥3 statuses", () => {
        const sites = new Set(data.robots.map((r) => r.site));
        const statuses = new Set(data.robots.map((r) => r.status));
        return sites.size >= 3 && statuses.size >= 3 && data.robots.length >= 6;
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
