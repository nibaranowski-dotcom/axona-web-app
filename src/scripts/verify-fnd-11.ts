/**
 * Verify FND.11 — migrations + org-scoped client + per-tenant isolation (ISO.1).
 *
 * Run: `pnpm verify:fnd-11`
 *   STATIC (always): schema relations, dbForOrg, pagination, init + pgvector
 *     migrations.
 *   INTEGRATION (only when DATABASE_URL is set, e.g. after `docker compose up`):
 *     migration applied, cross-tenant read isolation, create-injection. Self-cleans.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@axona/db";

const root = process.cwd();
let passed = 0;
let failed = 0;

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

// Supplier seed WITHOUT orgId — dbForOrg must inject it. Cast bypasses the
// generated type's required orgId (added by the extension at runtime).
const supplierSeed = (name: string): Prisma.SupplierUncheckedCreateInput =>
  ({
    name,
    tier: 1,
    riskScore: 0.1,
    onTimePct: 99,
  }) as unknown as Prisma.SupplierUncheckedCreateInput;

async function run(): Promise<void> {
  console.log(
    "\nVerifying FND.11 — migrations + org-scoped client + isolation\n",
  );

  // ── STATIC ────────────────────────────────────────────────────────────────
  const schema = readFileSync(
    join(root, "packages/db/prisma/schema.prisma"),
    "utf8",
  );
  await check(
    "Org has back-relation arrays (users + suppliers)",
    () =>
      /users\s+User\[\]/.test(schema) &&
      /suppliers\s+Supplier\[\]/.test(schema),
  );
  await check("tenant model has formal org relation w/ onDelete: Cascade", () =>
    /org\s+Org\s+@relation\(fields:\s*\[orgId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/.test(
      schema,
    ),
  );
  await check("cross-entity FK: PurchaseOrder -> Supplier (Restrict)", () =>
    /supplier\s+Supplier\s+@relation\(fields:\s*\[supplierId\][^)]*onDelete:\s*Restrict\)/.test(
      schema,
    ),
  );
  await check("cross-entity FK: TelemetryPoint -> Robot (Cascade)", () =>
    /robot\s+Robot\s+@relation\(fields:\s*\[robotId\][^)]*onDelete:\s*Cascade\)/.test(
      schema,
    ),
  );
  await check("optional FK: WorkOrderField -> Technician (SetNull)", () =>
    /tech\s+Technician\?\s+@relation\([^)]*onDelete:\s*SetNull\)/.test(schema),
  );
  await check(
    "client.ts exports dbForOrg",
    () =>
      existsSync(join(root, "packages/db/src/client.ts")) &&
      /export function dbForOrg/.test(
        readFileSync(join(root, "packages/db/src/client.ts"), "utf8"),
      ),
  );
  await check("pagination helpers exist", () =>
    existsSync(join(root, "packages/db/src/pagination.ts")),
  );

  const migDir = join(root, "packages/db/prisma/migrations");
  await check(
    "init migration committed",
    () =>
      existsSync(migDir) && readdirSync(migDir).some((d) => /_init$/.test(d)),
  );
  await check("pgvector ANN migration present (vector(1536) + HNSW)", () => {
    const sql = readdirSync(migDir)
      .flatMap((d) => {
        const p = join(migDir, d, "migration.sql");
        return existsSync(p) ? [readFileSync(p, "utf8")] : [];
      })
      .join("\n");
    return (
      /USING hnsw/.test(sql) &&
      /vector\(1536\)/.test(sql) &&
      /CREATE EXTENSION IF NOT EXISTS vector/.test(sql)
    );
  });

  // ── INTEGRATION (DB required) ───────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.log(
      "  SKIP integration — DATABASE_URL not set (run docker compose up; see manual-checks)",
    );
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");

    await check("migration applied — Org table queryable", async () => {
      await prisma.org.count();
      return true;
    });

    await check(
      "cross-tenant isolation + create-injection via dbForOrg",
      async () => {
        const a = await prisma.org.create({ data: { name: "verify-A" } });
        const b = await prisma.org.create({ data: { name: "verify-B" } });
        try {
          // create WITHOUT orgId — the extension must inject it
          await dbForOrg(a.id).supplier.create({ data: supplierSeed("A-sup") });
          await dbForOrg(b.id).supplier.create({ data: supplierSeed("B-sup") });

          const seenByA = await dbForOrg(a.id).supplier.findMany();
          const seenByB = await dbForOrg(b.id).supplier.findMany();

          const aOnly =
            seenByA.length >= 1 && seenByA.every((s) => s.orgId === a.id);
          const bOnly =
            seenByB.length >= 1 && seenByB.every((s) => s.orgId === b.id);
          const noLeak =
            !seenByA.some((s) => s.orgId === b.id) &&
            !seenByB.some((s) => s.orgId === a.id);

          return aOnly && bOnly && noLeak;
        } finally {
          await prisma.org.delete({ where: { id: a.id } }); // cascades suppliers
          await prisma.org.delete({ where: { id: b.id } });
        }
      },
    );

    await prisma.$disconnect();
  }

  if (failed === 0) {
    console.log(`\nPASSED — ${passed} checks`);
    console.log("See docs/manual-checks.md for DB-level verification.");
  } else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

void run();
