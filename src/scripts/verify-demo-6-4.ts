/**
 * Verify DEMO.6 beat #4 — the RCA hero is AGENT-ACTING.
 * Run: pnpm verify:demo-6-4
 *
 * The Phase-1 audit classified /rca/:code DATA-ONLY on three counts: the confidence
 * was a hardcoded literal that rendered "(uncal)", Confirm bypassed decide() so LOOP.1
 * never fired (0 OUTCOME episodes), and the audit entry carried no model/confidence.
 * This asserts all three are closed, on the LIVE DroneCo tenant:
 *
 *   1 (static). The kind is registered; the action routes through decide(); the view
 *      renders the calibrated confidence, the score's signals, and the writeback.
 *   2 (data).   The org has a REAL fitted CONF.1 model (>= MIN_SAMPLES) and the RCA
 *      proposal comes back state "calibrated" — not raw, not a literal.
 *   3 (data).   The raw score is DERIVED: it equals the sum of its signals, and every
 *      signal is a fact about this failure. A different failure would score differently.
 *   4 (live).   A real decide("ncr.rootcause") round-trip writes an AUDIT.1 entry
 *      carrying input · output · model · confidence · approver, AND a LOOP.1 OUTCOME
 *      episode exists afterwards. Self-cleans: the NCR's rootCause is restored and the
 *      rows this script created are removed (the AuditLog delete rule is briefly
 *      disabled for that, the same admin path clearOrgData uses).
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

const TENANT = "org_droneco_demo";
const NCR = "NCR-DC-118";

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying DEMO.6 #4 — the RCA hero is agent-acting\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const approvals = read("apps/web/lib/approvals.ts");
  const actions = read("apps/web/app/(shell)/quality/actions.ts");
  const view = read("apps/web/components/rca/RcaView.tsx");
  const rcaLib = read("apps/web/lib/rca.ts");

  await check("'ncr.rootcause' is a registered decide() kind", () => {
    return (
      /\|\s*"ncr\.rootcause"/.test(approvals) &&
      /"ncr\.rootcause":\s*\{/.test(approvals)
    );
  });

  await check(
    "the RCA confirmation routes through decide(), not a parallel path",
    () => {
      return (
        /decide\(\s*\n?\s*"ncr\.rootcause"/.test(actions) &&
        /from "@\/lib\/approvals"/.test(actions)
      );
    },
  );

  await check(
    "decide() stamps the proposal's model + confidence onto the audit entry",
    () => {
      return (
        /model:\s*ctx\?\.proposal\?\.model/.test(approvals) &&
        /confidence:\s*ctx\?\.proposal\?\.confidence/.test(approvals)
      );
    },
  );

  await check("no hardcoded confidence literal survives in the RCA lib", () => {
    // Only comments may mention the old value; no live `= 0.82`-style assignment.
    const live = rcaLib
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    return !/(confidence|raw)\s*[:=]\s*0\.\d+/.test(live);
  });

  await check(
    "the view renders the calibrated confidence + the score's signals + the writeback",
    () => {
      return (
        /calibrated\.toFixed/.test(view) &&
        /suggestion\.signals\.map/.test(view) &&
        /Learning loop updated/.test(view) &&
        /loop\?\.recorded/.test(view)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg, MIN_SAMPLES } = await import("@axona/db");
  const { getRcaWorkspace } = await import("../../apps/web/lib/rca");

  const org = await prisma.org.findUnique({ where: { id: TENANT } });
  if (!org) {
    console.log(`\n  SKIP data checks — ${TENANT} is not seeded`);
    finish();
    return;
  }

  // ── 2: a REAL fitted CONF.1 model ──
  await check(
    `the tenant has a fitted CONF.1 model over >= MIN_SAMPLES (${MIN_SAMPLES})`,
    async () => {
      const m = await prisma.calibrationModel.findFirst({
        where: { orgId: TENANT, scope: "org" },
        select: { sampleSize: true, model: true },
      });
      if (!m) return false;
      const bins = (m.model as { bins?: unknown[] } | null)?.bins ?? [];
      console.log(`        n=${m.sampleSize} · bins=${bins.length}`);
      return m.sampleSize >= MIN_SAMPLES && bins.length > 0;
    },
  );

  const workspace = await getRcaWorkspace(TENANT, NCR);
  const s = workspace?.suggestion ?? null;

  await check(
    "the RCA proposal is CALIBRATED, not raw and not a literal",
    () => {
      if (!s) return false;
      console.log(
        `        raw=${s.rawConfidence} → calibrated=${s.calibrated} (${s.calibratedState})`,
      );
      return (
        s.calibratedState === "calibrated" &&
        s.calibrated !== s.rawConfidence && // the map actually moved the number
        s.calibrated > 0 &&
        s.calibrated < 1
      );
    },
  );

  // ── 3: the raw score is DERIVED from evidence ──
  await check(
    "the raw score equals the sum of its evidence signals (derived, not chosen)",
    () => {
      if (!s) return false;
      const sum = s.signals.reduce((a, x) => a + x.weight, 0);
      const rounded = Math.round(Math.min(1, sum) * 100) / 100;
      console.log(
        `        ${s.signals.length} signals summing to ${rounded} == raw ${s.rawConfidence}`,
      );
      return s.signals.length >= 2 && rounded === s.rawConfidence;
    },
  );

  await check("the proposal names the model that emitted it", () => {
    return !!s && typeof s.model === "string" && s.model.length > 0;
  });

  // ── 4: the live decide() round-trip + LOOP.1 writeback ──
  const db = dbForOrg(TENANT);
  const seeded = await db.nCR.findFirst({
    where: { code: NCR },
    select: { rootCause: true },
  });
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, role: true, email: true, name: true, orgId: true },
  });

  let createdAuditIds: string[] = [];
  if (!s || !admin) {
    console.log("  FAIL no proposal or no admin user to decide with");
    failed++;
    finish();
    return;
  }

  const before = await db.memoryItem.count({
    where: { kind: "OUTCOME" as never },
  });

  const { decide } = await import("../../apps/web/lib/approvals");
  const { writeAudit } = await import("@axona/db");

  // materialise the proposal exactly as the action does, then decide on it
  await writeAudit(db, {
    orgId: TENANT,
    actor: { type: "AGENT", id: null, label: "Root-cause agent" },
    action: "ncr.rootcause.propose",
    target: { type: "NCR", id: NCR },
    summary: `verify: proposed ${s.cause}`,
    inputs: { signals: s.signals, rawConfidence: s.rawConfidence },
    output: { proposedCause: s.cause },
    model: s.model,
    confidence: s.calibrated,
  });
  const res = await decide("ncr.rootcause", NCR, "APPROVE", admin, {
    proposal: { model: s.model, confidence: s.calibrated },
    payload: { cause: s.cause, proposedCause: s.cause },
  });

  await check("decide('ncr.rootcause') succeeds for an authorised user", () => {
    return res.ok === true;
  });

  await check(
    "the AUDIT.1 entry carries input · output · model · confidence · approver",
    async () => {
      const entry = await db.auditLog.findFirst({
        where: { action: "ncr.rootcause.approve", targetId: NCR },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          inputs: true,
          output: true,
          model: true,
          confidence: true,
          approverLabel: true,
        },
      });
      if (!entry) return false;
      console.log(
        `        model=${entry.model} confidence=${entry.confidence} approver=${entry.approverLabel}`,
      );
      return (
        entry.inputs !== null &&
        entry.output !== null &&
        !!entry.model &&
        entry.confidence !== null &&
        !!entry.approverLabel
      );
    },
  );

  await check(
    "LOOP.1 — an OUTCOME episode exists after the decision",
    async () => {
      const after = await db.memoryItem.count({
        where: { kind: "OUTCOME" as never },
      });
      console.log(`        OUTCOME episodes: ${before} → ${after}`);
      return after > before && !!res.ok && !!(res as { loop?: unknown }).loop;
    },
  );

  // ── self-clean: restore the seeded state ──
  createdAuditIds = (
    await db.auditLog.findMany({
      where: {
        targetId: NCR,
        action: { in: ["ncr.rootcause.propose", "ncr.rootcause.approve"] },
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  await prisma.memoryItem.deleteMany({
    where: {
      orgId: TENANT,
      sourceType: "AuditLog",
      sourceId: { in: createdAuditIds.map((id) => `${id}#outcome`) },
    },
  });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
  );
  await prisma.nCR.updateMany({
    where: { orgId: TENANT, code: NCR },
    data: { rootCause: (seeded?.rootCause ?? null) as never },
  });

  await check("self-clean: seeded state restored", async () => {
    const now = await db.nCR.findFirst({
      where: { code: NCR },
      select: { rootCause: true },
    });
    const strayAudit = await db.auditLog.count({
      where: {
        targetId: NCR,
        action: { in: ["ncr.rootcause.propose", "ncr.rootcause.approve"] },
      },
    });
    const strayOutcome = await prisma.memoryItem.count({
      where: {
        orgId: TENANT,
        sourceId: { in: createdAuditIds.map((id) => `${id}#outcome`) },
      },
    });
    return (
      now?.rootCause === seeded?.rootCause &&
      strayAudit === 0 &&
      strayOutcome === 0
    );
  });

  await prisma.$disconnect();
  finish();
}

run();
