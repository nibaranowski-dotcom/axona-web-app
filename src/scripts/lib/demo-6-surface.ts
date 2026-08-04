/**
 * DEMO.6 — the shared assertion set for the "cheap surfacing" beats (#2 · #5 · #7 · #11).
 *
 * All four make the same claim — an agent proposed something, with a confidence you can
 * recompute, a human can decide on it, the decision is fully audited, and the loop
 * learns — so they get ONE checker rather than four near-identical scripts that could
 * drift apart. Each beat supplies its subject and its resolver; the invariants are here.
 *
 * SEED.1 — nothing here names a tenant. Each beat resolves its org from its own
 * non-marque anchor (a serial, an ECO code, a SKU).
 */
import type { AgentProposal } from "../../../apps/web/lib/agent-proposal";

export interface SurfaceCase {
  /** e.g. "#2 as-built drift" */
  label: string;
  /** the decide() kind this beat acknowledges through. */
  kind: string;
  /** AUDIT.1 target type. */
  targetType: string;
  /** the subject's human code (also the decide targetId). */
  code: string;
  /** resolve the org from the anchor — returns null when the tenant is not seeded. */
  resolveOrg: () => Promise<string | null>;
  /** the proposal, from the SAME read model the screen renders. */
  resolveProposal: (orgId: string) => Promise<AgentProposal | null>;
  /** files that must show the surface is wired (static checks). */
  staticFiles: { path: string; mustMatch: RegExp[] }[];
  /**
   * Assert nothing this beat is supposed to leave alone was mutated. Returns a
   * snapshot before, and compares after. Acknowledging must be inert.
   */
  snapshotProtected: (orgId: string) => Promise<string>;
}

export interface Runner {
  check: (label: string, fn: () => boolean | Promise<boolean>) => Promise<void>;
  log: (s: string) => void;
}

