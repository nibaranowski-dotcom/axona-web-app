/**
 * Verify A11Y.3 — the token-level contrast fix for A11Y.2's 3 baselined violations.
 * Run: pnpm verify:a11y-3
 *
 * The served gate (A11Y.2) proved the real cause: the functional green `--success`
 * (#1f9e6f) used as small status text failed WCAG AA on paper (3.40) and on its own
 * success-tint (3.08) — NOT the `--mono-faint` grey the story hypothesised (0 call
 * sites). Fixed at the token level:
 *   1. --success clears AA ≥4.5:1 on paper #fff AND success-tint #e9f7f0 (assert both).
 *   2. --mono-faint (also darkened) clears AA on paper, panel #f4f3ef, panel-2 #f7f2eb.
 *   3. A11Y_BASELINE is now empty (fixed, not triaged).
 * verify:a11y-1 (static) + verify:a11y-2 stay green; the CI a11y job confirms the
 * served scan is clean on push.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { A11Y_BASELINE } from "./a11y-routes";

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

// WCAG relative luminance + contrast ratio (same method A11Y.1 used).
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = ch.map((x) =>
    x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
function ratio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
const AA = 4.5;

function run(): void {
  console.log("\nVerifying A11Y.3 — token-level contrast fix\n");
  const root = process.cwd();
  const tokens = readFileSync(
    join(root, "packages/config/styles/tokens.css"),
    "utf8",
  );
  const tokenHex = (name: string): string => {
    const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`token --${name} not found`);
    return m[1]!.toLowerCase();
  };

  const success = tokenHex("success");
  const tint = tokenHex("success-tint");
  const monoFaint = tokenHex("mono-faint");
  const paper = "#ffffff";
  const panel = tokenHex("panel");
  const panel2 = tokenHex("panel-2");

  // ── 1: the functional green clears AA on BOTH backgrounds it renders text on ──
  check(
    `--success ${success} clears AA on paper (${ratio(success, paper).toFixed(2)}) AND success-tint (${ratio(success, tint).toFixed(2)})`,
    () => ratio(success, paper) >= AA && ratio(success, tint) >= AA,
  );
  check(
    `--success also clears AA on panel ${panel} (${ratio(success, panel).toFixed(2)})`,
    () => ratio(success, panel) >= AA,
  );
  check("--success is no longer the failing #1f9e6f", () => {
    return success !== "#1f9e6f" && ratio("#1f9e6f", tint) < AA;
  });

  // ── 2: mono-faint darkened to AA on paper + panel + panel-2 ──
  check(
    `--mono-faint ${monoFaint} clears AA on paper (${ratio(monoFaint, paper).toFixed(2)}) · panel (${ratio(monoFaint, panel).toFixed(2)}) · panel-2 (${ratio(monoFaint, panel2).toFixed(2)})`,
    () =>
      ratio(monoFaint, paper) >= AA &&
      ratio(monoFaint, panel) >= AA &&
      ratio(monoFaint, panel2) >= AA,
  );

  // ── 3: the baseline is emptied (fixed, not triaged) ──
  check(
    "A11Y_BASELINE is empty (the 3 entries were fixed, not deferred)",
    () => {
      return A11Y_BASELINE.length === 0;
    },
  );

  // ── the fix is at the TOKEN level, not per-site hex ──
  check("no per-site success/green hex reintroduced in components", () => {
    // the single source is tokens.css; no component should hardcode the green.
    const glob = (dir: string): string[] => {
      const out: string[] = [];
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (/\.(tsx?|css)$/.test(f)) out.push(p);
        }
      };
      walk(join(root, dir));
      return out;
    };
    const files = [...glob("apps/web/components"), ...glob("apps/web/app")];
    return !files.some((f) => /#1f9e6f|#197e59/i.test(readFileSync(f, "utf8")));
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
