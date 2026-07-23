/**
 * Verify A11Y.2 — the served axe gate is stood up and wired. Static (verify:all
 * runs with no served app); the served proof is the CI `a11y` job itself, plus the
 * --selftest step that fails unless the gate catches a seeded violation.
 * Run: pnpm verify:a11y-2
 *
 *   1. A CI job serves the app, authenticates, and runs axe (selftest + real scan).
 *   2. The route set covers authed + PLM + agent-pane-open + a dense table.
 *   3. The scan fails on serious/critical, has a --selftest proof + a triage baseline.
 *   4. verify:a11y-1 (the static complement) still exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { A11Y_ROUTES, A11Y_BASELINE, A11Y_DETAIL_SERIAL } from "./a11y-routes";

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

function run(): void {
  console.log("\nVerifying A11Y.2 — the served axe gate\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const ci = read(".github/workflows/ci.yml");
  const scan = read("src/scripts/a11y-scan.ts");
  const pkg = read("package.json");

  // ── 1: a CI job serves + auths + runs axe ──
  check("CI has an `a11y:` job that boots a seeded Postgres + the app", () => {
    return (
      /^\s{2}a11y:/m.test(ci) &&
      /image:\s*pgvector\/pgvector/.test(ci) &&
      /db:seed/.test(ci) &&
      /pnpm --filter @axona\/web start/.test(ci)
    );
  });
  check("the CI job installs Playwright chromium and runs both scans", () => {
    return (
      /playwright install .*chromium/.test(ci) &&
      /a11y:scan --selftest/.test(ci) &&
      /pnpm a11y:scan\b/.test(ci)
    );
  });
  check("the scan authenticates (login form) before authed routes", () => {
    return (
      /#login-email/.test(scan) &&
      /#login-password/.test(scan) &&
      /button\[type="submit"\]/.test(scan)
    );
  });

  // ── 2: the route set covers the required surfaces ──
  check("route set includes /login, /core, /audit + a dense table", () => {
    const paths = A11Y_ROUTES.map((r) => r.path);
    return (
      paths.includes("/login") &&
      paths.includes("/core") &&
      paths.includes("/audit") &&
      paths.includes("/procurement")
    );
  });
  check("route set includes PLM: /units, /units/:serial, /blast-radius", () => {
    const paths = A11Y_ROUTES.map((r) => r.path);
    return (
      paths.includes("/units") &&
      paths.includes(`/units/${A11Y_DETAIL_SERIAL}`) &&
      paths.includes("/blast-radius")
    );
  });
  check("route set includes an agent-pane-open surface", () => {
    return A11Y_ROUTES.some((r) => r.path === "/agents" && r.openAgentPane);
  });
  check("route set carries authed AND unauthed routes", () => {
    return A11Y_ROUTES.some((r) => r.auth) && A11Y_ROUTES.some((r) => !r.auth);
  });

  // ── 3: threshold + selftest + baseline discipline ──
  check("gate fails on serious/critical (threshold set)", () => {
    return /BLOCKING = new Set\(\["serious", "critical"\]\)/.test(scan);
  });
  check("--selftest injects a violation and PROVES the gate catches it", () => {
    return (
      /--selftest/.test(scan) &&
      /a11y-selftest-broken/.test(scan) &&
      /SELFTEST PASS/.test(scan) &&
      /SELFTEST FAIL/.test(scan)
    );
  });
  check(
    "a triage baseline exempts only pre-existing issues (new ones fail)",
    () => {
      return (
        /isBaselined/.test(scan) &&
        /NEW serious\/critical/.test(scan) &&
        A11Y_BASELINE.length >= 1 &&
        A11Y_BASELINE.every((b) => b.path && b.rule && b.note)
      );
    },
  );

  // ── 4: the static complement is preserved ──
  check("verify:a11y-1 (static) is kept alongside the served gate", () => {
    return (
      existsSync(join(root, "src/scripts/verify-a11y-1.ts")) &&
      /"verify:a11y-1":/.test(pkg) &&
      /"a11y:scan":/.test(pkg)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
