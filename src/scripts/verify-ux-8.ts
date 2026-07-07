/**
 * Verify UX.8 — loading states (branded FullScreenLoader + shell ScreenSkeleton).
 * Pure static/structural check (no DB). Run: pnpm verify:ux-8
 *
 *   1. FullScreenLoader (wordmark + slide bar + "Waking the agents") and
 *      ScreenSkeleton (sidebar + topbar + main + right pane, .sk blocks) exist;
 *      both honor prefers-reduced-motion.
 *   2. A shell loading.tsx uses ScreenSkeleton; the cold-load app/loading.tsx uses
 *      FullScreenLoader.
 *   3. The skeleton mirrors the real shell (240 sidebar · 60 topbar · 360 pane) so
 *      streamed content swaps in with no layout shift.
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

const web = join(process.cwd(), "apps/web");
const read = (p: string) =>
  existsSync(join(web, p)) ? readFileSync(join(web, p), "utf8") : "";

function run(): void {
  console.log("\nVerifying UX.8 — loading states\n");

  const loader = read("components/shell/FullScreenLoader.tsx");
  const skeleton = read("components/shell/ScreenSkeleton.tsx");

  // 1. FullScreenLoader — wordmark + slide bar + label + reduced-motion
  check("FullScreenLoader exists and exports the component", () => {
    return /export function FullScreenLoader/.test(loader);
  });
  check(
    "FullScreenLoader renders the wordmark, slide bar + 'Waking the agents'",
    () => {
      return (
        /axona/.test(loader) &&
        /ax-bar/.test(loader) &&
        /ax-load/.test(loader) &&
        /Waking the agents/.test(loader)
      );
    },
  );
  check(
    "FullScreenLoader honors prefers-reduced-motion + is a status region",
    () => {
      return (
        /prefers-reduced-motion:reduce/.test(loader) &&
        /role="status"/.test(loader) &&
        /aria-busy/.test(loader)
      );
    },
  );

  // 1. ScreenSkeleton — sidebar + main + pane + .sk blocks + reduced-motion
  check("ScreenSkeleton exists and exports the component", () => {
    return /export function ScreenSkeleton/.test(skeleton);
  });
  check(
    "ScreenSkeleton renders .sk / .sk-soft pulsing blocks (sk-pulse)",
    () => {
      return (
        /sk-pulse/.test(skeleton) &&
        /className="sk[ "]/.test(skeleton) &&
        /sk-soft/.test(skeleton)
      );
    },
  );
  check(
    "ScreenSkeleton has sidebar + topbar + main + right pane regions",
    () => {
      return (
        /<aside/.test(skeleton) &&
        /axona/.test(skeleton) && // sidebar wordmark
        /border-l border-line/.test(skeleton) // right pane
      );
    },
  );
  check(
    "ScreenSkeleton honors prefers-reduced-motion + is a status region",
    () => {
      return (
        /prefers-reduced-motion:reduce/.test(skeleton) &&
        /role="status"/.test(skeleton) &&
        /aria-busy/.test(skeleton)
      );
    },
  );

  // 2. wiring
  check(
    "shell loading.tsx renders <ScreenSkeleton /> (not the old grey bars)",
    () => {
      const l = read("app/(shell)/loading.tsx");
      return (
        /<ScreenSkeleton\s*\/>/.test(l) &&
        /ScreenSkeleton/.test(l) &&
        !/bg-skeleton/.test(l) // old plain grey-bar placeholder is gone
      );
    },
  );
  check(
    "root app/loading.tsx renders <FullScreenLoader /> for cold boot",
    () => {
      const l = read("app/loading.tsx");
      return /<FullScreenLoader\s*\/>/.test(l) && /FullScreenLoader/.test(l);
    },
  );

  // 3. no-layout-shift: skeleton mirrors the real shell dims (240 / 60 / 360)
  check(
    "skeleton matches the real shell dimensions (240 sidebar · 60 topbar · 360 pane)",
    () => {
      return (
        /w-\[240px\]/.test(skeleton) && // sidebar (real Sidebar is w-[240px])
        /h-\[60px\]/.test(skeleton) && // topbar (real ScreenShell is h-[60px])
        /w-\[360px\]/.test(skeleton) // right pane
      );
    },
  );

  // no invented reds / emoji / literal hex in the loaders
  check("no invented reds / emoji in the loaders", () => {
    const t = loader + skeleton;
    return (
      !/\bbg-red|text-red|border-red\b/.test(t) &&
      !/[\u{1F300}-\u{1FAFF}]/u.test(t)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
