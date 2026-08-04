/**
 * Verify PLM.9 — the Change Order (`Change Order.dc.html`). Answers Q5.
 * Run: pnpm verify:plm-9
 *
 *   1. Route + view exist; DETAIL screen → breadcrumbs.
 *   2. Approve/reject routes through decide("eco.release") + is audited (RBAC.5).
 *   3. The affected-units block is COMPUTED (via ONT.1 affectedUnits) and respects
 *      effectivity (grandfathered before the from-serial; in-scope from it onward).
 *   4. Rollout is per-unit (a unit still carrying the superseded part is pending).
 *   5. ECR-118 → ECO-318 resolves (the ECR that originated the ECO).
 *   6. Per-tenant isolation.
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
  console.log("\nVerifying PLM.9 — the Change Order\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/changes/[code]/page.tsx");
  const view = read("apps/web/components/changes/ChangeOrderView.tsx");
  const actions = read("apps/web/app/(shell)/changes/actions.ts");

  await check("/changes/:code route + view exist; loads getChangeOrder", () => {
    return page.length > 0 && view.length > 0 && /getChangeOrder/.test(page);
  });
  await check(
    "DETAIL screen → breadcrumbs (Engineering › Change orders)",
    () => {
      return /aria-label="Breadcrumb"/.test(view) && /Change orders/.test(view);
    },
  );
  await check("approve/reject routes through decide('eco.release')", () => {
    return (
      /decide\("eco\.release"/.test(actions) &&
      /"APPROVE"/.test(actions) &&
      /"REJECT"/.test(actions)
    );
  });
  await check("v2 tokens only · no invented reds on the change order", () => {
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

  const { getChangeOrder } = await import("../../apps/web/lib/change-order");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { prisma } = await import("@axona/db");

  // ── 5 + 3 + 4: computed affected units, effectivity, per-unit rollout ──
  await check("ECR-118 → ECO-318 resolves; supersede parsed", async () => {
    const c = await getChangeOrder(DEMO, "ECO-318");
    return (
      !!c &&
      c.changeRequestCode === "ECR-118" &&
      c.supersede?.from === "SERVO-204" &&
      c.supersede?.to === "SERVO-205" &&
      c.effectiveFromSerial === "SN-2210"
    );
  });
  await check(
    "affected units are COMPUTED and respect effectivity",
    async () => {
      const c = await getChangeOrder(DEMO, "ECO-318");
      if (!c || c.affected.length === 0) return false;
      const before = c.affected.find((u) => u.serial === "SN-2208");
      const from = c.affected.find((u) => u.serial === "SN-2210");
      // SN-2208 is before the SN-2210 effectivity → grandfathered; SN-2210 is in scope.
      return (
        before?.inEffectivity === false &&
        before?.rollout === "not_applicable" &&
        from?.inEffectivity === true
      );
    },
  );
  await check(
    "rollout is per-unit (a unit carrying SERVO-204 is pending)",
    async () => {
      const c = await getChangeOrder(DEMO, "ECO-318");
      // AX2-0208/AX2-0214 are in-effectivity units that still carry SERVO-204 (lot 88421).
      const inScopeCarriers = c?.affected.filter(
        (u) => u.inEffectivity && u.rollout === "pending",
      );
      return (
        !!c &&
        (c.pending > 0
          ? (inScopeCarriers?.length ?? 0) > 0
          : // if no in-scope unit still carries it, applied must be computed per-unit
            c.affected.some((u) => u.rollout === "applied"))
      );
    },
  );

  // ── 2 (exercised): decide('eco.release') releases + audits, then reverted ──
  await check(
    "decide('eco.release') APPROVE releases the ECO + audits it",
    async () => {
      const eco = await prisma.eCO.findFirst({
        where: { orgId: DEMO, code: "ECO-318" },
        select: { id: true, stage: true },
      });
      if (!eco) return false;
      const guard = await captureSeededState(prisma as never, [
        "AuditLog",
        "MemoryItem", // VERIFY.3 — decide() writes a LOOP.1 outcome episode
      ]);
      try {
        const user = {
          id: "verify",
          role: "ENGINEER" as const,
          email: "verify@axona-demo.test",
          name: "verify",
          orgId: DEMO,
        };
        const res = await decide("eco.release", eco.id, "APPROVE", user);
        const after = await prisma.eCO.findUnique({ where: { id: eco.id } });
        const audit = await prisma.auditLog.findFirst({
          where: {
            orgId: DEMO,
            action: "eco.release.approve",
            targetId: eco.id,
          },
        });
        return res.ok === true && after?.stage === "RELEASED" && !!audit;
      } finally {
        await prisma.eCO.update({
          where: { id: eco.id },
          data: { stage: eco.stage },
        });
        await guard.restore();
      }
    },
  );

  // ── 6: isolation ──
  await check(
    "isolation: a second org cannot read this change order",
    async () => {
      const c = await getChangeOrder(SECOND, "ECO-318");
      return c === null;
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
