/**
 * Verify PLM.11 — Configuration detail (full page).
 * Run: pnpm verify:plm-11
 *
 *   1. /configurations/:code renders the resolved manifest (HW positions + SW items)
 *      for the seeded config; a Configurations-list card links here.
 *   2. Frozen baseline: a baseline renders its frozen snapshot — changing an underlying
 *      part (BOM) does NOT alter it; a draft resolves live.
 *   3. Matching-units count equals the registry filtered by that config (same query).
 *   4. Version diff renders HW+SW deltas via the as-built alignment (changed vs matched).
 *   5. Lock is gated + DUAL-APPROVER + audited: a single approver cannot finalize; it
 *      routes through decide() + writes AUDIT.1; a locked config is immutable.
 *   6. D4/BOM is BUILT (PLM.13) — the manifest + Related rail land on /bom/:model.
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
const SECOND = "org_isolation_test";
const BASELINE = "CFG-HX2-r4.2";
const DRAFT = "CFG-HX2-r4.3";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.11 — Configuration detail\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/configurations/[code]/page.tsx");
  const view = read(
    "apps/web/components/configurations/ConfigurationDetailView.tsx",
  );
  const listView = read(
    "apps/web/components/configurations/ConfigurationsView.tsx",
  );
  const lib = read("apps/web/lib/configurations.ts");
  const approvals = read("apps/web/lib/approvals.ts");
  const dcHtml = read("design/prototypes/axona-v2/Configuration.dc.html");
  const listDc = read("design/prototypes/axona-v2/Configurations.dc.html");

  // ── static: route, design committed, list links here, D4/BOM flagged, no db push ──
  await check("route /configurations/:code + detail view exist", () => {
    return (
      page.length > 0 &&
      view.length > 0 &&
      /getConfigurationDetail/.test(page) &&
      /Breadcrumb/.test(view)
    );
  });
  await check(
    "both design files committed (Configuration + updated list)",
    () => {
      return dcHtml.length > 0 && listDc.length > 0;
    },
  );
  await check(
    "Configurations list card links into the detail (/configurations/:code)",
    () => {
      return /\/configurations\/\$\{encodeURIComponent\(c\.name\)\}/.test(
        listView,
      );
    },
  );
  await check(
    "D4/BOM is BUILT (PLM.13) — both affordances land on /bom/:model",
    () => {
      // Was: asserts the stub to the Engineering hub. PLM.13 shipped the screen,
      // so the assertion inverts — the manifest's "view all positions" link and
      // the Related rail's "BOM · as-designed" both resolve to the model's tree.
      return (
        /bomHref: `\/bom\/\$\{encodeURIComponent\(config\.productModel\.code\)\}`/.test(
          lib,
        ) &&
        /label: "BOM · as-designed"[\s\S]{0,160}href: `\/bom\//.test(lib) &&
        !/bomHref: "\/engineering"/.test(lib) &&
        /data\.bomHref/.test(view)
      );
    },
  );
  await check(
    "lock/unlock are DUAL-APPROVER via decide() (no bare toggle)",
    () => {
      return (
        /"config\.lock"/.test(approvals) &&
        /"config\.unlock"/.test(approvals) &&
        /awaiting_second/.test(approvals) &&
        /freezeConfigManifest\(/.test(approvals) &&
        /a single approver cannot finalize/i.test(approvals)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { getConfigurationDetail, getConfigurations } =
    await import("../../apps/web/lib/configurations");
  const { getUnitRegistry } = await import("../../apps/web/lib/units");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { prisma, Prisma } = await import("@axona/db");
  const { captureSeededState } = await import("./lib/self-clean");

  // ── 1: the manifest renders for the seeded baseline ──
  const detail = await getConfigurationDetail(DEMO, BASELINE);
  await check(
    "manifest renders HW positions + SW items for the seeded baseline",
    () => {
      return (
        !!detail &&
        detail.state === "baseline" &&
        detail.manifest.hw.length >= 5 &&
        detail.manifest.sw.length >= 2 &&
        detail.manifest.hw.every((h) => !!h.position && !!h.rev) &&
        detail.approvers.length === 2 // dual-approver on record
      );
    },
  );

  // ── 3: matching-units == the registry filtered by this config (same query) ──
  await check(
    "matching-units count equals the registry filtered by this config",
    async () => {
      const reg = await getUnitRegistry(DEMO, { config: BASELINE });
      const listRow = (await getConfigurations(DEMO)).find(
        (c) => c.name === BASELINE,
      );
      return (
        !!detail &&
        !!listRow &&
        detail.matchingUnits === reg.rows.length &&
        detail.matchingUnits === listRow.matchingUnits &&
        detail.matchingHref === `/units?config=${encodeURIComponent(BASELINE)}`
      );
    },
  );

  // ── 4: version diff renders HW + SW deltas via the as-built alignment ──
  await check(
    "version diff surfaces HW + SW deltas (changed vs matched)",
    () => {
      const d = detail?.diff;
      if (!d) return false;
      const hwChanged = d.hw.some((r) => r.differs);
      const swChanged = d.sw.some((r) => r.differs);
      const swMatched = d.sw.some((r) => !r.differs); // de-emphasised (matched) line
      return hwChanged && swChanged && swMatched;
    },
  );

  // ── 2: frozen-baseline immutability — mutate the BOM; baseline unchanged, draft live ──
  await check(
    "frozen baseline: a BOM change does NOT alter the baseline manifest; a draft resolves live",
    async () => {
      const hx2 = await prisma.productModel.findFirst({
        where: { orgId: DEMO, code: "HX-2" },
        select: { id: true },
      });
      const line = await prisma.bomLine.findFirst({
        where: { productModelId: hx2!.id },
        select: { id: true, qty: true, position: true },
      });
      if (!line) return false;
      const baseBefore = await getConfigurationDetail(DEMO, BASELINE);
      const draftBefore = await getConfigurationDetail(DEMO, DRAFT);
      const beforeBaseQty = baseBefore!.manifest.hw.find(
        (h) => h.position === line.position,
      )?.qty;
      const beforeDraftQty = draftBefore!.manifest.hw.find(
        (h) => h.position === line.position,
      )?.qty;
      try {
        await prisma.bomLine.update({
          where: { id: line.id },
          data: { qty: line.qty + 99 },
        });
        const baseAfter = await getConfigurationDetail(DEMO, BASELINE);
        const draftAfter = await getConfigurationDetail(DEMO, DRAFT);
        const afterBaseQty = baseAfter!.manifest.hw.find(
          (h) => h.position === line.position,
        )?.qty;
        const afterDraftQty = draftAfter!.manifest.hw.find(
          (h) => h.position === line.position,
        )?.qty;
        return (
          baseAfter!.frozen === true &&
          afterBaseQty === beforeBaseQty && // BASELINE unchanged (frozen)
          draftAfter!.frozen === false &&
          afterDraftQty === beforeDraftQty! + 99 && // DRAFT resolves live
          afterDraftQty !== afterBaseQty
        );
      } finally {
        await prisma.bomLine.update({
          where: { id: line.id },
          data: { qty: line.qty },
        });
      }
    },
  );

  // ── 5: lock is gated + DUAL-APPROVER + audited; single approver can't finalize ──
  await check(
    "lock: single approver cannot finalize; a second approver locks via decide() + AUDIT.1; then immutable",
    async () => {
      const draft = await prisma.configurationVersion.findFirst({
        where: { orgId: DEMO, name: DRAFT },
        select: { id: true, isBaseline: true },
      });
      if (!draft) return false;
      // MemoryItem too — decide() now writes a LOOP.1 OUTCOME episode per verdict.
      const guard = await captureSeededState(prisma as never, [
        "AuditLog",
        "MemoryItem",
      ]);
      const a = {
        id: "plm11-eng",
        role: "ENGINEER" as const,
        email: "e@axona-demo.test",
        name: "Eng A",
        orgId: DEMO,
      };
      const b = {
        id: "plm11-adm",
        role: "ADMIN" as const,
        email: "a@axona-demo.test",
        name: "Adm B",
        orgId: DEMO,
      };
      try {
        // first approver proposes; same approver again cannot finalize
        const first = await decide("config.lock", draft.id, "APPROVE", a);
        await decide("config.lock", draft.id, "APPROVE", a);
        const afterSolo = await prisma.configurationVersion.findUnique({
          where: { id: draft.id },
        });
        // a different second approver finalizes (freezes + baselines)
        const second = await decide("config.lock", draft.id, "APPROVE", b);
        const afterSecond = await prisma.configurationVersion.findUnique({
          where: { id: draft.id },
        });
        const third = await decide("config.lock", draft.id, "APPROVE", b);
        const audits = await prisma.auditLog.count({
          where: {
            orgId: DEMO,
            action: "config.lock.approve",
            targetId: draft.id,
          },
        });
        return (
          first.ok === true &&
          afterSolo?.lockedAt === null && // single approver never finalizes
          second.ok === true &&
          afterSecond?.lockedAt !== null &&
          afterSecond?.isBaseline === true &&
          afterSecond?.frozenManifest !== null && // manifest frozen at lock
          third.ok === false && // locked ⇒ immutable
          audits >= 3 // every step wrote its own AUDIT.1 entry
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

  // ── isolation ──
  await check(
    "org-scoped: a second org resolves no configuration detail",
    async () => {
      const d = await getConfigurationDetail(SECOND, BASELINE);
      return d === null;
    },
  );

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
