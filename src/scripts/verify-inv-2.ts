/**
 * Verify INV.2 — Inventory screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:inv-2
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
  console.log("\nVerifying INV.2 — Inventory screen\n");

  const view = read(join(base, "components/inventory/InventoryView.tsx"));

  await check(
    "route + component + format exist",
    () =>
      existsSync(join(base, "app/(shell)/inventory/page.tsx")) &&
      !!view &&
      existsSync(join(base, "components/inventory/format.ts")),
  );
  await check("binds getInventoryData; uses shared StatStrip (UX.1)", () => {
    const page = read(join(base, "app/(shell)/inventory/page.tsx"));
    return (
      /getInventoryData/.test(page) &&
      /from "@\/components\/shell\/StatStrip"/.test(view) &&
      /<StatStrip/.test(view)
    );
  });
  await check(
    "renders the four artifacts (stock-by-location · critical parts · edge caches · trace)",
    () => {
      return (
        /Stock by location/.test(view) &&
        /Critical parts/.test(view) &&
        /Field edge caches/.test(view) &&
        /criticalParts/.test(view) &&
        /stockByLocation/.test(view) &&
        /edgeCaches/.test(view) &&
        /TraceConsole/.test(view)
      );
    },
  );
  await check(
    "read-only screen — no mutations / no fabricated RMA numbers",
    () => {
      return (
        !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
          view,
        ) &&
        // RMA is deferred, not fabricated (no invented "14 open" etc.)
        /DEFERRED/.test(view) &&
        /not yet modeled/.test(view)
      );
    },
  );
  await check(
    "no invented reds (attention states carry ink, green = healthy/stocked)",
    () => {
      const fmt = read(join(base, "components/inventory/format.ts"));
      return (
        /REORDER: \{ cls: "bg-ink-strong/.test(fmt) &&
        /QUARANTINE: \{ cls: "bg-ink-strong/.test(fmt) &&
        /HEALTHY: \{ cls: "bg-success-tint/.test(fmt) &&
        !/\bbg-red|text-red|border-red\b/.test(fmt + view)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getInventoryData } = await import("../../apps/web/lib/inventory");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getInventoryData(org.id);

      await check(
        "critical-parts + stock-by-location + spares + rollup bind",
        () => {
          return (
            data.criticalParts.length >= 4 &&
            data.stockByLocation.length >= 3 &&
            data.edgeCaches.length >= 2 &&
            data.rollup.totalValueUsd > 0 &&
            data.rollup.sparesNearFleet > 0
          );
        },
      );
      await check("SERVO-204 shows REORDER tied to an incoming PO", () => {
        const p = data.criticalParts.find((x) => /SERVO-204/.test(x.sku));
        return (
          p?.status === "REORDER" &&
          p.reorderNeeded &&
          p.incomingPo != null &&
          /^PO-/.test(p.incomingPo.code)
        );
      });
      await check("Osaka edge cache reads REPLENISH (below min)", () => {
        const osaka = data.edgeCaches.find((e) => /Osaka/i.test(e.location));
        return !!osaka && osaka.state === "REPLENISH" && osaka.belowMin;
      });
      await check(
        "inv-orchestrator trace exists to replay in the console",
        async () => {
          const runAgent = await prisma.agentRun.findFirst({
            where: { agent: { orgId: org.id, moduleKey: "inventory" } },
            orderBy: { createdAt: "desc" },
          });
          const lines = Array.isArray(runAgent?.trace)
            ? (runAgent.trace as { text?: string }[])
            : [];
          return (
            lines.length > 0 &&
            lines.some((l) => /SERVO-204|Osaka/i.test(l.text ?? ""))
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
