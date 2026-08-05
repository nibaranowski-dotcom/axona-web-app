/**
 * Verify VERIFY.3 — verify:all is deterministic + resilient. Run: pnpm verify:verify-3
 *
 * Two classes of flake redded the gate on a clean-logic tree:
 *
 *   A. **Heap-order non-determinism.** `findFirst` with no `orderBy` returns
 *      whatever row Postgres hands back first. `core-summary.ts` picked the Fleet
 *      exception that way — five units qualified, so the surfaced one flipped on
 *      every re-seed and `verify:cmd-1` failed at random. Any `findFirst` (or
 *      `findMany` then `[0]`) whose row reaches asserted output needs an explicit
 *      order.
 *   B. **Connection-pressure transients.** 155 short-lived processes each opening
 *      their own Prisma pool; a step would die on P1001 mid-run and pass in
 *      isolation. The runner holds one shared client, pings before each step, and
 *      retries a transient exactly once — without ever masking a real failure.
 *
 * These are static checks over the fix. The behavioural proof is `verify:cmd-1`
 * staying green after the Robot heap order is deliberately shuffled (see
 * docs/manual-checks.md → VERIFY.3).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const ROOT = process.cwd();
const read = (p: string): string =>
  existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";

/** Extract each `.findFirst(...)` / `.findMany(...)` argument object in a file. */
function calls(src: string, method: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const re = new RegExp(`\\.${method}\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({
      line: src.slice(0, m.index).split("\n").length,
      body: src.slice(m.index, i + 1),
    });
  }
  return out;
}

function run(): void {
  console.log("\nVerifying VERIFY.3 — deterministic + resilient verify:all\n");

  // ── A. determinism at the source ────────────────────────────────────────
  const summary = read("apps/web/lib/core-summary.ts");

  check("core-summary.ts exists", () => summary.length > 0);

  check(
    "A1. every findFirst/findMany in core-summary.ts is explicitly ordered",
    () => {
      const unordered = [
        ...calls(summary, "findFirst"),
        ...calls(summary, "findMany"),
      ].filter((c) => !c.body.includes("orderBy"));
      if (unordered.length) {
        console.log(
          `       unordered at line(s): ${unordered.map((u) => u.line).join(", ")}`,
        );
      }
      return unordered.length === 0;
    },
  );

  check("A2. the Fleet pick is derived, not a bare findFirst on Robot", () => {
    // The old shape: db.robot.findFirst({ where: { status: { in: [...] } } })
    return (
      !/db\.robot\.findFirst/.test(summary) &&
      /db\.robot\.findMany\(\{[\s\S]{0,200}?orderBy/.test(summary)
    );
  });

  check(
    "A3. the Fleet pick ranks by outstanding field work, then SLA, then unit order",
    () => {
      return (
        /FIELD_STAGE_RANK/.test(summary) &&
        /DISPATCH: 2/.test(summary) &&
        /EN_ROUTE: 3/.test(summary) &&
        /ON_SITE: 4/.test(summary) &&
        // units with no open work order sort last, never first
        /NO_WO_RANK/.test(summary) &&
        /a\.rank - b\.rank \|\| a\.sla - b\.sla \|\| a\.i - b\.i/.test(summary)
      );
    },
  );

  check("A4. the swept call sites elsewhere carry an orderBy", () => {
    const sites: [string, string][] = [
      ["packages/db/src/memory/ingest.ts", "db.nCR.findMany"],
      ["packages/db/src/plm/config.ts", "db.configurationVersion.findMany"],
      ["apps/web/lib/change-order.ts", "db.changeRequest.findFirst"],
      ["apps/web/lib/tests.ts", "db.nCR.findFirst"],
      ["packages/agents/src/tools/quality.ts", "ctx.db.spcSample.findMany"],
      ["packages/agents/src/tools/quality.ts", "ctx.db.entityLink.findMany"],
    ];
    return sites.every(([file, needle]) => {
      const src = read(file);
      const i = src.indexOf(needle);
      if (i < 0) return false;
      // the orderBy must be inside this call's own argument object
      let depth = 0;
      let j = src.indexOf("(", i);
      const start = j;
      for (; j < src.length; j++) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      return src.slice(start, j).includes("orderBy");
    });
  });

  // ── B. harness resilience ───────────────────────────────────────────────
  const runner = read("src/scripts/verify-all.ts");
  const pkg = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };

  check("B1. verify:all is the runner, not a 155-link shell chain", () => {
    const cmd = pkg.scripts["verify:all"] ?? "";
    return (
      runner.length > 0 &&
      /tsx src\/scripts\/verify-all\.ts/.test(cmd) &&
      !cmd.includes("&&")
    );
  });

  check("B2. one shared Prisma client + a bounded connect-retry", () => {
    return (
      // the runner reuses @axona/db's dev singleton rather than opening its own
      /import\("@axona\/db"\)\)\.prisma/.test(runner) &&
      /async function waitForDb/.test(runner) &&
      /const DELAYS = \[/.test(runner) &&
      /\$queryRawUnsafe\("SELECT 1"\)/.test(runner) &&
      // pinged before each step, not just once at startup
      /for \(const id of seq\)[\s\S]{0,200}?waitForDb\(prisma\)/.test(runner)
    );
  });

  check("B3. a transient is retried exactly ONCE and never masked", () => {
    const hasSignatures = ["P1001", "P1017", "P2024", "ECONNRESET"].every((s) =>
      runner.includes(s),
    );
    // exactly one re-run inside the transient branch, and a non-zero exit still fails
    const retryOnce = (
      runner.match(/\(\{ code, output \} = runStep\(id\)\)/g) ?? []
    ).length;
    return (
      hasSignatures &&
      retryOnce === 1 &&
      /still failing after a retry/.test(runner) &&
      /process\.exit\(1\)/.test(runner)
    );
  });

  check("B4. the real error is surfaced, not a bare non-zero exit", () => {
    return (
      /process\.stdout\.write\(output\)/.test(runner) &&
      /the step produced NO output/.test(runner) &&
      /reproduce: pnpm verify:/.test(runner) &&
      /resume: {4}pnpm verify:all --from=/.test(runner)
    );
  });

  check("B5. the sequence is parity-checked against package.json", () => {
    return (
      /function checkParity/.test(runner) &&
      /not gated \(add to VERIFY_SEQUENCE\)/.test(runner) &&
      /gated but no such script/.test(runner) &&
      /duplicate entries in VERIFY_SEQUENCE/.test(runner)
    );
  });

  check("B6. every verify:* script is gated, or explicitly opted out", () => {
    // DEMO.7 — a script may be ungated ONLY via the runner's exported UNGATED map,
    // which carries a reason per entry. Parsed from the runner source (this checker
    // reads files, it does not import them) so there is ONE opt-out list, not a
    // second copy here that could quietly disagree with the real gate.
    const ungatedBlock =
      /export const UNGATED: Record<string, string> = \{([\s\S]*?)\n\};/.exec(
        runner,
      )?.[1];
    const ungated = new Set(
      [...(ungatedBlock ?? "").matchAll(/"([^"]+)":/g)].map(
        (m) => m[1] as string,
      ),
    );
    const keys = Object.keys(pkg.scripts)
      .filter((k) => k.startsWith("verify:") && k !== "verify:all")
      .map((k) => k.slice("verify:".length))
      .filter((k) => !ungated.has(k));
    const seq = /const VERIFY_SEQUENCE: string\[\] = \[([\s\S]*?)\n\];/.exec(
      runner,
    )?.[1];
    if (!seq) return false;
    const gated = new Set(
      [...seq.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string),
    );
    const missing = keys.filter((k) => !gated.has(k));
    if (missing.length) console.log(`       not gated: ${missing.join(", ")}`);
    // every opt-out must carry a REASON — an empty one is an oversight in disguise
    const reasoned = [...(ungatedBlock ?? "").matchAll(/"[^"]+":\s*"([^"]+)"/g)]
      .length;
    return (
      missing.length === 0 &&
      gated.size === keys.length &&
      reasoned === ungated.size
    );
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
