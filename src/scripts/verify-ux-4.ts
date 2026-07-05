/**
 * Verify UX.4 — module screens scroll as one page; nothing vertically cropped.
 * Pure static/structural checks (no DB). Asserts the shared ScreenShell scaffold
 * exists + is adopted, and that NO module screen keeps the old viewport-lock
 * (h-full + nested overflow-y-auto body). Run: pnpm verify:ux-4
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

const web = join(process.cwd(), "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// All screen View components under apps/web/components (the module screens).
function screenFiles(): string[] {
  const root = join(web, "components");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/View\.tsx$/.test(name) || /CommandCenter\.tsx$/.test(name))
        out.push(abs);
    }
  };
  walk(root);
  return out;
}

function run(): void {
  console.log("\nVerifying UX.4 — module screens scroll as one page\n");

  const shell = read(join(web, "components/shell/ScreenShell.tsx"));
  // Inspect the actual classNames (strip // and /* */ comments so the doc prose,
  // which references the OLD h-full/overflow-y-auto bug, doesn't false-positive).
  const shellCode = shell
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  check(
    "ScreenShell scaffold exists: min-h-full container, sticky header, bottom padding, no viewport-cap",
    () => {
      return (
        /className="flex min-h-full flex-col bg-panel"/.test(shellCode) && // grows, not locked
        /sticky top-0 z-20 flex h-\[60px\]/.test(shellCode) && // topbar stays put
        /pb-16/.test(shellCode) && // last panel/trace never flush-cropped
        !/overflow-y-auto/.test(shellCode) && // body is NOT a nested vertical scroll
        !/[\s"']h-full[\s"']/.test(shellCode) // no `h-full` lock (min-h-full is fine)
      );
    },
  );

  const files = screenFiles();
  check(
    "no module screen keeps the old viewport-lock (flex h-full flex-col bg-panel)",
    () => {
      const offenders = files.filter((f) =>
        /className="flex h-full flex-col bg-panel"/.test(read(f)),
      );
      if (offenders.length)
        console.log(
          "      offenders: " +
            offenders.map((f) => f.split("/").pop()).join(", "),
        );
      return offenders.length === 0;
    },
  );

  check(
    "no module screen has a nested full-height overflow-y-auto body wrapper",
    () => {
      // The signature of the old bug: a flex body that is BOTH viewport-capped
      // (min-h-0 flex-1) AND its own vertical scroller (overflow-y-auto).
      const offenders = files.filter((f) => {
        const s = read(f);
        return (
          /min-h-0 flex-1[^"]*overflow-y-auto/.test(s) ||
          /overflow-y-auto[^"]*min-h-0 flex-1/.test(s)
        );
      });
      if (offenders.length)
        console.log(
          "      offenders: " +
            offenders.map((f) => f.split("/").pop()).join(", "),
        );
      return offenders.length === 0;
    },
  );

  check(
    "ScreenShell adopted across the module screens (≥ 18, incl. /audit)",
    () => {
      const users = files.filter((f) => /ScreenShell/.test(read(f)));
      const audit = read(join(web, "components/audit/AuditView.tsx"));
      return users.length >= 18 && /ScreenShell/.test(audit);
    },
  );

  check(
    "Command Center scrolls (min-h-full, sticky header, no overflow-hidden grid cap)",
    () => {
      const cc = read(join(web, "components/core/CommandCenter.tsx"));
      return (
        /min-h-full/.test(cc) &&
        /sticky top-0/.test(cc) &&
        !/className="flex h-full flex-col bg-panel"/.test(cc) &&
        !/grid min-h-0 flex-1[^"]*overflow-hidden/.test(cc)
      );
    },
  );

  check(
    "StatStrip + TraceConsole still the flowing first/last children (UX.1 preserved)",
    () => {
      // Spot-check a representative screen keeps StatStrip near the top + the trace
      // rendered as a flowing child (not inside a removed scroll region).
      const sec = read(join(web, "components/security/SecurityView.tsx"));
      return (
        /StatStrip/.test(sec) &&
        /TraceConsole/.test(sec) &&
        /ScreenShell/.test(sec)
      );
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
