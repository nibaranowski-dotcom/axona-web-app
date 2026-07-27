/**
 * EVAL.1 — `pnpm eval`. Runs the agent/prompt eval cases and exits non-zero on any
 * regression. Offline tier is deterministic + key-free (the CI gate); the live tier
 * runs only with EVAL_LIVE=1 (+ a real key) — see docs/manual-checks.md.
 */
import { runEval } from "./eval/harness";
import { ALL_CASES } from "./eval/cases";

const live = process.env.EVAL_LIVE === "1";

// The offline cases assert behavior against the seeded golden thread (blast radius,
// memory recall, calibration) — they need the demo data. Without a DB, skip cleanly
// (exit 0) so `pnpm eval` is safe anywhere; the CI `eval` job supplies a seeded DB.
if (!process.env.DATABASE_URL) {
  console.log(
    "\nEVAL.1 — SKIP: DATABASE_URL not set (the eval needs the seeded demo data).\n",
  );
  process.exit(0);
}

runEval(ALL_CASES, { live })
  .then((r) => process.exit(r.exitCode))
  .catch((e) => {
    console.error("eval harness crashed:", e);
    process.exit(1);
  });
