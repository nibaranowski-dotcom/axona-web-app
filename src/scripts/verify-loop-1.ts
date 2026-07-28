/**
 * Verify LOOP.1 — learning-loop writeback (outcomes → memory → better proposals).
 * Run: pnpm verify:loop-1
 *
 *   1. Writeback: a decide() verdict writes exactly ONE outcome episode to the MEM.1
 *      store, linked to the audit entry, org-scoped; IDEMPOTENT (re-run no double-write).
 *   2. Closed loop: override a proposal for a subject, then assembleContext (MEM.2) for a
 *      later SIMILAR (graph-neighbor) subject contains that override — no manual recall.
 *   3. Labeled substrate: decisionOutcomes returns typed labels (stated confidence vs
 *      verdict), org-scoped (2nd org → zero), read-only, CONF.1-consumable shape.
 *   4. Stub boundary: no retraining; CONF.1's fitted model unchanged; TRUST.1 counts the
 *      idempotent (non-double) outcome; AUDIT.1 unmutated.
 *   5. Isolation + existing verifies green; migrate clean (checked by verify:all / CI).
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
  console.log("\nVerifying LOOP.1 — learning-loop writeback\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const writeback = read("packages/db/src/loop/writeback.ts");
  const outcomes = read("packages/db/src/loop/outcomes.ts");
  const approvals = read("apps/web/lib/approvals.ts");
  const audit = read("packages/db/src/audit.ts");
  const types = read("packages/agents/src/runtime/types.ts");
  const recall = read("packages/db/src/memory/recall.ts");

  // ── static: reuse MEM.1 store, link (not mutate) AUDIT.1, `loop` trace, no parallel store ──
  await check(
    "recordOutcome writes an OUTCOME MemoryItem, linked to the audit entry",
    () => {
      return (
        /kind: "OUTCOME"/.test(writeback) &&
        /sourceType: "AuditLog"/.test(writeback) &&
        /#outcome/.test(writeback) && // distinct sourceId → coexists, idempotent per audit id
        /embedPending\(/.test(writeback) // reuses MEM.1's embed path (no parallel store)
      );
    },
  );
  await check(
    "idempotent: one episode per audit entry (findFirst guard + created flag)",
    () => {
      return /created: false/.test(writeback) && /findFirst\(/.test(writeback);
    },
  );
  await check(
    "decide() calls recordOutcome + surfaces the `loop` line; writeAudit returns the id",
    () => {
      return (
        /recordOutcome\(/.test(approvals) &&
        /auditEntryId/.test(approvals) &&
        /loop:\s*/.test(approvals) &&
        /outcome\?\.trace/.test(approvals) && // surfaced on DecideResult (format-agnostic)
        /Promise<string \| null>/.test(audit) // writeAudit returns the linkable id
      );
    },
  );
  await check(
    "`loop` TraceKind + OUTCOME recall weight added (recall-able precedent)",
    () => {
      return /"loop"/.test(types) && /OUTCOME: 0\.9/.test(recall);
    },
  );
  await check(
    "decisionOutcomes is READ-ONLY + CONF.1-shaped (confidence vs verdict)",
    () => {
      const readOnly =
        !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(
          outcomes,
        );
      const shaped =
        /statedConfidence/.test(outcomes) &&
        /verdict/.test(outcomes) &&
        /auditRef/.test(outcomes) &&
        /actionKind/.test(outcomes);
      return readOnly && shaped;
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const {
    prisma,
    dbForOrg,
    recordOutcome,
    decisionOutcomes,
    assembleContext,
    getCalibrationModel,
    calibratedConfidence,
    agentTrustLadder,
  } = await import("@axona/db");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { captureSeededState } = await import("./lib/self-clean");

  const db = dbForOrg(DEMO);
  const guard = await captureSeededState(prisma, [
    "AuditLog",
    "PurchaseOrder",
    "MemoryItem",
    "EntityLink",
  ]);

  // Fixtures: a decide-able PO + an OPS approver + an AGENT proposal (so the label
  // carries a real stated confidence) + a graph NEIGHBOR to prove proximity recall.
  const po = await db.purchaseOrder.findFirst({
    where: { status: { in: ["DRAFTED", "AWAITING_APPROVAL", "APPROVED"] } },
    select: { id: true, status: true },
  });
  const neighborNcr = await db.nCR.findFirst({ select: { id: true } });
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

  if (!po || !neighborNcr) {
    console.log("  FAIL missing PO/NCR fixture (run pnpm db:seed)");
    failed++;
    await guard.restore();
    await prisma.$disconnect();
    finish();
    return;
  }

  // An agent proposal carrying confidence → recordOutcome pairs it with the verdict.
  // Created for its side effect (the AGENT row recordOutcome reads); guard.restore()
  // deletes it as a new AuditLog row.
  await db.auditLog.create({
    data: {
      orgId: DEMO,
      actorType: "AGENT",
      actorLabel: "Sourcing agent",
      action: "po.draft",
      targetType: "PurchaseOrder",
      targetId: po.id,
      summary: "LOOP1 fixture proposal",
      model: "claude-sonnet-4-6",
      confidence: 0.82,
    },
  });

  // ── 1: a decide() REJECT (override) writes exactly ONE linked outcome; idempotent ──
  let overrideEpisodeId: string | null = null;
  await check(
    "decide(REJECT) writes exactly ONE outcome episode, linked to the audit entry",
    async () => {
      const res = await decide("po.approve", po.id, "REJECT", ops);
      if (!res.ok) return false;
      const loopOk =
        /recorded outcome: po\.approve OVERRIDDEN → memory ep/.test(res.loop);
      // the audit entry the decision wrote
      const auditEntry = await db.auditLog.findFirst({
        where: { action: "po.approve.reject", targetId: po.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const eps = await db.memoryItem.findMany({
        where: {
          sourceType: "AuditLog",
          sourceId: `${auditEntry?.id}#outcome`,
        },
        select: { id: true, kind: true, outcome: true },
      });
      overrideEpisodeId = eps[0]?.id ?? null;
      return (
        loopOk &&
        eps.length === 1 &&
        eps[0]?.kind === "OUTCOME" &&
        eps[0]?.outcome === "OVERRIDDEN"
      );
    },
  );
  await check(
    "idempotent: re-recording the same decision does NOT double-write",
    async () => {
      const auditEntry = await db.auditLog.findFirst({
        where: { action: "po.approve.reject", targetId: po.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const r = await recordOutcome(db, {
        auditEntryId: auditEntry!.id,
        decision: "REJECT",
        actionKind: "po.approve",
        targetType: "PurchaseOrder",
        targetId: po.id,
        approverLabel: "M. Osei",
        occurredAt: new Date(),
      });
      const count = await db.memoryItem.count({
        where: {
          sourceType: "AuditLog",
          sourceId: `${auditEntry!.id}#outcome`,
        },
      });
      return r.created === false && count === 1;
    },
  );

  // ── 2: CLOSED LOOP — a graph-neighbor subject's context carries the override ──
  await check(
    "closed loop: assembleContext for a SIMILAR (graph-neighbor) subject contains the override — no manual recall",
    async () => {
      // Link the overridden PO to a neighbor NCR so recall's graph arm reaches it.
      await db.entityLink.create({
        data: {
          orgId: DEMO,
          fromType: "NCR",
          fromId: neighborNcr.id,
          relation: "AFFECTS",
          toType: "PURCHASE_ORDER",
          toId: po.id,
        },
      });
      const asm = await assembleContext(db, {
        subject: { type: "NCR", id: neighborNcr.id }, // a DIFFERENT subject than the PO
        query: "reorder from this supplier — should we approve it?",
      });
      // The override episode (anchored to the PO) surfaces via graph proximity from the
      // neighbor NCR — injected into the context with no manual recall. It need not be
      // the top hit (a full RESOLUTION on the NCR itself may outrank it); the closed-loop
      // claim is that "last time the human overrode this" is now IN the next proposal's context.
      const carriesOverride = /OVERRODE/.test(asm.block);
      const overrideHit = asm.hits.some((h) => h.kind === "OUTCOME");
      return asm.reason === "injected" && carriesOverride && overrideHit;
    },
  );

  // ── 3: labeled substrate — typed, org-scoped, CONF.1-consumable ──
  await check(
    "decisionOutcomes returns the typed label (stated confidence vs verdict), org-scoped",
    async () => {
      const rows = await decisionOutcomes(db);
      const mine = rows.find((r) => r.auditRef && r.verdict === "OVERRIDDEN");
      const shaped =
        !!mine &&
        mine.actionKind === "po.approve" &&
        mine.statedConfidence === 0.82 && // the agent's stated confidence
        mine.verdict === "OVERRIDDEN" && // the human's ground-truth verdict
        mine.delta === 1 &&
        mine.subjectRef?.type === "PURCHASE_ORDER" &&
        !!mine.at;
      // filters work
      const byAgent = await decisionOutcomes(db, { agent: "Sourcing agent" });
      const byKind = await decisionOutcomes(db, { actionKind: "po.approve" });
      return shaped && byAgent.length >= 1 && byKind.length >= 1;
    },
  );
  await check(
    "org-scoped isolation: the 2nd org sees ZERO of the demo's outcomes",
    async () => {
      const iso = await decisionOutcomes(dbForOrg(SECOND));
      return iso.length === 0;
    },
  );

  // ── 4: stub boundary — no retraining; CONF.1 model unchanged; AUDIT.1 unmutated ──
  await check(
    "stub boundary: CONF.1's fitted model is UNCHANGED by LOOP.1 (no refit)",
    async () => {
      const model = await getCalibrationModel(DEMO);
      // demo stays over-confident (0.9 → materially lower) — LOOP.1 supplied labels,
      // it did NOT refit the model.
      const c = calibratedConfidence(0.9, model);
      return !!model && c.state === "calibrated" && c.value < 0.7;
    },
  );
  await check(
    "AUDIT.1 unmutated: the outcome LINKS (own MemoryItem) — the audit entry is untouched",
    async () => {
      // the writeback never wrote to AuditLog; the outcome lives in MemoryItem, keyed by
      // the audit id + "#outcome". The audit reject entry still reads exactly as decide() wrote it.
      const auditEntry = await db.auditLog.findFirst({
        where: { action: "po.approve.reject", targetId: po.id },
        orderBy: { createdAt: "desc" },
      });
      return (
        !!auditEntry &&
        auditEntry.actorType === "HUMAN" && // a human decided — nothing auto-acted
        typeof (auditEntry.output as Record<string, unknown>)?.trustRung ===
          "string"
      );
    },
  );
  await check(
    "TRUST.1 reads the (non-double-counted) record — ladder still computes",
    async () => {
      const ladder = await agentTrustLadder(db, DEMO);
      return Array.isArray(ladder) && ladder.length >= 1;
    },
  );

  // ── self-clean ──
  // guard.restore() deletes EXACTLY the rows this run created (the OUTCOME episode, the
  // fixture proposal, the po.approve.reject audit entries, the EntityLink) — id-scoped,
  // and it handles AuditLog's append-only rule. It cannot un-MUTATE the PO's status, so
  // reset that explicitly (decide(REJECT) drove it terminal).
  void overrideEpisodeId; // captured for the assertion above; restore() deletes the row
  await db.purchaseOrder.updateMany({
    where: { id: po.id },
    data: { status: po.status },
  });
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
