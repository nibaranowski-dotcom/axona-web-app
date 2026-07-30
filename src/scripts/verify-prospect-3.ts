/**
 * Verify PROSPECT.3 — prospect tenants fully populated (all modules) + per-tenant logo.
 * Run: pnpm verify:prospect-3
 *
 *   1. Seeding a throwaway prospect org populates a representative set of NON-PLM
 *      modules (procurement POs · quality NCRs/SPC · sales deals · fleet units ·
 *      finance invoices · inventory · manufacturing · audit · notifications) — reusing
 *      the base generators, org-scoped.
 *   2. Isolation: a 2nd org sees ZERO of the prospect's data; the demo org is untouched.
 *   3. Per-tenant logo: a config with a LOCAL logo path uploads a FILE.1 blob, sets
 *      org.logoKey, and presignedGetUrl(logoKey) resolves a URL (the sidebar's source).
 *   4. Self-cleaning: the throwaway org + its blob are removed.
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

const THROWAWAY = "org_prospect3_verify";
const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

// A 1×1 transparent PNG (base64) — a real, valid image byte stream for the logo test.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function run(): Promise<void> {
  console.log(
    "\nVerifying PROSPECT.3 — prospect tenants fully populated + logo\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const tenant = read("packages/db/prisma/seed/tenant.ts");
  const runner = read("src/scripts/lib/prospect-seed.ts");

  // ── static: reuse the base generators (no parallel dataset); logo is local + SEED.1-safe ──
  await check(
    "seedTenantModules reuses the base per-module generators (no parallel dataset)",
    () => {
      return (
        /seedValueChain\(/.test(tenant) &&
        /seedRobotics\(/.test(tenant) &&
        /seedBackOffice\(/.test(tenant) &&
        /seedInventory\(/.test(tenant) &&
        // excluded on purpose (owned elsewhere): users · agents · plm · ontology.
        // Check for CALLS (with paren), not the words in the exclusion comment.
        !/seedUsers\(|seedAgents\(|seedPlm\(|seedOntology\(/.test(tenant)
      );
    },
  );
  await check(
    "the prospect runner seeds the full narrative UNDER the config overlay + derives memory",
    () => {
      return (
        /seedTenantModules\(/.test(runner) &&
        /config\.seed\(/.test(runner) &&
        /ingestMemory\(/.test(runner)
      );
    },
  );
  await check(
    "logo is a LOCAL path (abs / ~ / config-relative), uploaded at seed time via S3 (SEED.1: never committed)",
    () => {
      return (
        /homedir\(\)/.test(runner) &&
        /putObject\(/.test(runner) &&
        /s3Configured\(\)/.test(runner) &&
        /logoKey: key/.test(runner)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { seedProspectOrg, clearOrgData } = await import("./lib/prospect-seed");
  const { prisma, dbForOrg, presignedGetUrl, s3Configured, deleteObject } =
    await import("@axona/db");

  // Build a throwaway prospect config with a no-op overlay + a local logo asset.
  const dir = mkdtempSync(join(tmpdir(), "prospect3-"));
  const logoPath = join(dir, "logo.png");
  writeFileSync(logoPath, Buffer.from(PNG_1x1, "base64"));
  const s3Up = s3Configured();

  const config = {
    orgId: THROWAWAY,
    name: "Prospect3 Verify Co",
    slug: "prospect3-verify",
    industry: "Mobility & AVs",
    logoFile: s3Up ? logoPath : undefined, // absolute LOCAL path (outside the repo)
    demoUser: {
      name: "Verify Demo",
      email: "demo@prospect3-verify.test",
      role: "ADMIN" as const,
      password: "verify-pw",
    },
    // a minimal identity/PLM overlay would go here; the base narrative already ran.
    async seed() {
      /* no-op overlay for the test */
    },
  };

  let result: { logoUploaded: boolean } | null = null;
  try {
    result = await seedProspectOrg(config, { configDir: dir });
    const db = dbForOrg(THROWAWAY);

    // ── 1: NON-PLM modules populated ──
    await check(
      "prospect org populated across NON-PLM modules (procurement · quality · sales · fleet · finance · …)",
      async () => {
        const c = {
          po: await db.purchaseOrder.count(),
          ncr: await db.nCR.count(),
          spc: await db.spcSample.count(),
          deal: await db.deal.count(),
          robot: await db.robot.count(),
          invoice: await db.invoice.count(),
          stock: await db.inventoryStock.count(),
          wo: await db.workOrderMfg.count(),
          audit: await db.auditLog.count(),
          notif: await db.notification.count(),
        };
        return Object.values(c).every((n) => n > 0);
      },
    );
    await check(
      "exactly one user (the prospect's demo login) — base team NOT copied",
      async () => {
        return (await db.user.count()) === 1;
      },
    );

    // ── 2: isolation — the prospect's rows never appear in another tenant's scope ──
    await check(
      "isolation: a 2nd org sees ZERO of the prospect's data; the demo org is untouched",
      async () => {
        const isoDeals = await dbForOrg(SECOND).deal.count();
        const isoPOs = await dbForOrg(SECOND).purchaseOrder.count();
        // the demo org keeps its OWN data (a healthy non-zero), never the prospect's.
        const demoDeals = await dbForOrg(DEMO).deal.count();
        // every prospect row is tagged to THROWAWAY, so a raw filter on another org id
        // returns none of them.
        const prospectDeals = await db.deal.count();
        const demoScopedProspectRows = await prisma.deal.count({
          where: {
            orgId: DEMO,
            id: {
              in: (await db.deal.findMany({ select: { id: true } })).map(
                (d) => d.id,
              ),
            },
          },
        });
        return (
          isoDeals === 0 &&
          isoPOs === 0 &&
          demoDeals > 0 &&
          prospectDeals > 0 &&
          demoScopedProspectRows === 0 // none of the prospect's rows are in the demo scope
        );
      },
    );

    // ── 3: per-tenant logo → logoKey → presigned URL (the sidebar's source) ──
    if (s3Up) {
      await check(
        "logo uploaded from the local path → org.logoKey set → presignedGetUrl resolves a URL",
        async () => {
          const org = await prisma.org.findUnique({
            where: { id: THROWAWAY },
            select: { logoKey: true },
          });
          if (!org?.logoKey) return false;
          const url = await presignedGetUrl(org.logoKey);
          return (
            result!.logoUploaded === true &&
            /^https?:\/\//.test(url) &&
            url.includes(THROWAWAY) // the org's blob prefix
          );
        },
      );
    } else {
      console.log(
        "  SKIP logo check — S3 not configured (upload skipped by design)",
      );
    }
  } finally {
    // ── 4: self-clean — drop the throwaway org's rows, the org, and its logo blob ──
    await clearOrgData(THROWAWAY);
    const orgRow = await prisma.org.findUnique({
      where: { id: THROWAWAY },
      select: { logoKey: true },
    });
    if (orgRow?.logoKey && s3Up) {
      await deleteObject(orgRow.logoKey).catch(() => undefined);
    }
    await prisma.org.deleteMany({ where: { id: THROWAWAY } });
    await prisma.$disconnect();
  }

  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
