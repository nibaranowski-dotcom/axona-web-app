/**
 * Verify TRUST.1 — progressive-trust ladder (earned-autonomy surface).
 * Run: pnpm verify:trust-1
 *
 *   1. computeTrust is deterministic + org-scoped: a rich approved history → RECOMMEND
 *      (or REVIEW_LIGHT for a non-gated kind); a 2nd org computes cold-start (no leak).
 *   2. Volume floor: one approval does not advance past SUGGEST.
 *   3. Calibration cap: an over-confident history caps the rung even with high approval.
 *   4. Hard ceiling: a gated (money/safety/contract) kind can NEVER compute/gate to an
 *      auto rung; decide() never auto-approves it regardless of rung/confidence.
 *   5. decide() records the rung on the decision + still writes AUDIT.1 (nothing bypasses).
 *   6. The trust panel renders rung + metrics + next-rung criteria; no invented reds.
 *   7. No new table (computed-on-read); CONF.1/AUDIT/RBAC/MEM/EVAL stay green (verify:all).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeTrust,
  isGatedActionKind,
  ceilingFor,
  AUTO_BOUNDED_ENABLED,
} from "@axona/db";

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
  console.log("\nVerifying TRUST.1 — progressive-trust ladder\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const ladder = read("packages/db/src/trust/ladder.ts");
  const readLayer = read("packages/db/src/trust/read.ts");
  const approvals = read("apps/web/lib/approvals.ts");
  const panel = read("apps/web/components/agents/TrustLadder.tsx");
  const agentsPage = read("apps/web/app/(shell)/agents/page.tsx");
  const schema = read("packages/db/prisma/schema.prisma");

  // ── static: the ladder, the hook, the surface, no new table ──
  await check(
    "ladder defines computeTrust + explicit thresholds + AUTO disabled",
    () => {
      return (
        /export function computeTrust\(/.test(ladder) &&
        /TRUST_THRESHOLDS/.test(ladder) &&
        /AUTO_BOUNDED_ENABLED = false/.test(ladder) &&
        /export function isGatedActionKind\(/.test(ladder) &&
        AUTO_BOUNDED_ENABLED === false
      );
    },
  );
  await check(
    "rung is COMPUTED on read from AUDIT.1 (no stored rung / new table)",
    () => {
      return (
        /actorType: "AGENT"/.test(readLayer) &&
        /actorType: "HUMAN"/.test(readLayer) &&
        // no speculative AgentTrust model in the schema
        !/model\s+AgentTrust\b/.test(schema)
      );
    },
  );
  await check(
    "decide() CONSULTS the rung, records it, hard-ceilings gated kinds",
    () => {
      return (
        /trustForTarget\(/.test(approvals) &&
        /advisoryAutonomy\(/.test(approvals) &&
        /trustRung: trust\.rung/.test(approvals) &&
        // gated → frictionRelaxEligible can never be true
        /!gated &&/.test(approvals) &&
        /isGatedActionKind\(kind\)/.test(approvals)
      );
    },
  );
  await check(
    "trust panel renders rung + metrics + next-rung, no invented reds",
    () => {
      const rendersRung = /RUNG_LABEL/.test(panel) && /cell\.rung/.test(panel);
      const rendersMetrics =
        /approval/.test(panel) &&
        /override/.test(panel) &&
        /calibration/.test(panel);
      const rendersNext = /nextRungCriteria/.test(panel);
      const noRed =
        !/text-red|bg-red|text-danger|#f?[0-9a-f]{0,2}0{0,2}00/i.test(panel);
      return rendersRung && rendersMetrics && rendersNext && noRed;
    },
  );
  await check("/agents surfaces the computed ladder (agentTrustLadder)", () => {
    return /agentTrustLadder\(/.test(agentsPage);
  });

  // ── pure: the mechanics (deterministic, no DB) ──
  await check("deterministic: identical inputs → identical result", () => {
    const input = {
      actionKind: "delivery.schedule",
      approvals: 27,
      rejections: 3,
      avgStatedConfidence: null,
      calibration: null,
    };
    return (
      JSON.stringify(computeTrust(input)) ===
      JSON.stringify(computeTrust(input))
    );
  });
  await check(
    "VOLUME FLOOR: one approval does not advance past SUGGEST",
    () => {
      const r = computeTrust({
        actionKind: "delivery.schedule",
        approvals: 1,
        rejections: 0,
        avgStatedConfidence: null,
        calibration: null,
      });
      return r.rung === "SUGGEST" && r.cappedBy === "volume";
    },
  );
  await check(
    "CALIBRATION CAP: over-confident history caps the rung despite HIGH approval",
    () => {
      // approval 0.80 (clears REVIEW_LIGHT's bar) BUT stated 0.96 vs approved 0.80 →
      // over-confident (gap 0.16 > 0.15) → capped at SUGGEST, cannot even reach RECOMMEND.
      const r = computeTrust({
        actionKind: "delivery.schedule", // non-gated — so only calibration can cap it
        approvals: 32,
        rejections: 8,
        avgStatedConfidence: 0.96,
        calibration: null,
      });
      return (
        r.metrics.overconfident === true &&
        r.metrics.approvalRate >= 0.8 &&
        r.rung === "SUGGEST" &&
        r.cappedBy === "calibration"
      );
    },
  );
  await check(
    "HARD CEILING: a gated kind can NEVER compute to an auto rung (perfect record → RECOMMEND)",
    () => {
      const gatedPerfect = computeTrust({
        actionKind: "po.approve",
        approvals: 40,
        rejections: 0,
        avgStatedConfidence: null,
        calibration: null,
      });
      const gatedHuge = computeTrust({
        actionKind: "creditnote.issue",
        approvals: 1000,
        rejections: 0,
        avgStatedConfidence: 0.5,
        calibration: null,
      });
      // RECOMMEND is the ceiling for gated kinds — never REVIEW_LIGHT/AUTO_BOUNDED,
      // no matter how perfect or voluminous the record.
      return (
        isGatedActionKind("po.approve") &&
        ceilingFor("po.approve") === "RECOMMEND" &&
        gatedPerfect.rung === "RECOMMEND" &&
        gatedHuge.rung === "RECOMMEND"
      );
    },
  );
  await check(
    "non-gated tops out at REVIEW_LIGHT (AUTO_BOUNDED defined but disabled)",
    () => {
      const r = computeTrust({
        actionKind: "delivery.schedule",
        approvals: 100,
        rejections: 0,
        avgStatedConfidence: null,
        calibration: null,
      });
      return (
        r.rung === "REVIEW_LIGHT" &&
        r.ceiling === "REVIEW_LIGHT" &&
        r.nextRung === null &&
        /disabled/i.test(r.nextRungCriteria.join(" "))
      );
    },
  );
  await check("unknown action-kinds default to GATED (fail-safe)", () => {
    return isGatedActionKind("totally.unknown.kind") === true;
  });

  if (!process.env.DATABASE_URL) {
    console.log(
      "\n  SKIP DB checks — DATABASE_URL not set (static + pure only)",
    );
    finish();
    return;
  }

  const { prisma, dbForOrg, agentTrustLadder, computeAgentTrust } =
    await import("@axona/db");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { captureSeededState } = await import("./lib/self-clean");

  // ── DB: org-scoped ladder + no leak ──
  const demoLadder = await agentTrustLadder(dbForOrg(DEMO), DEMO);
  const cell = (kind: string) => demoLadder.find((c) => c.actionKind === kind);
  await check(
    "demo ladder: delivery.schedule → REVIEW_LIGHT · eco.release → RECOMMEND (gated cap) · po.draft → SUGGEST (over-confident)",
    () => {
      const del = cell("delivery.schedule");
      const eco = cell("eco.release");
      const po = cell("po.draft");
      return (
        del?.rung === "REVIEW_LIGHT" &&
        del?.gated === false &&
        eco?.rung === "RECOMMEND" &&
        eco?.gated === true &&
        eco?.cappedBy === "ceiling" && // capped by the hard ceiling, not the record
        po?.rung === "SUGGEST" &&
        po?.metrics.overconfident === true
      );
    },
  );
  await check(
    "org-scoped (no leak): the demo's delivery.schedule cell is ABSENT from the 2nd org; it computes cold-start SUGGEST",
    async () => {
      const isoLadder = await agentTrustLadder(dbForOrg(SECOND), SECOND);
      const leaked = isoLadder.some(
        (c) =>
          c.actionKind === "delivery.schedule" ||
          c.agentLabel === "Fulfillment planner",
      );
      const cold = await computeAgentTrust(dbForOrg(SECOND), SECOND, {
        agentLabel: "Fulfillment planner",
        actionKind: "delivery.schedule",
      });
      return !leaked && cold.rung === "SUGGEST" && cold.metrics.volume === 0;
    },
  );

  // ── DB: decide() records the rung + writes AUDIT.1; hard ceiling holds at the gate ──
  const guard = await captureSeededState(prisma, ["AuditLog", "PurchaseOrder"]);
  const org = await prisma.org.findFirst({ where: { id: DEMO } });
  const db = dbForOrg(DEMO);
  const po = await db.purchaseOrder.findFirst({
    where: { status: "AWAITING_APPROVAL" },
    select: { id: true },
  });
  const opsUser = await prisma.user.findFirst({
    where: { orgId: DEMO, role: "OPS" },
    select: { id: true, email: true, name: true },
  });
  const ops = {
    id: opsUser?.id ?? "ops",
    role: "OPS" as const,
    email: opsUser?.email ?? "ops@demo",
    name: opsUser?.name ?? "M. Osei",
    orgId: DEMO,
  };

  await check(
    "decide(po.approve) records the rung on an AUDIT.1 entry + is HARD-CEILINGED (gated, never auto)",
    async () => {
      if (!po) return false;
      const res = await decide("po.approve", po.id, "APPROVE", ops);
      if (!res.ok) return false;
      // The gated kind is NEVER auto-eligible, regardless of rung/confidence.
      const hardCeiling =
        res.trust.gated === true && res.trust.frictionRelaxEligible === false;
      // The decision still wrote an immutable AUDIT.1 entry, by a HUMAN, with the rung.
      const audit = await db.auditLog.findFirst({
        where: { action: "po.approve.approve", targetId: po.id },
        orderBy: { createdAt: "desc" },
      });
      const output = (audit?.output ?? {}) as Record<string, unknown>;
      const rungRecorded =
        !!audit &&
        audit.actorType === "HUMAN" && // human approved — nothing auto-acted
        typeof output.trustRung === "string" &&
        output.frictionRelaxEligible === false;
      return hardCeiling && rungRecorded;
    },
  );

  // self-clean: restore the PO + delete the po.approve.% audit rows (immutable-log rule).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND action LIKE 'po.approve.%'`,
    org?.id ?? DEMO,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
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

run().then(() => process.exit(failed > 0 ? 1 : 0));
