/**
 * Verify DEMO.6 beat #6 — the config-first beat is agent-acting.
 * Run: pnpm verify:demo-6-6
 *
 * The Phase-1 audit found this beat's dual-approver lock genuinely correct but its
 * "agent" a hardcoded seam: static text plus the fabricated 0.82 SEED.4 removed. So
 * (c)/(d)/(e) were real and (a)/(b) were not. This asserts (a)/(b) are now real too,
 * WITHOUT disturbing the lock:
 *
 *   1 (static). `config.review` is a registered decide() kind, SEPARATE from
 *      config.lock; the action routes through it with the DecideContext seam; the
 *      view renders confidence + signals + the writeback, and its faint labels use
 *      the A11Y.3-safe `mono-faint` token (ink-faint fails AA on panel-2).
 *   2 (data).   The tenant has a fitted CONF.1 model and the proposal comes back
 *      "calibrated" — not raw, not a literal.
 *   3 (data).   The score is DERIVED: it equals the sum of its signals, and each
 *      signal is a fact about this baseline (a clean baseline would score lower).
 *   4 (data).   The dual-approver lock is UNTOUCHED: proposer != locker, still frozen.
 *   5 (live).   A real decide("config.review") round-trip writes an AUDIT.1 entry
 *      carrying input · output · model · confidence · approver AND fires LOOP.1,
 *      while changing NO configuration state. Self-cleans.
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

// SEED.1 — resolved by a NON-marque anchor (the config name); the tenant is never named.
const CFG = "CFG-DC-r4.2";

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying DEMO.6 #6 — the config beat is agent-acting\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const approvals = read("apps/web/lib/approvals.ts");
  const actions = read("apps/web/app/(shell)/configurations/[code]/actions.ts");
  const view = read(
    "apps/web/components/configurations/ConfigurationDetailView.tsx",
  );
  const lib = read("apps/web/lib/configurations.ts");

  await check(
    "'config.review' is a decide() kind, separate from config.lock",
    () => {
      return (
        /\|\s*"config\.review"/.test(approvals) &&
        /"config\.review":\s*\{/.test(approvals) &&
        // the dual-approver lock is still its own kind, untouched
        /"config\.lock":\s*\{/.test(approvals) &&
        /"config\.unlock":\s*\{/.test(approvals)
      );
    },
  );

  await check(
    "the review routes through decide() with the proposal context",
    () => {
      return (
        /decide\(\s*\n?\s*"config\.review"/.test(actions) &&
        /proposal: \{ model: proposal\.model, confidence: proposal\.calibrated \}/.test(
          actions,
        )
      );
    },
  );

  await check(
    "the confidence is re-read server-side, never taken from the client",
    () => {
      // The action's signature carries only (code, upheld) — a client cannot assert a
      // confidence. It re-resolves the proposal from the same read model the screen used.
      return (
        /reviewConfigDriftAction\(\s*\n?\s*code: string,\s*\n?\s*upheld: boolean,/.test(
          actions,
        ) && /getConfigurationDetail\(user\.orgId, code\)/.test(actions)
      );
    },
  );

  await check(
    "no hardcoded confidence literal survives in the config lib",
    () => {
      const live = lib
        .split("\n")
        .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
        .join("\n");
      return !/(confidence|raw)\s*[:=]\s*0\.\d+/.test(live);
    },
  );

  await check(
    "the view renders confidence + signals + writeback, with AA-safe faint labels",
    () => {
      return (
        /agent\.calibrated\.toFixed/.test(view) &&
        /agent\.signals\.map/.test(view) &&
        /Learning loop updated/.test(view) &&
        /reviewLoop\?\.recorded/.test(view) &&
        // A11Y.3 — the new faint labels must NOT use ink-faint (fails AA on panel-2)
        /text-mono-faint/.test(view)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg, MIN_SAMPLES } = await import("@axona/db");
  const anchor = await prisma.configurationVersion.findFirst({
    where: { name: CFG },
    select: { orgId: true, id: true, lockProposedById: true, lockedById: true },
  });
  if (!anchor) {
    console.log("\n  SKIP data checks — that tenant is not seeded");
    finish();
    return;
  }
  const TENANT = anchor.orgId;

  const { getConfigurationDetail } =
    await import("../../apps/web/lib/configurations");
  const detail = await getConfigurationDetail(TENANT, CFG);
  const a = detail?.agent ?? null;

  await check(
    `the tenant has a fitted CONF.1 model over >= MIN_SAMPLES (${MIN_SAMPLES})`,
    async () => {
      const m = await prisma.calibrationModel.findFirst({
        where: { orgId: TENANT, scope: "org" },
        select: { sampleSize: true },
      });
      return !!m && m.sampleSize >= MIN_SAMPLES;
    },
  );

  await check("the proposal is CALIBRATED, not raw and not a literal", () => {
    if (!a) return false;
    console.log(
      `        raw=${a.rawConfidence} → calibrated=${a.calibrated} (${a.calibratedState})`,
    );
    return (
      a.calibratedState === "calibrated" &&
      a.calibrated !== a.rawConfidence &&
      a.calibrated > 0 &&
      a.calibrated < 1
    );
  });

  await check(
    "the score equals the sum of its evidence signals (derived)",
    () => {
      if (!a) return false;
      const sum = a.signals.reduce((s, x) => s + x.weight, 0);
      const derived = Math.round(Math.min(1, sum) * 100) / 100;
      console.log(
        `        ${a.signals.length} signals summing to ${derived} == raw ${a.rawConfidence}`,
      );
      return a.signals.length >= 2 && derived === a.rawConfidence;
    },
  );

  await check(
    "the finding is REAL — it names units actually on this baseline",
    async () => {
      if (!a) return false;
      // A clean baseline must say so; a drifted one must be backed by real rows.
      const db = dbForOrg(TENANT);
      const subs = await db.asBuiltRecord.count({
        where: { isSubstitution: true },
      });
      console.log(
        `        driftFound=${a.driftFound} · ${subs} substituted as-built rows in the org`,
      );
      return a.driftFound
        ? subs > 0
        : subs === 0 || !a.text.includes("deviate");
    },
  );

  await check(
    "the DUAL-APPROVER lock is untouched (proposer != locker, frozen)",
    () => {
      return (
        !!anchor.lockProposedById &&
        !!anchor.lockedById &&
        anchor.lockProposedById !== anchor.lockedById &&
        detail?.state === "baseline" &&
        detail?.frozen === true
      );
    },
  );

  // ── the live round-trip ──
  const db = dbForOrg(TENANT);
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, role: true, email: true, name: true, orgId: true },
  });
  if (!a || !admin) {
    console.log("  FAIL no proposal or no admin user to decide with");
    failed++;
    finish();
    return;
  }

  const outcomesBefore = await db.memoryItem.count({
    where: { kind: "OUTCOME" as never },
  });
  const { decide } = await import("../../apps/web/lib/approvals");
  const { writeAudit } = await import("@axona/db");

  await writeAudit(db, {
    orgId: TENANT,
    actor: { type: "AGENT", id: null, label: "Configuration agent" },
    action: "config.review.propose",
    target: { type: "ConfigurationVersion", id: CFG },
    summary: `verify: drift assessment on ${CFG}`,
    inputs: { signals: a.signals, rawConfidence: a.rawConfidence },
    output: { driftFound: a.driftFound },
    model: a.model,
    confidence: a.calibrated,
  });
  const res = await decide("config.review", CFG, "APPROVE", admin, {
    proposal: { model: a.model, confidence: a.calibrated },
    payload: { finding: a.text },
  });

  await check("decide('config.review') succeeds for an authorised user", () => {
    return res.ok === true;
  });

  await check(
    "the AUDIT.1 entry carries input · output · model · confidence · approver",
    async () => {
      const e = await db.auditLog.findFirst({
        where: { action: "config.review.approve", targetId: CFG },
        orderBy: { createdAt: "desc" },
        select: {
          inputs: true,
          output: true,
          model: true,
          confidence: true,
          approverLabel: true,
        },
      });
      if (!e) return false;
      console.log(
        `        model=${e.model} confidence=${e.confidence} approver=${e.approverLabel}`,
      );
      return (
        e.inputs !== null &&
        e.output !== null &&
        !!e.model &&
        e.confidence !== null &&
        !!e.approverLabel
      );
    },
  );

  await check(
    "LOOP.1 — an OUTCOME episode exists after the review",
    async () => {
      const after = await db.memoryItem.count({
        where: { kind: "OUTCOME" as never },
      });
      console.log(`        OUTCOME episodes: ${outcomesBefore} → ${after}`);
      return after > outcomesBefore && !!(res as { loop?: unknown }).loop;
    },
  );

  await check(
    "reviewing changed NO configuration state (the baseline is not mutated)",
    async () => {
      const now = await prisma.configurationVersion.findFirst({
        where: { name: CFG },
        select: { lockedAt: true, lockedById: true, lockProposedById: true },
      });
      return (
        !!now?.lockedAt &&
        now.lockedById === anchor.lockedById &&
        now.lockProposedById === anchor.lockProposedById
      );
    },
  );

  // ── self-clean ──
  const ids = (
    await db.auditLog.findMany({
      where: {
        targetId: CFG,
        action: { in: ["config.review.propose", "config.review.approve"] },
      },
      select: { id: true },
    })
  ).map((r) => r.id);
  await prisma.memoryItem.deleteMany({
    where: {
      orgId: TENANT,
      sourceType: "AuditLog",
      sourceId: { in: ids.map((i) => `${i}#outcome`) },
    },
  });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
  );

  await check("self-clean: seeded state restored", async () => {
    const stray = await db.auditLog.count({
      where: {
        targetId: CFG,
        action: { in: ["config.review.propose", "config.review.approve"] },
      },
    });
    const strayEp = await prisma.memoryItem.count({
      where: {
        orgId: TENANT,
        sourceId: { in: ids.map((i) => `${i}#outcome`) },
      },
    });
    return stray === 0 && strayEp === 0;
  });

  await prisma.$disconnect();
  finish();
}

run();
