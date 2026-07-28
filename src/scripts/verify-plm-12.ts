/**
 * Verify PLM.12 — Change Orders list.
 * Run: pnpm verify:plm-12
 *
 *   1. /changes lists the seeded change orders (code · title · type · status ·
 *      affected-units · effectivity · approval state); a row routes to the detail.
 *   2. Affected-units count on a row equals the blast-radius traversal for that change
 *      (same affectedUnits façade), org-scoped.
 *   3. Awaiting-me is a server-side per-user query: a pending reviewer sees the change;
 *      a non-reviewer does not — computed server-side (NOT a client filter).
 *   4. Filters compose server-side (status × type × awaiting-me).
 *   5. No inline approval: the list exposes no decide()/approve mutation.
 *   6. additive migration only; org-scoped isolation.
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

async function run(): Promise<void> {
  console.log("\nVerifying PLM.12 — Change Orders list\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/changes/page.tsx");
  const view = read("apps/web/components/changes/ChangeOrdersView.tsx");
  const detailView = read("apps/web/components/changes/ChangeOrderView.tsx");
  const lib = read("apps/web/lib/change-orders.ts");
  const listDc = read("design/prototypes/axona-v2/Change Orders.dc.html");
  const detailDc = read("design/prototypes/axona-v2/Change Order.dc.html");

  // ── static: route, design committed, shared traversal, first-class awaiting-me, no inline approval ──
  await check(
    "route /changes + list view exist; both design files present",
    () => {
      return (
        page.length > 0 &&
        view.length > 0 &&
        /getChangeOrders/.test(page) &&
        listDc.length > 0 &&
        detailDc.length > 0
      );
    },
  );
  await check(
    "affected-units uses the SHARED affectedUnits (ONT.1) traversal — no parallel count",
    () => {
      return /affectedUnits\(/.test(lib) && /@axona\/agents/.test(lib);
    },
  );
  await check(
    "awaiting-me is a FIRST-CLASS server-side query over EcoReviewer (not a client filter)",
    () => {
      return (
        /export async function awaitingMyApproval\(/.test(lib) &&
        /ecoReviewer\.findMany/.test(lib) &&
        /state: "pending"/.test(lib) &&
        /userId/.test(lib)
      );
    },
  );
  await check(
    "filters compose SERVER-SIDE (page reads searchParams → getChangeOrders)",
    () => {
      return (
        /searchParams/.test(page) &&
        /awaitingMe/.test(lib) &&
        /filter\.status/.test(lib) &&
        /filter\.changeClass/.test(lib)
      );
    },
  );
  await check(
    "NO inline approval on the list (page + view carry no approve mutation)",
    () => {
      // The list ROUTES only — approval stays gated on the detail. The list surface (page
      // + view) must not import or call the approval action / decide() (a comment naming
      // where approval lives is fine — assert the executable surface, not documentation).
      const clean = (s: string) =>
        !/decide\(/.test(s) &&
        !/approveChangeOrder/.test(s) &&
        !/requestChangesOnOrder/.test(s) &&
        !/eco\.release/.test(s);
      return clean(page) && clean(view);
    },
  );
  await check("detail breadcrumb routes to /changes (list)", () => {
    return /href="\/changes"/.test(detailView);
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { getChangeOrders, awaitingMyApproval } =
    await import("../../apps/web/lib/change-orders");
  const { dbForOrg } = await import("@axona/db");
  const { affectedUnits } = await import("@axona/agents");

  const db = dbForOrg(DEMO);
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const viewer = await db.user.findFirst({
    where: { role: "VIEWER" },
    select: { id: true },
  });
  if (!admin || !viewer) {
    console.log("  FAIL missing seeded users");
    failed++;
    finish();
    return;
  }

  const res = await getChangeOrders(DEMO, {}, admin.id);

  // ── 1: the list carries the seeded change orders with all columns; rows route to detail ──
  await check(
    "list carries the seeded ECOs (code · title · type · status · units · effectivity · approval) + routes to detail",
    () => {
      const eco318 = res.rows.find((r) => r.code === "ECO-318");
      return (
        res.rows.length >= 8 &&
        !!eco318 &&
        eco318.changeClass === "SUPERSEDE" &&
        eco318.status === "in_review" &&
        !!eco318.effectivity &&
        eco318.reviewers.length >= 1 &&
        !!eco318.approvalText &&
        eco318.href === "/changes/ECO-318" &&
        // agent-drafted rows carry the CONF.1 confidence tag + source
        eco318.agentDrafted === true &&
        eco318.confidence === 0.86 &&
        eco318.source === "From NCR-118"
      );
    },
  );

  // ── 2: affected-units == the blast-radius traversal for that change (same façade) ──
  await check(
    "affected-units on a row equals affectedUnits(ecoId) traversal, org-scoped",
    async () => {
      const row = res.rows.find((r) => r.code === "ECO-318")!;
      const af = await affectedUnits(db, { ecoId: "ECO-318" });
      return (
        af.source === "blast-radius" &&
        row.affectedUnits === af.units.length &&
        af.units.length > 0
      );
    },
  );

  // ── 3: awaiting-me is server-side per-user (pending reviewer sees it; non-reviewer doesn't) ──
  await check(
    "awaiting-me: a pending reviewer (admin) sees changes; a non-reviewer (viewer) sees none — server-side",
    async () => {
      const adminSet = await awaitingMyApproval(DEMO, admin.id);
      const viewerSet = await awaitingMyApproval(DEMO, viewer.id);
      const adminRes = await getChangeOrders(DEMO, {}, admin.id);
      const viewerRes = await getChangeOrders(DEMO, {}, viewer.id);
      // the SAME rows exist for both users, but awaitingMe differs per-user (server-side,
      // not a client filter over the full list) — and the stat tile reflects the query.
      return (
        adminSet.size >= 1 &&
        viewerSet.size === 0 &&
        adminRes.stats.awaitingMe === adminSet.size &&
        viewerRes.stats.awaitingMe === 0 &&
        adminRes.rows.length === viewerRes.rows.length && // same list, different awaiting
        adminRes.rows.some((r) => r.awaitingMe) &&
        viewerRes.rows.every((r) => !r.awaitingMe)
      );
    },
  );

  // ── 4: filters compose server-side (status × type × awaiting-me) ──
  await check(
    "filters compose server-side (status × type × awaiting-me)",
    async () => {
      const inReviewAwaiting = await getChangeOrders(
        DEMO,
        { status: "in_review", awaitingMe: true },
        admin.id,
      );
      const deviations = await getChangeOrders(
        DEMO,
        { changeClass: "DEVIATION" },
        admin.id,
      );
      return (
        inReviewAwaiting.rows.length >= 1 &&
        inReviewAwaiting.rows.every(
          (r) => r.status === "in_review" && r.awaitingMe,
        ) &&
        deviations.rows.length >= 1 &&
        deviations.rows.every((r) => r.changeClass === "DEVIATION")
      );
    },
  );

  // ── 6: org-scoped isolation ──
  await check(
    "org-scoped: a second org sees zero of the demo's change orders",
    async () => {
      const iso = await getChangeOrders(SECOND, {}, admin.id);
      const isoAwaiting = await awaitingMyApproval(SECOND, admin.id);
      return iso.rows.length === 0 && isoAwaiting.size === 0;
    },
  );

  await import("@axona/db").then(({ prisma }) => prisma.$disconnect());
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
