/**
 * Verify SEC.2 — Security screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:sec-2
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
  console.log("\nVerifying SEC.2 — Security screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/security/page.tsx")) &&
      [
        "SecurityView",
        "PosturePanel",
        "AccessPanel",
        "VulnerabilitiesTable",
      ].every((c) => existsSync(join(base, `components/security/${c}.tsx`))),
  );

  await check("route renders getSecurityData + getAccessGrants", () => {
    const t = read(join(base, "app/(shell)/security/page.tsx"));
    return /getSecurityData/.test(t) && /getAccessGrants/.test(t);
  });

  await check(
    "CVE-triage vulnerabilities table binds the cert-gate remediation",
    () => {
      const t = read(
        join(base, "components/security/VulnerabilitiesTable.tsx"),
      );
      return /patchRollouts/.test(t) && /forCve/.test(t) && /certGate/.test(t);
    },
  );

  await check("posture + access panels bind SEC.1 data", () => {
    const pp = read(join(base, "components/security/PosturePanel.tsx"));
    const ap = read(join(base, "components/security/AccessPanel.tsx"));
    return /PostureBucket/.test(pp) && /AccessGrant/.test(ap);
  });

  await check("read-only screen — no mutations in security components", () => {
    const all = readdirSync(join(base, "components/security"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/security", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in security components", () => {
    const all = readdirSync(join(base, "components/security"))
      .map((f) => read(join(base, "components/security", f)))
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
    const { getSecurityData, getAccessGrants } =
      await import("../../apps/web/lib/security");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getSecurityData(org.id);
      const access = await getAccessGrants(org.id);

      await check("CVE triage + posture render full", () => {
        return (
          data.cves.length >= 4 &&
          data.devicePosture.length >= 2 &&
          data.rollup.bySeverity.length >= 2
        );
      });
      await check(
        "CVE-2026-3187 → v4.2.2-rc resolves through the ENG cert gate on-screen",
        () => {
          const cve = data.cves.find((c) => c.code === "CVE-2026-3187");
          const rollout = data.patchRollouts.find(
            (p) => p.forCve === "CVE-2026-3187",
          );
          // the remediation cell renders `${version} · ${certGate}` for this CVE
          return (
            !!cve &&
            cve.affectsDeployed === true &&
            !!rollout &&
            /v4\.2\.2/.test(rollout.version) &&
            rollout.certGate === "in-test" &&
            rollout.gated === true
          );
        },
      );
      await check(
        "access panel renders (derived stand-in, no live write)",
        () => {
          return (
            access.length >= 3 &&
            access.some((a) => a.ok === false) && // the revoked stale token
            access.every((a) => ["HUMAN", "AGENT", "SVC"].includes(a.kind))
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
