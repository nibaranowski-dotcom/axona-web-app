/**
 * Verify SEC.1 — Security data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:sec-1
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
  console.log("\nVerifying SEC.1 — Security data/API\n");

  await check(
    "routes exist (cves / posture)",
    () =>
      existsSync(join(base, "app/api/security/cves/route.ts")) &&
      existsSync(join(base, "app/api/security/posture/route.ts")),
  );

  const lib = read(join(base, "lib/security.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getSecurityData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "composes over FLEET.1 + ENG.1 (reuses shared libs)",
    () => /from "\.\/fleet"/.test(lib) && /from "\.\/engineering"/.test(lib),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams, agent-drafted only",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["cves", "posture"]
      .map((r) => read(join(base, `app/api/security/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getSecurityData } = await import("../../apps/web/lib/security");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getSecurityData(org.id);

      await check(
        "rollup binds (severity/status/units/posture/rollouts)",
        () => {
          const r = data.rollup;
          return (
            r.bySeverity.length >= 2 &&
            r.byStatus.length >= 2 &&
            r.unitsAffected > 0 &&
            r.bySeverity.reduce((n, s) => n + s.count, 0) ===
              data.cves.length &&
            typeof r.openRollouts === "number"
          );
        },
      );
      await check(
        "deployed-unit CVE (CVE-2026-3187) affects real units",
        () => {
          const cve = data.cves.find((c) => c.code === "CVE-2026-3187");
          return (
            !!cve &&
            cve.affectedUnits > 0 &&
            cve.affectsDeployed === true &&
            cve.status.toUpperCase() === "PATCH_DRAFTED"
          );
        },
      );
      await check(
        "signed-firmware patch resolves through the ENG cert gate",
        () => {
          const p = data.patchRollouts.find((x) => /rc/i.test(x.firmwareState));
          return (
            !!p &&
            /v4\.2\.2/.test(p.version) &&
            p.forCve === "CVE-2026-3187" &&
            p.targetUnits > 0 &&
            (p.certGate === "in-test" || p.certGate === "cert") &&
            p.gated === (p.certGate !== "cert")
          );
        },
      );
      await check("device posture spreads over the fleet", () => {
        const total = data.devicePosture.reduce((n, b) => n + b.count, 0);
        return (
          data.devicePosture.length >= 2 &&
          total >= 6 &&
          data.devicePosture.some((b) => b.bucket === "Hardened")
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getSecurityData("org_does_not_exist");
        return (
          empty.cves.length === 0 &&
          empty.devicePosture.length === 0 &&
          empty.rollup.unitsAffected === 0
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
