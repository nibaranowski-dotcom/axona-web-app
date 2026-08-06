/**
 * Verify SEED.5 — DEMO TENANT DATA SEPARATION. Run: pnpm verify:seed-5
 *
 * The prospect runner used to seed ONE shared cross-module narrative into EVERY
 * prospect org before that org's own config ran. The narrative is drone/humanoid —
 * actuator drives, harmonic reducers, torque SPC, SN-21xx humanoids, "Frame Build"
 * stations. On a defense tenant it is on-narrative. On a warehouse-automation tenant
 * it renders a COMPETITOR'S PRODUCT CATEGORY as if it were the prospect's own, on
 * every screen — and because /procurement orders by insertion, its 11 purchase orders
 * sat ahead of the tenant's, burying the hero PO at row 15 of 19.
 *
 * This gate makes that non-recurrable:
 *   1. STRUCTURAL — the runner seeds NO domain data. It owns identity, memory,
 *      calibration and the search index; industry vocabulary is the config's choice.
 *   2. PURITY — no prospect tenant carries the shared base's signature records unless
 *      its config OPTS IN explicitly (mfx does, deliberately and visibly).
 *   3. POPULATED — dropping the forced base must not leave screens empty: every
 *      tenant still covers the modules PROSPECT.3 guaranteed.
 *   4. MARQUE-FREE — the committed domain packs name no real company or product.
 *
 * Read-only: it inspects seeded state and source, writes nothing, cleans up nothing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BANNED_RE } from "./lib/anonymization";

const ROOT = process.cwd();
const PROSPECTS = join(ROOT, "prospects");

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
  detail?: () => string,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok && detail) console.log(`        ${detail()}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

/**
 * The shared base narrative's SIGNATURE — records only it creates. Deliberately
 * specific: these are its exact codes and vocabulary, so a tenant matching any of
 * them is carrying the base rather than merely working in the same industry. (A
 * defense tenant legitimately has its own compute modules and airframes; it must not
 * have SERVO-204 or SN-2196.)
 */
const BASE_SIGNATURE =
  /\bSERVO-20[45]\b|\bBATT-AX2\b|\bLIDAR-360\b|\bLIDAR-88\b|\bREDUCER-70\b|\bHARN-220\b|\bAX2-UNIT\b|\bLOT-88421\b|\bSN-2[0-9]{3}\b|\bPO-90[0-9]{2}\b|\bNCR-(09[0-9]|1[01][0-9])\b|drive_torque_Nm|Frame Build|Drive Integration|Tier-1 Actuator Co|Precision Bearings Ltd|Cells & Power KK|Strain-Wave Gear Co|Vision Sensors Inc/;

