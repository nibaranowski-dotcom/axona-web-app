/**
 * Verify PLM.1b — the deferred-tier data model (Test · FieldEvent · RCA · Change
 * Request) + freezeConfigSnapshot. Run: pnpm verify:plm-1b
 *
 *   1. New models exist + are in TENANT_MODELS + migration present + enums/EntityType.
 *   2. TR-8841 carries a FROZEN configSnapshot; mutating the unit's CURRENT config
 *      does NOT change it (a test result is inseparable from the config it ran on).
 *   3. A field_modification changes resolveConfigAt(now) but NOT a prior frozen
 *      snapshot (config drifts in the field; the frozen "as-tested" copy holds).
 *   4. NCR-118 rootCause = component + links (unit · testRun) resolve.
 *   5. ChangeRequest ECR-118 → ECO-318 (and ECO.changeRequestId back).
 *   6. resolveConfigAt still works; TR-8802(pass) froze the PRE-upgrade config,
 *      TR-8841(fail) the POST-upgrade config — the test explorer's "how builds differ".
 *   7. Per-tenant isolation — a second org resolves zero tests/field events/CRs.
 *   Self-cleaning (MIGRATE.1): every mutation is captured + restored.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { captureSeededState } from "./lib/self-clean";

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
const SECOND = "org_isolation_test";
const SERIAL = "SN-2208";

async function run(): Promise<void> {
  console.log(
    "\nVerifying PLM.1b — test · field event · RCA · change request\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const schema = read("packages/db/prisma/schema.prisma");
  const client = read("packages/db/src/client.ts");
  const config = read("packages/db/src/plm/config.ts");

  // ── 1 (static): models · enums · tenancy · migration ──
  await check(
    "new models + enums + EntityType members exist in the schema",
    () => {
      return (
        /model TestRun \{/.test(schema) &&
        /model TestResult \{/.test(schema) &&
        /model FieldEvent \{/.test(schema) &&
        /model ChangeRequest \{/.test(schema) &&
        /enum RootCause \{/.test(schema) &&
        /enum FieldEventKind \{/.test(schema) &&
        /enum TestOutcome \{/.test(schema) &&
        /enum ChangeState \{/.test(schema) &&
        /\bTEST_RUN\b/.test(schema) &&
        /\bFIELD_EVENT\b/.test(schema)
      );
    },
  );
  await check(
    "NCR gains rootCause + links + configSnapshot; ECO gains changeRequestId",
    () => {
      return (
        /rootCause\s+RootCause\?/.test(schema) &&
        /testRunId\s+String\?/.test(schema) &&
        /fieldEventId\s+String\?/.test(schema) &&
        /configSnapshot\s+Json\?/.test(schema) &&
        /changeRequestId\s+String\?/.test(schema)
      );
    },
  );
  await check("all four new models are in TENANT_MODELS (isolation)", () => {
    return (
      /"TestRun"/.test(client) &&
      /"TestResult"/.test(client) &&
      /"FieldEvent"/.test(client) &&
      /"ChangeRequest"/.test(client)
    );
  });
  await check("freezeConfigSnapshot exists (frozen, never recomputed)", () => {
    return (
      /export async function freezeConfigSnapshot/.test(config) &&
      /frozen: true/.test(config)
    );
  });
  await check("the PLM.1b migration is present", () => {
    const dir = "packages/db/prisma/migrations";
    return (
      existsSync(join(root, dir)) &&
      readdirSync(join(root, dir)).some((d) => /plm1b/.test(d))
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { prisma, dbForOrg, resolveConfigAt, freezeConfigSnapshot } =
    await import("@axona/db");
  const db = dbForOrg(DEMO);

  const unit = await prisma.unit.findFirst({
    where: { orgId: DEMO, serial: SERIAL },
    select: { id: true },
  });
  if (!unit) throw new Error("SN-2208 not found — reseed");

  // ── 6: the two runs froze DIFFERENT configs (the pre/post-upgrade comparison) ──
  await check(
    "TR-8802(pass) froze v4.1.0; TR-8841(fail) froze v4.2.1",
    async () => {
      const pass = await prisma.testRun.findFirst({
        where: { orgId: DEMO, code: "TR-8802" },
      });
      const fail = await prisma.testRun.findFirst({
        where: { orgId: DEMO, code: "TR-8841" },
      });
      const ps = pass?.configSnapshot as {
        frozen?: boolean;
        sw?: { version?: string };
      } | null;
      const fs = fail?.configSnapshot as {
        frozen?: boolean;
        sw?: { version?: string };
      } | null;
      return (
        pass?.outcome === "pass" &&
        fail?.outcome === "fail" &&
        ps?.frozen === true &&
        fs?.frozen === true &&
        ps?.sw?.version === "v4.1.0" &&
        fs?.sw?.version === "v4.2.1"
      );
    },
  );

  // ── 2: the frozen snapshot resists a change to the unit's CURRENT config ──
  await check(
    "TR-8841's frozen snapshot does NOT change when current config is mutated",
    async () => {
      const guard = await captureSeededState(prisma as never, [
        "SoftwareRelease",
        "UnitSoftwareState",
      ]);
      try {
        const before = await prisma.testRun.findFirst({
          where: { orgId: DEMO, code: "TR-8841" },
        });
        const frozenBefore = JSON.stringify(before?.configSnapshot);
        const liveBefore = await resolveConfigAt(db, unit.id, new Date());

        // mutate the CURRENT config: a new firmware state effective now
        const rel = await db.softwareRelease.create({
          data: {
            orgId: DEMO,
            component: "firmware",
            version: "v9.9.9-verify",
          },
        });
        await db.unitSoftwareState.create({
          data: {
            orgId: DEMO,
            unitId: unit.id,
            softwareReleaseId: rel.id,
            effectiveFrom: new Date(),
          },
        });

        const liveAfter = await resolveConfigAt(db, unit.id, new Date());
        const after = await prisma.testRun.findFirst({
          where: { orgId: DEMO, code: "TR-8841" },
        });
        const frozenAfter = JSON.stringify(after?.configSnapshot);

        return (
          liveBefore.sw?.version === "v4.2.1" &&
          liveAfter.sw?.version === "v9.9.9-verify" && // current config DID change
          frozenBefore === frozenAfter && // frozen snapshot did NOT
          frozenAfter.includes("v4.2.1")
        );
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 3: a field_modification drives config drift but never a frozen snapshot ──
  await check(
    "a field_modification changes resolveConfigAt(now) but not the frozen snapshot",
    async () => {
      const guard = await captureSeededState(prisma as never, [
        "SoftwareRelease",
        "UnitSoftwareState",
        "FieldEvent",
      ]);
      try {
        const frozenBefore = JSON.stringify(
          (
            await prisma.testRun.findFirst({
              where: { orgId: DEMO, code: "TR-8841" },
            })
          )?.configSnapshot,
        );
        const now = new Date();

        // the field modification: swap → a new sw state (config drift), recorded
        // with its OWN frozen snapshot.
        const rel = await db.softwareRelease.create({
          data: { orgId: DEMO, component: "firmware", version: "v4.2.2-field" },
        });
        await db.unitSoftwareState.create({
          data: {
            orgId: DEMO,
            unitId: unit.id,
            softwareReleaseId: rel.id,
            effectiveFrom: now,
          },
        });
        const snap = await freezeConfigSnapshot(db, unit.id, now);
        await db.fieldEvent.create({
          data: {
            orgId: DEMO,
            unitId: unit.id,
            kind: "field_modification",
            summary: "verify field mod",
            occurredAt: now,
            configSnapshot: snap,
          },
        });

        const live = await resolveConfigAt(db, unit.id, now);
        const frozenAfter = JSON.stringify(
          (
            await prisma.testRun.findFirst({
              where: { orgId: DEMO, code: "TR-8841" },
            })
          )?.configSnapshot,
        );

        return (
          live.sw?.version === "v4.2.2-field" && // current config drifted
          snap.sw?.version === "v4.2.2-field" && // the event froze the drift
          frozenBefore === frozenAfter && // the prior test snapshot is untouched
          frozenAfter.includes("v4.2.1")
        );
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 4: NCR-118 RCA + links ──
  await check(
    "NCR-118 rootCause = component + unit/testRun links resolve",
    async () => {
      const ncr = await prisma.nCR.findFirst({
        where: { orgId: DEMO, code: "NCR-118" },
      });
      if (!ncr || ncr.rootCause !== "component") return false;
      if (ncr.unitId !== unit.id) return false;
      const tr = ncr.testRunId
        ? await prisma.testRun.findFirst({
            where: { orgId: DEMO, id: ncr.testRunId },
          })
        : null;
      return tr?.code === "TR-8841" && ncr.configSnapshot !== null;
    },
  );

  // ── 5: ChangeRequest → ECO-318 ──
  await check("ECR-118 → ECO-318 (and ECO.changeRequestId back)", async () => {
    const cr = await prisma.changeRequest.findFirst({
      where: { orgId: DEMO, code: "ECR-118" },
    });
    const eco = await prisma.eCO.findFirst({
      where: { orgId: DEMO, code: "ECO-318" },
    });
    return (
      !!cr &&
      !!eco &&
      cr.ecoId === eco.id &&
      cr.state === "released" &&
      eco.changeRequestId === "ECR-118"
    );
  });

  // ── 7: isolation ──
  await check(
    "isolation: a second org resolves zero tests/field events/CRs",
    async () => {
      const s = dbForOrg(SECOND);
      const [t, f, c] = await Promise.all([
        s.testRun.count(),
        s.fieldEvent.count(),
        s.changeRequest.count(),
      ]);
      return t === 0 && f === 0 && c === 0;
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
