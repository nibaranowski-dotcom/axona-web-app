/**
 * Verify A11Y.1 — accessibility cleanup (contrast token + landmarks/lang).
 * Pure static/structural check (no DB). Run: pnpm verify:a11y-1
 *
 *   1. `--ink-faint` (text-ink-faint) computes to WCAG AA ≥4.5:1 against BOTH
 *      #ffffff (paper) and #f4f3ef (panel) — asserts the exact ratios.
 *   2. Root document has `lang`; the /search Launcher exposes a <main> landmark +
 *      an <h1> (sr-only ok) + a skip-to-content bypass path (targets #main).
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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

// --- WCAG 2.1 relative luminance + contrast ratio ---------------------------
function srgb(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function hex2rgb(h: string): [number, number, number] {
  const x = h.replace("#", "");
  return [
    parseInt(x.slice(0, 2), 16),
    parseInt(x.slice(2, 4), 16),
    parseInt(x.slice(4, 6), 16),
  ];
}
function contrast(fg: string, bg: string): number {
  const a = lum(hex2rgb(fg));
  const b = lum(hex2rgb(bg));
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const PAPER = "#ffffff";
const PANEL = "#f4f3ef";
const AA = 4.5;

function run(): void {
  console.log("\nVerifying A11Y.1 — contrast token + landmarks/lang\n");

  // ---- 1. contrast: --ink-faint clears AA on both backgrounds ----
  const tokens = read("packages/config/styles/tokens.css");
  const m = tokens.match(/--ink-faint:\s*(#[0-9a-fA-F]{6})/);
  const inkFaint = m?.[1]?.toLowerCase() ?? "";
  const rPaper = inkFaint ? contrast(inkFaint, PAPER) : 0;
  const rPanel = inkFaint ? contrast(inkFaint, PANEL) : 0;
  console.log(
    `  text-ink-faint = ${inkFaint} · vs ${PAPER} = ${rPaper.toFixed(3)}:1 · vs ${PANEL} = ${rPanel.toFixed(3)}:1\n`,
  );

  check(
    `--ink-faint clears AA (≥${AA}:1) on paper #ffffff`,
    () => rPaper >= AA,
  );
  check(
    `--ink-faint clears AA (≥${AA}:1) on panel #f4f3ef`,
    () => rPanel >= AA,
  );
  check("no raw #9a9a90 remains in tokens.css (repointed to the token)", () => {
    return !/#9a9a90/i.test(tokens);
  });

  // ---- 2. structure: lang + Launcher landmark/heading + bypass ----
  const rootLayout = read("apps/web/app/layout.tsx");
  const launcher = read("apps/web/components/core/Launcher.tsx");

  check("root document has <html lang=…>", () => {
    return /<html\s+lang="[a-zA-Z-]+"/.test(rootLayout);
  });
  check(
    "a skip-to-content bypass link exists (first focusable, sr-only, → #main)",
    () => {
      return (
        /href="#main"/.test(rootLayout) &&
        /sr-only/.test(rootLayout) &&
        /Skip to content/i.test(rootLayout)
      );
    },
  );
  check("/search Launcher exposes a <main id=main> landmark", () => {
    return /<main\s+id="main"/.test(launcher);
  });
  check("/search Launcher has a page <h1> (sr-only ok)", () => {
    return /<h1[^>]*>/.test(launcher);
  });
  check("the bypass target exists — primary <main> carries id=main", () => {
    // every route the gate scans has a <main id="main">
    const shell = read("apps/web/app/(shell)/layout.tsx");
    const login = read("apps/web/components/auth/LoginForm.tsx");
    return (
      /<main\s+id="main"/.test(shell) &&
      /<main[^>]*\bid="main"/.test(login) &&
      /<main[^>]*\bid="main"/.test(launcher)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
