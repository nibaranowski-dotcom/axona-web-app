/**
 * Verify EVAL.1 — agent & prompt evaluation harness.
 * Run: pnpm verify:eval-1
 *
 *   1. The harness exists: runner + cases + `pnpm eval` entry, wired as a gate.
 *   2. The cases cover every category that matters (tool-selection, structured-output,
 *      grounding, moat) PLUS the prompt-contract case EVAL.1 exists to protect.
 *   3. Offline tier is deterministic + key-free; the live tier is opt-in behind
 *      EVAL_LIVE (never in the default gate).
 *   4. Self-clean discipline: the harness creates an ephemeral eval org and deletes it.
 *   5. CI wiring: `pnpm eval` runs in CI, and package.json exposes the script.
 *   6. FUNCTIONAL (when DATABASE_URL is set): the offline tier runs GREEN against the
 *      seeded data, and the ephemeral fixture is gone afterward (proves self-clean).
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

async function run(): Promise<void> {
  console.log("\nVerifying EVAL.1 — agent & prompt evaluation harness\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const harness = read("src/scripts/eval/harness.ts");
  const cases = read("src/scripts/eval/cases.ts");
  const entry = read("src/scripts/eval.ts");
  const pkg = read("package.json");
  const ci = read(".github/workflows/ci.yml");

  // ── 1: the harness exists + is wired as a runnable gate ──
  await check("harness + cases + `pnpm eval` entry all exist", () => {
    return (
      /export async function runEval\(/.test(harness) &&
      /export const ALL_CASES/.test(cases) &&
      /runEval\(ALL_CASES/.test(entry)
    );
  });
  await check(
    "regression → non-zero exit (exitCode drives process.exit)",
    () => {
      return (
        /exitCode: failed === 0 \? 0 : 1/.test(harness) &&
        /process\.exit\(r\.exitCode\)/.test(entry)
      );
    },
  );

  // ── 2: the cases cover the categories that matter + the prompt-contract case ──
  await check(
    "cases cover tool-selection · structured-output · grounding · moat · prompt-contract",
    () => {
      return [
        '"tool-selection"',
        '"structured-output"',
        '"grounding"',
        '"moat"',
        '"prompt-contract"',
      ].every((cat) => cases.includes(cat));
    },
  );
  await check(
    "tool-selection asserts the REAL loop (getBlastRadius + recall auto-injection)",
    () => {
      return (
        /getBlastRadius/.test(cases) &&
        /kind === "tool"/.test(cases) &&
        /kind === "memory"/.test(cases) &&
        /NCR-114/.test(cases)
      );
    },
  );
  await check(
    "structured-output asserts the low-confidence fallback fires (no crash)",
    () => /LOW_CONF_FALLBACK/.test(cases) && /invalid input/.test(cases),
  );
  await check(
    "moat asserts calibrated confidence corrects an over-confident case",
    () =>
      /calibratedConfidence\(0\.9/.test(cases) &&
      /getCalibrationModel/.test(cases),
  );

  // ── 3: offline deterministic/key-free; live opt-in behind EVAL_LIVE ──
  await check(
    "offline tier uses FakeModelClient (deterministic, no key)",
    () => {
      return /FakeModelClient/.test(cases) && /tier: "offline"/.test(cases);
    },
  );
  await check(
    "live tier is opt-in behind EVAL_LIVE and excluded from the default gate",
    () => {
      return (
        /EVAL_LIVE === "1"/.test(entry) &&
        /c\.tier === "live" && opts\.live/.test(harness) &&
        /tier: "live"/.test(cases)
      );
    },
  );

  // ── 4: self-clean discipline (ephemeral eval org created + deleted) ──
  await check("harness creates an ephemeral eval org and tears it down", () => {
    return (
      /org\.create\(/.test(harness) &&
      /teardownFixtures/.test(harness) &&
      /org\.deleteMany\(\{ where: \{ id: EVAL_ORG \} \}\)/.test(harness) &&
      /finally \{[\s\S]*teardownFixtures/.test(harness)
    );
  });

  // ── 5: CI wiring + package.json script ──
  await check("package.json exposes `eval` + `verify:eval-1`", () => {
    return (
      /"eval":\s*"tsx src\/scripts\/eval\.ts"/.test(pkg) &&
      /"verify:eval-1":/.test(pkg) &&
      /pnpm verify:eval-1/.test(pkg)
    ); // in verify:all
  });
  await check("CI runs `pnpm eval` against a seeded DB (its own job)", () => {
    return /pnpm eval/.test(ci) && /db:seed/.test(ci);
  });

  // ── 6: FUNCTIONAL — the offline tier runs GREEN + self-cleans ──
  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP functional run — DATABASE_URL not set (static only)");
  } else {
    const { runEval, EVAL_ORG } = await import("./eval/harness");
    const { ALL_CASES } = await import("./eval/cases");
    const { prisma } = await import("@axona/db");

    const result = await runEval(ALL_CASES, { live: false });
    await check(
      "offline eval runs GREEN (0 failures) against seeded data",
      () => {
        return result.failed === 0 && result.passed > 0;
      },
    );
    await check(
      "self-clean: the ephemeral eval org is gone after the run",
      async () => {
        const still = await prisma.org.findUnique({ where: { id: EVAL_ORG } });
        return still === null;
      },
    );
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