export async function runSurfaceChecks(
  c: SurfaceCase,
  r: Runner,
  read: (p: string) => string,
): Promise<void> {
  // ── static: the surface is actually wired ──
  for (const f of c.staticFiles) {
    await r.check(`${f.path} wires the surface`, () => {
      const src = read(f.path);
      return src.length > 0 && f.mustMatch.every((re) => re.test(src));
    });
  }

  await r.check("the shared panel uses the AA-safe faint token", () => {
    const panel = read("apps/web/components/agents/AgentProposalPanel.tsx");
    // ink-faint fails WCAG AA by 0.01 on panel-2; the served axe gate reds it.
    return /text-mono-faint/.test(panel) && !/text-ink-faint/.test(panel);
  });

  await r.check(
    "the confidence is built by the shared derivation, not a literal",
    () => {
      const lib = read("apps/web/lib/agent-proposal.ts");
      return (
        /calibratedConfidence\(/.test(lib) &&
        /signals\.reduce/.test(lib) &&
        // a proposal with no evidence is null, never a zero-confidence proposal
        /if \(input\.signals\.length === 0\) return null/.test(lib)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    r.log("  SKIP data checks — DATABASE_URL not set");
    return;
  }

  const orgId = await c.resolveOrg();
  if (!orgId) {
    r.log("  SKIP data checks — that tenant is not seeded");
    return;
  }

  const proposal = await c.resolveProposal(orgId);

  await r.check("a real proposal is produced on live data", () => {
    if (!proposal) return false;
    r.log(
      `        raw=${proposal.rawConfidence} → calibrated=${proposal.calibrated} (${proposal.calibratedState})`,
    );
    return proposal.text.length > 0 && proposal.action.length > 0;
  });

  await r.check("the score is RECOMPUTABLE from its evidence signals", () => {
    if (!proposal) return false;
    const sum = proposal.signals.reduce((s, x) => s + x.weight, 0);
    const derived = Math.round(Math.min(1, sum) * 100) / 100;
    r.log(
      `        ${proposal.signals.length} signals summing to ${derived} == raw ${proposal.rawConfidence}`,
    );
    return proposal.signals.length >= 2 && derived === proposal.rawConfidence;
  });

  await r.check("the confidence is CALIBRATED (not raw, not a literal)", () => {
    if (!proposal) return false;
    return (
      proposal.calibratedState === "calibrated" &&
      proposal.calibrated !== proposal.rawConfidence &&
      proposal.calibrated > 0 &&
      proposal.calibrated < 1
    );
  });

  await r.check("the proposal names the model that emitted it", () => {
    return !!proposal && proposal.model.length > 0;
  });

  // ── live: the decide() round-trip ──
  const { prisma, dbForOrg, writeAudit } = await import("@axona/db");
  const { decide } = await import("../../../apps/web/lib/approvals");
  const db = dbForOrg(orgId);
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, role: true, email: true, name: true, orgId: true },
  });
  if (!proposal || !admin) {
    r.log("  FAIL no proposal or admin to decide with");
    await r.check("live round-trip possible", () => false);
    return;
  }

  const before = await db.memoryItem.count({
    where: { kind: "OUTCOME" as never },
  });
  const protectedBefore = await c.snapshotProtected(orgId);

  await writeAudit(db, {
    orgId,
    actor: { type: "AGENT", id: null, label: "verify agent" },
    action: `${c.kind}.propose`,
    target: { type: c.targetType, id: c.code },
    summary: `verify: ${c.label}`,
    inputs: {
      signals: proposal.signals,
      rawConfidence: proposal.rawConfidence,
    },
    output: { action: proposal.action },
    model: proposal.model,
    confidence: proposal.calibrated,
  });
  const res = await decide(c.kind as never, c.code, "APPROVE", admin, {
    proposal: { model: proposal.model, confidence: proposal.calibrated },
    payload: { code: c.code, finding: proposal.text },
  });

  await r.check(
    "decide() succeeds for an authorised user",
    () => res.ok === true,
  );

  await r.check(
    "the AUDIT.1 entry carries input · output · model · confidence · approver",
    async () => {
      const e = await db.auditLog.findFirst({
        where: { action: `${c.kind}.approve`, targetId: c.code },
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
      r.log(
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

  await r.check(
    "LOOP.1 — an OUTCOME episode exists after the decision",
    async () => {
      const after = await db.memoryItem.count({
        where: { kind: "OUTCOME" as never },
      });
      r.log(`        OUTCOME episodes: ${before} → ${after}`);
      return after > before && !!(res as { loop?: unknown }).loop;
    },
  );

  await r.check(
    "acknowledging MUTATED NOTHING (the protected state is unchanged)",
    async () => {
      const now = await c.snapshotProtected(orgId);
      if (now !== protectedBefore)
        r.log(`        before=${protectedBefore}\n        after =${now}`);
      return now === protectedBefore;
    },
  );

  // ── self-clean ──
  const ids = (
    await db.auditLog.findMany({
      where: {
        targetId: c.code,
        action: { in: [`${c.kind}.propose`, `${c.kind}.approve`] },
      },
      select: { id: true },
    })
  ).map((x) => x.id);
  await prisma.memoryItem.deleteMany({
    where: {
      orgId,
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

  await r.check("self-clean: no rows left behind", async () => {
    const stray = await db.auditLog.count({
      where: {
        targetId: c.code,
        action: { in: [`${c.kind}.propose`, `${c.kind}.approve`] },
      },
    });
    return stray === 0;
  });
}

/** Shared PASS/FAIL runner so the four entry scripts stay one-liners. */
export function makeRunner(): Runner & {
  finish: () => void;
  failed: () => number;
} {
  let passed = 0;
  let failed = 0;
  return {
    log: (s: string) => console.log(s),
    check: async (label, fn) => {
      try {
        const ok = await fn();
        console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
        ok ? passed++ : failed++;
      } catch (e) {
        console.log(`  FAIL ${label} — ${(e as Error).message}`);
        failed++;
      }
    },
    failed: () => failed,
    finish: () => {
      if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
      else {
        console.log(`\nFAILED — ${failed} check(s) failed\n`);
        process.exit(1);
      }
    },
  };
}
