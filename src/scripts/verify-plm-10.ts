/**
 * Verify PLM.10 — Configurations (`Configurations.dc.html`). Answers Q2 at fleet
 * level. Run: pnpm verify:plm-10
 *
 *   1. Route + view exist; LIST screen → back-arrow to Engineering + mono eyebrow.
 *   2. The matching-units count EQUALS the registry filtered by that config.
 *   3. Lock is RBAC-gated + audited (decide("config.lock")); a locked config is
 *      IMMUTABLE (a second lock is refused).
 *   4. The version diff renders hw + sw deltas.
 *   5. Per-tenant isolation.
 */
import { existsSync, readFileSync } from "node:fs";
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

async function run(): Promise<void> {
  console.log("\nVerifying PLM.10 — Configurations\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/configurations/page.tsx");
  const view = read(
    "apps/web/components/configurations/ConfigurationsView.tsx",
  );
  const actions = read("apps/web/app/(shell)/configurations/actions.ts");

  await check(
    "/configurations route + view exist; loads getConfigurations",
    () => {
      return (
        page.length > 0 && view.length > 0 && /getConfigurations/.test(page)
      );
    },
  );
  await check(
    "LIST screen → back-arrow to Engineering + mono eyebrow (no breadcrumbs)",
    () => {
      return (
        /aria-label="Back to Engineering"/.test(view) &&
        /Engineering · configuration management/.test(view) &&
        !/aria-label="Breadcrumb"/.test(view)
      );
    },
  );
  await check("lock routes through decide('config.lock')", () => {
    return /decide\("config\.lock"/.test(actions) && /"APPROVE"/.test(actions);
  });
  await check("v2 tokens only · no invented reds on configurations", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(view) &&
      !/\bbg-red|text-red|border-red\b/.test(view)
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

  const { getConfigurations, compareConfigs } =
    await import("../../apps/web/lib/configurations");
  const { getUnitRegistry } = await import("../../apps/web/lib/units");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { prisma, Prisma } = await import("@axona/db");

  // ── 2: matching-units count equals the registry filtered by that config ──
  await check(
    "matching-units count EQUALS the registry filtered by that config",
    async () => {
      const configs = await getConfigurations(DEMO);
      const withUnits = configs.find((c) => c.matchingUnits > 0);
      if (!withUnits) return false;
      const reg = await getUnitRegistry(DEMO, { config: withUnits.name });
      return reg.matched === withUnits.matchingUnits;
    },
  );

  // ── 4: version diff renders hw + sw deltas ──
  await check(
    "version diff surfaces the sw delta (r4.1 v4.1.0 vs r4.2 v4.2.1)",
    async () => {
      const d = await compareConfigs(DEMO, "CFG-AX2-r4.1", "CFG-AX2-r4.2");
      if (!d) return false;
      const swRow = d.sw.find((r) => r.key === "firmware");
      return (
        !!swRow &&
        swRow.differs === true &&
        swRow.a === "v4.1.0" &&
        swRow.b === "v4.2.1"
      );
    },
  );

  // ── 3 (exercised): lock is gated + DUAL-APPROVER + audited + immutable (PLM.11) ──
  await check(
    "decide('config.lock') is dual-approver: one proposes, a second finalizes; then immutable",
    async () => {
      const draft = await prisma.configurationVersion.findFirst({
        where: { orgId: DEMO, lockedAt: null, lockProposedById: null },
        select: { id: true, name: true, isBaseline: true },
      });
      if (!draft) return false;
      // MemoryItem too — decide() now writes a LOOP.1 OUTCOME episode per verdict.
      const guard = await captureSeededState(prisma as never, [
        "AuditLog",
        "MemoryItem",
      ]);
      try {
        const a = {
          id: "verify-eng",
          role: "ENGINEER" as const,
          email: "eng@axona-demo.test",
          name: "Eng A",
          orgId: DEMO,
        };
        const b = {
          id: "verify-adm",
          role: "ADMIN" as const,
          email: "adm@axona-demo.test",
          name: "Adm B",
          orgId: DEMO,
        };
        // first approver → proposes only (still a draft, not locked)
        const first = await decide("config.lock", draft.id, "APPROVE", a);
        const afterFirst = await prisma.configurationVersion.findUnique({
          where: { id: draft.id },
        });
        // same approver again → cannot finalize alone
        await decide("config.lock", draft.id, "APPROVE", a);
        const afterSolo = await prisma.configurationVersion.findUnique({
          where: { id: draft.id },
        });
        // a DIFFERENT second approver → locks + freezes the manifest (immutable)
        const second = await decide("config.lock", draft.id, "APPROVE", b);
        const afterSecond = await prisma.configurationVersion.findUnique({
          where: { id: draft.id },
        });
        // locked → a further lock is refused (already decided)
        const third = await decide("config.lock", draft.id, "APPROVE", a);
        const audits = await prisma.auditLog.count({
          where: {
            orgId: DEMO,
            action: "config.lock.approve",
            targetId: draft.id,
          },
        });
        return (
          first.ok === true &&
          afterFirst?.lockedAt === null && // proposed, not yet locked
          afterSolo?.lockedAt === null && // single approver can't finalize
          second.ok === true &&
          afterSecond?.lockedAt !== null &&
          afterSecond?.isBaseline === true &&
          afterSecond?.frozenManifest !== null && // manifest frozen at lock
          third.ok === false && // immutable
          audits >= 3
        );
      } finally {
        await prisma.configurationVersion.update({
          where: { id: draft.id },
          data: {
            lockedAt: null,
            lockedById: null,
            isBaseline: draft.isBaseline,
            lockProposedById: null,
            lockProposedAt: null,
            frozenManifest: Prisma.DbNull,
          },
        });
        await guard.restore();
      }
    },
  );

  // ── 5: isolation ──
  await check(
    "isolation: a second org resolves zero configurations",
    async () => {
      const configs = await getConfigurations(SECOND);
      return configs.length === 0;
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
