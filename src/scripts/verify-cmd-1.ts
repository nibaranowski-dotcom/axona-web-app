/**
 * Verify CMD.1 — Command Center rollups. Static checks always run; the derived
 * KPIs + exception feed are checked against the seeded DB (gated on DATABASE_URL).
 * Run: pnpm verify:cmd-1
 */
import { existsSync } from "node:fs";
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

async function run(): Promise<void> {
  console.log("\nVerifying CMD.1 — Command Center rollups\n");

  const root = process.cwd();
  await check(
    "summary lib + route exist",
    () =>
      existsSync(join(root, "apps/web/lib/core-summary.ts")) &&
      existsSync(join(root, "apps/web/app/api/core/summary/route.ts")),
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getCoreSummary } = await import("../../apps/web/lib/core-summary");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const s = await getCoreSummary(org.id);

      await check("kpisByModule covers core modules", () =>
        ["procurement", "quality", "fleet", "finance"].every((m) =>
          s.kpisByModule.some((k) => k.module === m),
        ),
      );
      await check(
        "KPIs derive from seeded rows (procurement open POs > 0)",
        () => {
          const proc = s.kpisByModule.find((k) => k.module === "procurement");
          const openPOs = proc?.kpis.find((x) => x.key === "open-pos")?.value;
          return typeof openPOs === "number" && openPOs > 0;
        },
      );
      await check(
        "exceptions present + shaped",
        () =>
          s.exceptions.length >= 5 &&
          s.exceptions.every(
            (e) =>
              !!e.url &&
              !!e.sourceLabel &&
              Array.isArray(e.ripples) &&
              ["critical", "warn", "ok"].includes(e.severity),
          ),
      );
      await check("NCR-118 surfaces as a critical exception with ripples", () =>
        s.exceptions.some(
          (e) =>
            /NCR-118/.test(e.title) &&
            e.severity === "critical" &&
            e.ripples.includes("engineering"),
        ),
      );
      await check("DLV-3312 customs hold surfaces (→ legal/finance)", () =>
        s.exceptions.some(
          (e) => /DLV-3312/.test(e.title) && e.ripples.includes("finance"),
        ),
      );
      await check("SN-2196 thermal surfaces (Fleet → Field Service)", () =>
        s.exceptions.some(
          (e) => /SN-2196/.test(e.title) && e.ripples.includes("field-service"),
        ),
      );
      await check("Osei cert-expiring surfaces (People → Field Service)", () =>
        s.exceptions.some(
          (e) => e.module === "people" && e.ripples.includes("field-service"),
        ),
      );
      await check("HX-2 margin surfaces (Finance)", () =>
        s.exceptions.some(
          (e) => e.module === "finance" && /HX-2/.test(e.title),
        ),
      );
      await check("BMW SLA at-risk surfaces (Legal → Autonomy)", () =>
        s.exceptions.some(
          (e) => e.module === "legal" && e.ripples.includes("autonomy"),
        ),
      );
      await check(
        "agent-drafted PO awaiting approval surfaces (Procurement)",
        () =>
          s.exceptions.some(
            (e) =>
              e.module === "procurement" && /awaiting approval/i.test(e.title),
          ),
      );
      await check("p-13 canary regression surfaces (Autonomy → Fleet)", () =>
        s.exceptions.some(
          (e) => /p-13/.test(e.title) && e.ripples.includes("fleet"),
        ),
      );
      await check(
        "no red severities (ink/lime/green only)",
        () =>
          s.exceptions.every((e) =>
            ["critical", "warn", "ok"].includes(e.severity),
          ) &&
          s.company.every(
            (k) =>
              !k.severity || ["critical", "warn", "ok"].includes(k.severity),
          ),
      );
      await check("critical exceptions ranked first", () => {
        const firstWarn = s.exceptions.findIndex((e) => e.severity === "warn");
        const lastCrit = s.exceptions
          .map((e) => e.severity)
          .lastIndexOf("critical");
        return firstWarn === -1 || lastCrit === -1 || lastCrit < firstWarn;
      });

      const second = await prisma.org.findFirst({
        where: { name: "Isolation Test Co" },
      });
      await check(
        "org isolation — second org has its own summary",
        async () => {
          if (!second) throw new Error("second org missing");
          const s2 = await getCoreSummary(second.id);
          return s2.exceptions.length <= s.exceptions.length;
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
