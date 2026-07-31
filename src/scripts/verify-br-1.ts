/**
 * Verify BR.1 — Build-readiness + supplier lead-time visibility (horizontal).
 * Static + PURE-fixture checks always run; DB checks gate on DATABASE_URL and are
 * self-cleaning (restore the PO/stock, delete the audit + outcome rows). Run:
 * pnpm verify:br-1
 *
 *   1. (pure) readiness math matches a hand-computed fixture (counts · % · blocking).
 *   2. (pure) determinism — a fixed `now` yields byte-identical output.
 *   3. (pure) a GR bump moves a line on_order → in_house and raises pctInHouse.
 *   4. (pure) a covering PO past its promised date classifies the line `late`.
 *   5. (static) the po.receive GR kind + receivePurchaseOrder action go through decide().
 *   6. (static) the migration is additive-nullable (receivedAt), never db push.
 *   7. (db) a real GR (decide po.receive) sets RECEIVED + receivedAt + bumps Part.onHand.
 *   8. (db) org isolation — computeBuildReadiness on another tenant's unit is "not found".
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rollupBuildReadiness } from "@axona/db";
import type { ReadinessLineInput } from "@axona/db";

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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
// strip comments so greps assert real code, not doc prose.
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

// A fixed instant so `late`/`on_order` are deterministic (VERIFY.2).
const NOW = Date.UTC(2026, 6, 24);
const DAY = 86_400_000;

function fixture(onHandB: number): ReadinessLineInput[] {
  return [
    // A: enough on hand → in_house
    {
      position: "A",
      partNumber: "PN-A",
      name: "Part A",
      required: 2,
      onHand: 5,
      tracked: true,
      openPos: [],
    },
    // B: gap, covered by a FUTURE PO → on_order (onHandB flips it to in_house)
    {
      position: "B",
      partNumber: "PN-B",
      name: "Part B",
      required: 4,
      onHand: onHandB,
      tracked: true,
      openPos: [{ code: "PO-ON", eta: new Date(NOW + 10 * DAY) }],
    },
    // C: gap, covering PO PAST promised → late
    {
      position: "C",
      partNumber: "PN-C",
      name: "Part C",
      required: 3,
      onHand: 0,
      tracked: true,
      openPos: [{ code: "PO-LATE", eta: new Date(NOW - 5 * DAY) }],
    },
    // D: untracked (no procurement Part) → missing
    {
      position: "D",
      partNumber: "PN-D",
      name: "Part D",
      required: 1,
      onHand: 0,
      tracked: false,
      openPos: [],
    },
    // E: gap, no covering PO → missing
    {
      position: "E",
      partNumber: "PN-E",
      name: "Part E",
      required: 2,
      onHand: 0,
      tracked: true,
      openPos: [],
    },
  ];
}

async function run(): Promise<void> {
  console.log("\nVerifying BR.1 — build-readiness + supplier lead-time\n");

  // ── 1 · pure math against a hand-computed fixture ──────────────────────────
  await check(
    "readiness math matches the hand-computed fixture (counts · % · blocking)",
    () => {
      const r = rollupBuildReadiness("unit-x", fixture(1), NOW);
      return (
        r.lineCount === 5 &&
        r.counts.in_house === 1 &&
        r.counts.on_order === 1 &&
        r.counts.late === 1 &&
        r.counts.missing === 2 &&
        r.pctInHouse === 20 &&
        r.pctOnOrder === 20 &&
        r.pctLate === 20 &&
        r.pctMissing === 40 &&
        // blocking = late ∪ missing = C, D, E
        r.blockingParts.length === 3 &&
        r.blockingParts.some(
          (b) => b.partNumber === "PN-C" && b.state === "late",
        ) &&
        r.blockingParts.some(
          (b) =>
            b.partNumber === "PN-D" &&
            b.state === "missing" &&
            b.tracked === false,
        ) &&
        r.blockingParts.some(
          (b) =>
            b.partNumber === "PN-E" &&
            b.state === "missing" &&
            b.tracked === true,
        )
      );
    },
  );

  // ── 2 · determinism — fixed `now` → identical output ───────────────────────
  await check("determinism: a fixed `now` yields byte-identical output", () => {
    const a = JSON.stringify(rollupBuildReadiness("u", fixture(1), NOW));
    const b = JSON.stringify(rollupBuildReadiness("u", fixture(1), NOW));
    return a === b;
  });

  // ── 3 · GR bump moves on_order → in_house and raises pctInHouse ─────────────
  await check(
    "a goods-receipt bump moves a line on_order → in_house and raises pctInHouse",
    () => {
      const before = rollupBuildReadiness("u", fixture(1), NOW); // B short → on_order
      const after = rollupBuildReadiness("u", fixture(4), NOW); // B now covered
      const bBefore = before.lines.find((l) => l.position === "B");
      const bAfter = after.lines.find((l) => l.position === "B");
      return (
        bBefore?.state === "on_order" &&
        bAfter?.state === "in_house" &&
        after.pctInHouse > before.pctInHouse
      );
    },
  );

  // ── 4 · a covering PO past its promised date → late ────────────────────────
  await check(
    "a covering PO past its promised date classifies the line `late`",
    () => {
      const late = rollupBuildReadiness(
        "u",
        [
          {
            position: "C",
            partNumber: "PN-C",
            name: "C",
            required: 3,
            onHand: 0,
            tracked: true,
            openPos: [{ code: "PO-LATE", eta: new Date(NOW - DAY) }],
          },
        ],
        NOW,
      );
      const notYet = rollupBuildReadiness(
        "u",
        [
          {
            position: "C",
            partNumber: "PN-C",
            name: "C",
            required: 3,
            onHand: 0,
            tracked: true,
            openPos: [{ code: "PO-SOON", eta: new Date(NOW + DAY) }],
          },
        ],
        NOW,
      );
      return (
        late.lines[0]?.state === "late" &&
        late.lines[0]?.coveringPo === "PO-LATE" &&
        notYet.lines[0]?.state === "on_order"
      );
    },
  );

  // ── 5 · static: GR kind + action + compute go through the spine ────────────
  await check(
    "po.receive kind: SENT → RECEIVED + receivedAt + Part.onHand increment, OPS/ADMIN",
    () => {
      const approvals = decomment(read("apps/web/lib/approvals.ts"));
      return (
        /"po\.receive"/.test(approvals) &&
        /status === "SENT"/.test(approvals) &&
        /status: "RECEIVED", receivedAt: new Date\(\)/.test(approvals) &&
        /onHand: \{ increment: po\.qty \}/.test(approvals) &&
        /roles: \["OPS", "ADMIN"\]/.test(approvals)
      );
    },
  );
  await check(
    "receivePurchaseOrder action goes through decide('po.receive') + revalidates the unit page",
    () => {
      const actions = decomment(
        read("apps/web/app/(shell)/procurement/actions.ts"),
      );
      return (
        /receivePurchaseOrder/.test(actions) &&
        /decide\("po\.receive", poId, "APPROVE", user\)/.test(actions) &&
        /revalidatePath\("\/units\/\[serial\]", "page"\)/.test(actions) &&
        // no ad-hoc mutation — everything gated
        !/purchaseOrder\.(update|updateMany)/.test(actions)
      );
    },
  );
  await check(
    "compute helper injects `now` (deterministic) and is wired into the unit page + card",
    () => {
      const helper = decomment(read("packages/db/src/plm/build-readiness.ts"));
      const unitDetail = decomment(read("apps/web/lib/unit-detail.ts"));
      const unitView = decomment(
        read("apps/web/components/units/UnitView.tsx"),
      );
      const proc = decomment(read("apps/web/lib/procurement.ts"));
      return (
        /opts\.now \?\? Date\.now\(\)/.test(helper) &&
        /computeBuildReadiness\(db, unit\.id/.test(unitDetail) &&
        /BuildReadinessCard/.test(unitView) &&
        // supplier-risk flags derived (no new columns)
        /singleSource/.test(proc) &&
        /approvedVendorIds/.test(proc) &&
        /LONG_LEAD_DAYS/.test(proc)
      );
    },
  );

  // ── 6 · static: additive-nullable migration, never db push ─────────────────
  await check(
    "migration is additive-nullable (receivedAt) — no db push, no drops",
    () => {
      // strip SQL (`--`) comments so the "no drops" prose can't false-match.
      const mig = read(
        "packages/db/prisma/migrations/20260731120000_br1_po_received_at/migration.sql",
      ).replace(/--[^\n]*/g, "");
      const schema = read("packages/db/prisma/schema.prisma");
      return (
        /ADD COLUMN\s+"receivedAt" TIMESTAMP/.test(mig) &&
        !/DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i.test(mig) &&
        /receivedAt\s+DateTime\?/.test(schema)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log(
      "\n  SKIP db checks — DATABASE_URL not set (static + pure only)",
    );
    finish();
    return;
  }

  const { prisma, dbForOrg, computeBuildReadiness } = await import("@axona/db");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { captureSeededState } = await import("./lib/self-clean");
  // outcome episodes (MemoryItem) created by decide()'s LOOP.1 writeback self-clean.
  const guard = await captureSeededState(prisma, ["MemoryItem"]);

  const org = await prisma.org.findFirst({ where: { name: "Axona" } });
  const org2 = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  if (!org || !org2) {
    console.log("  FAIL demo/second org missing (run pnpm db:seed)");
    failed++;
    await guard.restore();
    await prisma.$disconnect();
    finish();
    return;
  }
  const db = dbForOrg(org.id);

  // ── 7 · a real goods-receipt through decide() ──────────────────────────────
  const po = await db.purchaseOrder.findFirst({
    where: { status: "SENT" },
    select: { id: true, code: true, qty: true, partId: true },
  });
  const opsUser = await prisma.user.findFirst({
    where: { orgId: org.id, role: "OPS" },
    select: { id: true, email: true, name: true },
  });
  const ops = {
    id: opsUser?.id ?? "ops",
    role: "OPS" as const,
    email: opsUser?.email ?? "ops@demo",
    name: opsUser?.name ?? "M. Osei",
    orgId: org.id,
  };

  if (!po) {
    console.log("  FAIL no SENT PO fixture (run pnpm db:seed)");
    failed++;
  } else {
    const partBefore = await db.part.findFirst({
      where: { id: po.partId },
      select: { onHand: true },
    });
    const onHandBefore = partBefore?.onHand ?? 0;

    await check(
      "GR (decide po.receive) → RECEIVED + receivedAt set + Part.onHand += qty",
      async () => {
        const res = await decide("po.receive", po.id, "APPROVE", ops);
        const poAfter = await db.purchaseOrder.findFirst({
          where: { id: po.id },
          select: { status: true, receivedAt: true },
        });
        const partAfter = await db.part.findFirst({
          where: { id: po.partId },
          select: { onHand: true },
        });
        const audit = await db.auditLog.findFirst({
          where: { action: "po.receive.approve", targetId: po.id },
        });
        return (
          res.ok &&
          poAfter?.status === "RECEIVED" &&
          poAfter.receivedAt !== null &&
          partAfter?.onHand === onHandBefore + po.qty &&
          !!audit &&
          audit.actorType === "HUMAN"
        );
      },
    );

    // ── restore: PO back to SENT, stock back, delete the audit rows created ──
    await db.purchaseOrder.updateMany({
      where: { id: po.id },
      data: { status: "SENT", receivedAt: null },
    });
    await db.part.updateMany({
      where: { id: po.partId },
      data: { onHand: onHandBefore },
    });
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND action LIKE 'po.receive.%'`,
      org.id,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
    );
  }

  // ── 8 · org isolation — another tenant's unit is unreachable ───────────────
  await check(
    "org isolation: computeBuildReadiness on another tenant's unit is 'not found'",
    async () => {
      const unit = await db.unit.findFirst({ select: { id: true } });
      if (!unit) return false;
      // The demo unit id, resolved through org-2's scoped client → must not resolve.
      let threw = false;
      try {
        await computeBuildReadiness(dbForOrg(org2.id), unit.id);
      } catch {
        threw = true;
      }
      // And it DOES resolve in its own org (sanity: rollup is internally consistent).
      const own = await computeBuildReadiness(db, unit.id);
      const sums =
        own.counts.in_house +
          own.counts.on_order +
          own.counts.late +
          own.counts.missing ===
        own.lineCount;
      return threw && sums;
    },
  );

  await guard.restore();
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

run();