/** Read a prospect's config source (gitignored — may be absent on a clean checkout). */
function configSource(name: string): string {
  const p = join(PROSPECTS, name, "prospect.config.ts");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** A config OPTS IN to the shared base by importing + calling it itself. */
function optsIntoSharedBase(name: string): boolean {
  const src = configSource(name);
  return /seed\/tenant/.test(src) && /seedTenantModules\(/.test(src);
}

async function run(): Promise<void> {
  console.log("\nVerifying SEED.5 — demo tenant data separation\n");

  const read = (p: string) =>
    existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";
  /**
   * Strip comments before asserting on source. The runner DOCUMENTS the seeding it no
   * longer does ("the runner used to force seedTenantModules…"), and that prose is the
   * clearest record of why the architecture changed — a checker that reads it as code
   * would pressure someone to delete the explanation to get green.
   */
  const codeOnly = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  // ── 1. structural: the runner is domain-agnostic ─────────────────────────────
  const runner = codeOnly(read("src/scripts/lib/prospect-seed.ts"));
  await check(
    "the prospect runner seeds NO domain data (no shared narrative forced on every tenant)",
    () =>
      runner.length > 0 &&
      !/seedTenantModules\(/.test(runner) &&
      !/seedDomainModules\(/.test(runner) &&
      /config\.seed\(/.test(runner),
  );
  await check(
    "the runner still owns identity · memory · calibration · search index",
    () =>
      /clearOrgData\(/.test(runner) &&
      /ingestMemory\(/.test(runner) &&
      /calibrate\(/.test(runner) &&
      /reindex\(/.test(runner),
  );

  // ── 2. the packs are committed, so they must be marque-free (SEED.1) ─────────
  const packSrc = read("packages/db/prisma/seed/domain-pack.ts");
  const domainSrc = read("packages/db/prisma/seed/domain.ts");
  await check("the domain packs exist and are wired to a generator", () => {
    return (
      /DRONE_PACK/.test(packSrc) &&
      /WAREHOUSE_PACK/.test(packSrc) &&
      /seedDomainModules/.test(domainSrc)
    );
  });
  await check(
    "the committed domain packs name no real company/product (SEED.1)",
    () => {
      const re = new RegExp(BANNED_RE.source, "gi");
      const hits = [...(packSrc + domainSrc).matchAll(re)].map(
        (m) => m[1] ?? m[0],
      );
      if (hits.length)
        console.log(`        marques: ${[...new Set(hits)].join(", ")}`);
      return hits.length === 0;
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma, dbForOrg, Prisma } = await import("@axona/db");

  const names = existsSync(PROSPECTS)
    ? readdirSync(PROSPECTS, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  const strModels = Prisma.dmmf.datamodel.models.filter((m) =>
    m.fields.some((f) => f.name === "orgId"),
  );

  for (const name of names) {
    const src = configSource(name);
    const orgId = /orgId:\s*ORG_ID/.test(src)
      ? /const ORG_ID = "([^"]+)"/.exec(src)?.[1]
      : /orgId:\s*"([^"]+)"/.exec(src)?.[1];
    if (!orgId) continue;
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      console.log(`\n  SKIP ${name} — not seeded in this database`);
      continue;
    }

    const optIn = optsIntoSharedBase(name);
    console.log(
      `\n  ── tenant: ${org.slug} ${optIn ? "(opts INTO the shared base)" : "(owns its own domain)"}`,
    );

    // ── 3. purity: the base's signature records only where opted in ────────────
    const hits: string[] = [];
    for (const m of strModels) {
      const delegate = (
        prisma as unknown as Record<
          string,
          {
            findMany?: (a: {
              where: { orgId: string };
            }) => Promise<Record<string, unknown>[]>;
          }
        >
      )[m.name.charAt(0).toLowerCase() + m.name.slice(1)];
      if (!delegate?.findMany) continue;
      const strFields = m.fields
        .filter(
          (f) =>
            f.kind === "scalar" && (f.type === "String" || f.type === "Json"),
        )
        .map((f) => f.name);
      if (!strFields.length) continue;
      for (const row of await delegate.findMany({ where: { orgId } })) {
        for (const f of strFields) {
          const v = row[f];
          const text =
            typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
          const hit = text && BASE_SIGNATURE.exec(text);
          if (hit) hits.push(`${m.name}.${f} → "${hit[0]}"`);
        }
      }
    }

    if (optIn) {
      await check(
        `${org.slug}: opts into the shared base, so its records are EXPECTED (${hits.length} found)`,
        () => true,
      );
    } else {
      await check(
        `${org.slug}: carries ZERO records from the shared base narrative`,
        () => hits.length === 0,
        () =>
          `${hits.length} leak(s), first 6:\n        ` +
          [...new Set(hits)].slice(0, 6).join("\n        "),
      );
    }

    // ── 4. populated: dropping the forced base must not empty the screens ──────
    const db = dbForOrg(orgId);
    const counts: Record<string, number> = {
      purchaseOrders: await db.purchaseOrder.count(),
      parts: await db.part.count(),
      ncrs: await db.nCR.count(),
      spc: await db.spcSample.count(),
      deals: await db.deal.count(),
      robots: await db.robot.count(),
      invoices: await db.invoice.count(),
      stock: await db.inventoryStock.count(),
      mfgWorkOrders: await db.workOrderMfg.count(),
      fieldWorkOrders: await db.workOrderField.count(),
      projects: await db.project.count(),
      machines: await db.machine.count(),
      workflows: await db.workflow.count(),
      notifications: await db.notification.count(),
      audit: await db.auditLog.count(),
      certs: await db.cert.count(),
      legal: await db.legalMatter.count(),
      cves: await db.cVE.count(),
      autonomy: await db.autonomyMetric.count(),
    };
    const empty = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([k]) => k);
    await check(
      `${org.slug}: every module surface is populated (${Object.keys(counts).length} checked)`,
      () => empty.length === 0,
      () => `empty: ${empty.join(", ")}`,
    );

    // ── 5. the tenant's own suppliers appear ONCE (no near-duplicate roster) ───
    const supplierNames = (
      await db.supplier.findMany({ select: { name: true } })
    ).map((s) => s.name);
    const dupes = supplierNames.filter(
      (n, i) => supplierNames.indexOf(n) !== i,
    );
    await check(
      `${org.slug}: no duplicated supplier name on the vendor roster`,
      () => dupes.length === 0,
      () => `duplicated: ${[...new Set(dupes)].join(", ")}`,
    );
  }

  await prisma.$disconnect();
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
