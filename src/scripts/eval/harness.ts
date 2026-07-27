/**
 * EVAL.1 — the agent/prompt evaluation harness (runner + fixtures).
 *
 * Treat prompts + tool wiring like source: version, review, TEST. This harness
 * regression-tests the agents' *behavior* — tool selection, structured-output
 * robustness, grounding/no-fabrication, and the moat headline behaviors — so a
 * prompt or tool change can't silently regress.
 *
 * Two tiers:
 *  - `offline` — deterministic, no API key. Scripts the `FakeModelClient` to drive
 *    the REAL runtime + REAL tools against the seeded fixtures, then asserts the tool
 *    loop + real tool output (not model prose). CI-safe; this is the gate.
 *  - `live` — opt-in behind `EVAL_LIVE=1` (+ a real key). Exercises the real model's
 *    tool-selection/grounding. Never in the default gate (documented in manual-checks).
 *
 * Fixtures: reads run against the seeded demo org (`org_axona_demo` — the golden
 * thread). The cold-start / no-fabrication cases need an org with NO memory, so the
 * harness creates a dedicated ephemeral eval org and DELETES it on teardown
 * (MIGRATE.1 self-clean discipline) — nothing it creates survives the run.
 */
import { dbForOrg, prisma, type OrgScopedDb } from "@axona/db";

export const DEMO_ORG = "org_axona_demo";
/** Ephemeral, per-tenant eval fixture — created at setup, deleted at teardown. */
export const EVAL_ORG = "org_eval_ephemeral";

export type EvalTier = "offline" | "live";
export type EvalCategory =
  | "tool-selection"
  | "structured-output"
  | "grounding"
  | "moat"
  | "prompt-contract";

/** The seeded reads + the ephemeral cold org, org-scoped (ISO.1). */
export interface EvalCtx {
  /** org_axona_demo — the seeded golden thread (NCR-118 → SERVO-204 → ECO-318). */
  demo: OrgScopedDb;
  /** the ephemeral eval org — cold (no memory/records): drives no-fabrication. */
  cold: OrgScopedDb;
  coldOrgId: string;
}

export interface EvalOutcome {
  pass: boolean;
  /** One line of evidence for the scoreboard (what was observed). */
  detail: string;
}

export interface EvalCase {
  id: string;
  title: string;
  tier: EvalTier;
  category: EvalCategory;
  run: (ctx: EvalCtx) => Promise<EvalOutcome>;
}

/** Create the ephemeral cold eval org (delete-then-create — idempotent across runs). */
async function setupFixtures(): Promise<EvalCtx> {
  await teardownFixtures(); // in case a prior run died before teardown
  await prisma.org.create({
    data: {
      id: EVAL_ORG,
      name: "Eval Harness (ephemeral)",
      enabledModules: [],
    },
  });
  return {
    demo: dbForOrg(DEMO_ORG),
    cold: dbForOrg(EVAL_ORG),
    coldOrgId: EVAL_ORG,
  };
}

/** Delete every row the harness created — the ephemeral org and anything under it. */
async function teardownFixtures(): Promise<void> {
  // The cold org is created empty and the eval never writes tenant rows under it,
  // but delete defensively (any future write-case stays self-cleaning).
  await prisma.memoryItem.deleteMany({ where: { orgId: EVAL_ORG } });
  await prisma.entityLink.deleteMany({ where: { orgId: EVAL_ORG } });
  await prisma.org.deleteMany({ where: { id: EVAL_ORG } });
}

export interface EvalRunResult {
  passed: number;
  failed: number;
  skipped: number;
  exitCode: number;
}

/**
 * Run the selected cases, print a scoreboard, self-clean, and return the exit code
 * (non-zero on ANY failure). `live` gates the opt-in tier; offline always runs.
 */
export async function runEval(
  cases: EvalCase[],
  opts: { live: boolean },
): Promise<EvalRunResult> {
  const selected = cases.filter(
    (c) => c.tier === "offline" || (c.tier === "live" && opts.live),
  );
  const skipped = cases.length - selected.length;

  console.log(
    `\nEVAL.1 — agent & prompt eval · ${selected.length} case(s)` +
      ` (offline${opts.live ? " + live" : ""})` +
      (skipped ? ` · ${skipped} live case(s) skipped — set EVAL_LIVE=1` : "") +
      "\n",
  );

  let passed = 0;
  let failed = 0;
  let ctx: EvalCtx | null = null;
  try {
    ctx = await setupFixtures();
    for (const c of selected) {
      let outcome: EvalOutcome;
      try {
        outcome = await c.run(ctx);
      } catch (e) {
        outcome = { pass: false, detail: `threw — ${(e as Error).message}` };
      }
      const tag = c.tier === "live" ? " (live)" : "";
      console.log(
        `  ${outcome.pass ? "PASS" : "FAIL"} [${c.category}] ${c.id}${tag} — ${c.title}`,
      );
      console.log(`         ${outcome.detail}`);
      outcome.pass ? passed++ : failed++;
    }
  } finally {
    if (ctx) await teardownFixtures();
  }

  console.log(
    `\n${failed === 0 ? "PASSED" : "FAILED"} — ${passed}/${selected.length} case(s) passed` +
      (skipped ? ` · ${skipped} skipped` : "") +
      "\n",
  );
  return {
    passed,
    failed,
    skipped,
    exitCode: failed === 0 ? 0 : 1,
  };
}
