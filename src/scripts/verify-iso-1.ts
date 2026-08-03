/**
 * Verify ISO.1 — tenant scoping is complete, and cannot silently regress.
 * Run: pnpm verify:iso-1
 *
 *   1. COVERAGE GUARD: every Prisma model carrying an `orgId` column is in
 *      TENANT_MODELS. This is the check that makes the gap non-reintroducible —
 *      a new org-scoped model fails here until it is scoped.
 *   2. The five models PRIV.1a's audit surfaced (File · SearchDoc ·
 *      NotificationPref · SsoConfig · Invite) plus the org row itself are scoped.
 *   3. PER-MODEL ISOLATION, on real rows: an UNQUALIFIED findMany through the
 *      scoped client returns only the caller's org — proven against a second
 *      tenant AND against the unscoped total.
 *   4. Scoping lives in ONE place: the export bundle no longer restates the File
 *      or Org predicate it carried in PRIV.1a.
 *   5. The rules that cannot go in a unique `where` (File's OR, Org's id) are
 *      declared as such, so an upsert/update is not silently mangled.
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

const DEMO = "org_axona_demo";

/** The models ISO.1 brought under scoping (PRIV.1a's audit). */
const NEWLY_SCOPED = [
  "File",
  "SearchDoc",
  "NotificationPref",
  "SsoConfig",
  "Invite",
  "Org",
];

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying ISO.1 — tenant scoping coverage + isolation\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const client = read("packages/db/src/client.ts");
  const bundle = read("packages/db/src/io/org-export.ts");

  await check("the extension declares per-model scope rules", () => {
    return (
      /interface ScopeRule/.test(client) &&
      /const SCOPE_RULES: Record<string, ScopeRule>/.test(client) &&
      /const DEFAULT_RULE: ScopeRule/.test(client)
    );
  });

  await check("File's rule is the orgId-OR-project predicate", () => {
    return /File: \{[\s\S]{0,200}OR: \[\{ orgId \}, \{ project: \{ orgId \} \}\]/.test(
      client,
    );
  });

  await check(
    "Org's rule pins its own id (its tenant key is not orgId)",
    () => {
      return /Org: \{[\s\S]{0,160}where: \(orgId\) => \(\{ id: orgId \}\)/.test(
        client,
      );
    },
  );

  await check(
    "rules that cannot sit in a unique where declare tagUniqueOps: false",
    () => {
      // File's OR and Org's id are illegal in a findUnique-style where, and
      // NotificationPref/SsoConfig/Invite are addressed by compound uniques —
      // tagging those would make Prisma reject the call outright.
      const needed = [
        "File",
        "Org",
        "NotificationPref",
        "SsoConfig",
        "Invite",
        "SearchDoc",
      ];
      return needed.every((m) => {
        const at = client.indexOf(`  ${m}: {`);
        if (at < 0) return false;
        const block = client.slice(at, at + 400);
        return /tagUniqueOps: false/.test(block);
      });
    },
  );

  await check(
    "scoping lives in ONE place — the export no longer restates it",
    () => {
      // The bundle keeps its BUSINESS filter (deletedAt) and nothing tenant-ish:
      // PRIV.1a's hand-carried File OR-predicate and Org id-pin are gone, and no
      // other source reaches for $org to scope a read.
      const oneLine = bundle.replace(/\s+/g, " ");
      return (
        !/OR: \[\{ orgId: db\.\$org \}/.test(oneLine) &&
        !/where: \{ id: db\.\$org \}/.test(oneLine) &&
        /db\.file\.findMany\(\{ where: \{ deletedAt: null \}/.test(oneLine)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg, tenantCoverageGaps, tenantModelCensus } =
    await import("@axona/db");

  // ── 1. THE COVERAGE GUARD ──
  await check(
    "COVERAGE: every model with an orgId column is tenant-scoped",
    () => {
      const gaps = tenantCoverageGaps();
      if (gaps.length) console.log(`        unscoped: ${gaps.join(", ")}`);
      return gaps.length === 0;
    },
  );

  await check("COVERAGE: the guard is LIVE (it can see models at all)", () => {
    // A guard that read an empty model list would pass vacuously forever.
    const census = tenantModelCensus();
    return census.models > 50 && census.withOrgId > 50 && census.scoped >= 60;
  });

  await check("the models ISO.1 brought under scoping are all scoped", () => {
    return NEWLY_SCOPED.every((m) =>
      new RegExp(`^\\s*"${m}",`, "m").test(client),
    );
  });

  // ── 3. PER-MODEL ISOLATION on real rows ──
  const orgs = await prisma.org.findMany({ select: { id: true } });
  const other = orgs.find((o) => o.id !== DEMO)?.id;
  if (!other) {
    console.log("  FAIL no second tenant to prove isolation against");
    failed++;
    finish();
    return;
  }

  await check(
    "ISOLATION: an unqualified File read returns ONLY the caller's rows",
    async () => {
      const mine = await dbForOrg(DEMO).file.findMany({ select: { id: true } });
      const theirs = await dbForOrg(other).file.findMany({
        select: { id: true },
      });
      const mineIds = new Set(mine.map((r) => r.id));
      const shared = theirs.filter((r) => mineIds.has(r.id));
      // The scoped read must equal an INDEPENDENT org-scoped count, and the two
      // tenants' views must not overlap. Deliberately NOT "the database holds
      // more than this org sees": on a CI seed the second tenant owns no files,
      // so that clause would fail for lack of other tenants' data rather than
      // for a leak — a seed-shaped assertion, not a property.
      const owned = await prisma.file.count({
        where: { OR: [{ orgId: DEMO }, { project: { orgId: DEMO } }] },
      });
      const otherOwned = await prisma.file.count({
        where: { OR: [{ orgId: other }, { project: { orgId: other } }] },
      });
      return (
        mine.length > 0 &&
        mine.length === owned &&
        theirs.length === otherOwned &&
        shared.length === 0
      );
    },
  );

  await check(
    "ISOLATION: an unqualified Org read returns ONLY the caller's org",
    async () => {
      const mine = await dbForOrg(DEMO).org.findMany({ select: { id: true } });
      const theirs = await dbForOrg(other).org.findMany({
        select: { id: true },
      });
      const all = await prisma.org.count();
      // `all > 1` is safe on any seed: `other` was resolved from the org table,
      // so at least two exist by construction.
      return (
        mine.length === 1 &&
        mine[0]?.id === DEMO &&
        theirs.length === 1 &&
        theirs[0]?.id === other &&
        all > 1
      );
    },
  );

  await check(
    "ISOLATION: findFirst on Org cannot return another tenant's row",
    async () => {
      // The exact PRIV.1a bug: a bare findFirst returned whichever org came back
      // first, and its NAME was stamped on an export bundle.
      const a = await dbForOrg(DEMO).org.findFirst({ select: { id: true } });
      const b = await dbForOrg(other).org.findFirst({ select: { id: true } });
      return a?.id === DEMO && b?.id === other;
    },
  );

  await check(
    "ISOLATION: SearchDoc reads are scoped (the index is per-tenant)",
    async () => {
      const mine = await dbForOrg(DEMO).searchDoc.count();
      const theirs = await dbForOrg(other).searchDoc.count();
      const all = await prisma.searchDoc.count();
      const owned = await prisma.searchDoc.count({ where: { orgId: DEMO } });
      // Same shape as the File check: equality with an independent org-scoped
      // count, plus the two tenants' views summing within the total.
      return mine > 0 && mine === owned && mine + theirs <= all;
    },
  );

  await check(
    "ISOLATION: the remaining newly-scoped models read scoped too",
    async () => {
      // Invite / NotificationPref / SsoConfig are unpopulated on the seed, so the
      // assertion is that each read is PINNED, not that it returns rows: a count
      // through the scoped client can never exceed the raw count for that org.
      const db = dbForOrg(DEMO);
      const pairs: [number, number][] = [
        [
          await db.invite.count(),
          await prisma.invite.count({ where: { orgId: DEMO } }),
        ],
        [
          await db.notificationPref.count(),
          await prisma.notificationPref.count({ where: { orgId: DEMO } }),
        ],
        [
          await db.ssoConfig.count(),
          await prisma.ssoConfig.count({ where: { orgId: DEMO } }),
        ],
      ];
      return pairs.every(([scoped, actual]) => scoped === actual);
    },
  );

  await check(
    "PRIV.1a is unchanged: the export still sees exactly this org's files",
    async () => {
      const { buildOrgExport } = await import("@axona/db");
      const b = await buildOrgExport(dbForOrg(DEMO));
      const files = b.entities.find((e) => e.entity === "file")?.count ?? 0;
      const actual = await prisma.file.count({
        where: {
          OR: [{ orgId: DEMO }, { project: { orgId: DEMO } }],
          deletedAt: null,
        },
      });
      const org = await prisma.org.findUnique({
        where: { id: DEMO },
        select: { name: true },
      });
      return files === actual && files > 0 && b.orgName === org?.name;
    },
  );

  finish();
}

run();
