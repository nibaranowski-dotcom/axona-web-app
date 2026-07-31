/**
 * Verify PLM.V5 — Field Service v2: field modifications (`Field Service.dc.html`).
 * Run: pnpm verify:plm-v5
 *
 *   1. Route + view keep the dispatch board + SLA queue; the new Field
 *      modifications region + "+ Record field change" render.
 *   2. Recording lands PENDING (requireRole line 1 + AUDIT.1) and does NOT yet
 *      change the unit's resolved config — the approval gate holds.
 *   3. Approving via decide("field.mod") APPLIES the delta so resolveConfigAt(now)
 *      moves forward AND is audited — but a PRIOR frozen snapshot (TR-8841) is
 *      never altered (the safety-critical immutability invariant).
 *   4. RBAC: an insufficient role cannot approve.
 *   5. Per-tenant isolation.
 *   6. Existing FIELD verifies stay green (checked by verify:all).
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
const SERIAL = "SN-2208";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.V5 — Field Service v2 (field modifications)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const view = read("apps/web/components/field-service/FieldServiceView.tsx");
  const mods = read("apps/web/components/field-service/FieldModifications.tsx");
  const actions = read("apps/web/app/(shell)/field-service/actions.ts");
  const approvals = read("apps/web/lib/approvals.ts");
  const helper = read("packages/db/src/plm/field-modification.ts");

  // ── static ──
  await check(
    "dispatch board + SLA queue kept; Field modifications added",
    () => {
      return (
        /DispatchBoard/.test(view) &&
        /WorkOrderQueue/.test(view) &&
        /FieldModifications/.test(view)
      );
    },
  );
  await check("region renders the record button + config-effect table", () => {
    return (
      /Record field change/.test(mods) &&
      /Config effect/.test(mods) &&
      /updates unit config/.test(mods)
    );
  });
  await check("record action is RBAC-gated on line 1 + audited", () => {
    const gateFirst =
      actions.indexOf("requireRole(user") <
      actions.indexOf("dbForOrg(user.orgId)");
    return (
      /requireRole\(user, \["OPS", "ADMIN", "ENGINEER", "TECH"\]\)/.test(
        actions,
      ) &&
      gateFirst &&
      /writeAudit/.test(actions) &&
      /fieldmod\.record/.test(actions)
    );
  });
  await check("approval routes through decide('field.mod')", () => {
    return (
      /"field\.mod":/.test(approvals) &&
      /applyFieldModification/.test(approvals) &&
      /rejectFieldModification/.test(approvals)
    );
  });
  await check("v2 tokens only · no invented reds in the region", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(mods) &&
      !/\bbg-red|text-red|border-red\b/.test(mods)
    );
  });
  await check("frozen snapshot is captured, never recomputed (helper)", () => {
    return (
      /freezeConfigSnapshot/.test(helper) && /never recomputed/.test(helper)
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

  const { prisma, dbForOrg, resolveConfigAt, recordFieldModification } =
    await import("@axona/db");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { listFieldModifications } =
    await import("../../apps/web/lib/field-service");

  // ── 1: the table is populated (mock richness) with mixed states ──
  await check(
    "field modifications list is populated with pending + approved rows",
    async () => {
      const rows = await listFieldModifications(DEMO);
      return (
        rows.length >= 3 &&
        rows.some((r) => r.state === "pending") &&
        rows.some((r) => r.state === "approved") &&
        rows.every((r) => r.unitHref.startsWith("/units/"))
      );
    },
  );

  // ── 2 + 3: the core invariant — record→approve changes resolveConfigAt(now)
  //          but NOT a prior frozen snapshot (TR-8841). Fully self-cleaned. ──
  const db = dbForOrg(DEMO);
  const unit = await prisma.unit.findFirst({
    where: { orgId: DEMO, serial: SERIAL },
    select: { id: true },
  });
  const partRev = await prisma.partRevision.findFirst({
    where: { orgId: DEMO },
    select: {
      id: true,
      rev: true,
      partMaster: { select: { partNumber: true } },
    },
  });
  const tr8841 = await prisma.testRun.findFirst({
    where: { orgId: DEMO, code: "TR-8841" },
    select: { id: true, configSnapshot: true },
  });

  await check(
    "hero fixtures exist (SN-2208 · a part revision · TR-8841)",
    () => {
      return !!unit && !!partRev && !!tr8841;
    },
  );

  if (unit && partRev && tr8841) {
    const guard = await captureSeededState(prisma as never, [
      "FieldEvent",
      "AsBuiltRecord",
      "UnitSoftwareState",
      "AuditLog",
      "MemoryItem", // VERIFY.3 — decide() writes a LOOP.1 outcome episode
    ]);
    try {
      const before = await resolveConfigAt(db, unit.id, new Date());
      const beforeCount = before.hw.length;
      const tr8841Before = JSON.stringify(tr8841.configSnapshot);

      // record a PENDING hw modification at a fresh position (a clean create)
      const rec = await recordFieldModification(db, {
        unitId: unit.id,
        summary: "Verify · field-mod part swap",
        change: {
          type: "hw",
          bomPosition: "VERIFY-FIELDMOD",
          partRevisionId: partRev.id,
          partNumber: partRev.partMaster.partNumber,
          toRev: partRev.rev,
          lotCode: "V-9999",
        },
        techLabel: "verify",
      });

      await check(
        "recorded modification is PENDING and does NOT yet change config",
        async () => {
          const ev = await prisma.fieldEvent.findUnique({
            where: { id: rec.id },
            select: { state: true },
          });
          const now = await resolveConfigAt(db, unit.id, new Date());
          return ev?.state === "pending" && now.hw.length === beforeCount;
        },
      );

      const approver = {
        id: "verify",
        role: "ENGINEER" as const,
        email: "verify@axona-demo.test",
        name: "verify",
        orgId: DEMO,
      };
      const res = await decide("field.mod", rec.id, "APPROVE", approver);

      await check(
        "decide('field.mod') APPROVE applies the delta → resolveConfigAt(now) changes",
        async () => {
          const now = await resolveConfigAt(db, unit.id, new Date());
          const ev = await prisma.fieldEvent.findUnique({
            where: { id: rec.id },
            select: { state: true, approvedById: true },
          });
          return (
            res.ok === true &&
            now.hw.length === beforeCount + 1 &&
            ev?.state === "approved" &&
            ev?.approvedById === "verify"
          );
        },
      );

      await check(
        "prior frozen snapshot (TR-8841) is UNCHANGED by the modification",
        async () => {
          const after = await prisma.testRun.findFirst({
            where: { orgId: DEMO, code: "TR-8841" },
            select: { configSnapshot: true },
          });
          return JSON.stringify(after?.configSnapshot) === tr8841Before;
        },
      );

      await check("the approval is audited (field.mod.approve)", async () => {
        const audit = await prisma.auditLog.findFirst({
          where: {
            orgId: DEMO,
            action: "field.mod.approve",
            targetId: rec.id,
          },
        });
        return !!audit;
      });

      await check(
        "RBAC: a VIEWER cannot approve a field modification",
        async () => {
          // record a second pending mod, then attempt to approve it as a VIEWER.
          const rec2 = await recordFieldModification(db, {
            unitId: unit.id,
            summary: "Verify · rbac",
            change: { type: "calibration", detail: "rbac probe" },
          });
          let threw = false;
          try {
            await decide("field.mod", rec2.id, "APPROVE", {
              id: "v",
              role: "VIEWER",
              email: "v@axona-demo.test",
              name: "v",
              orgId: DEMO,
            });
          } catch {
            threw = true;
          }
          const ev = await prisma.fieldEvent.findUnique({
            where: { id: rec2.id },
            select: { state: true },
          });
          return threw && ev?.state === "pending";
        },
      );
    } finally {
      await guard.restore();
    }
  }

  // ── 5: isolation ──
  await check(
    "isolation: a second org sees none of these modifications",
    async () => {
      const rows = await listFieldModifications(SECOND);
      return rows.every((r) => r.serial !== SERIAL);
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
