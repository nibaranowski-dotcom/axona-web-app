/**
 * Verify FND.13 — app shell (static; UI behavior is in docs/manual-checks).
 * Run: pnpm verify:fnd-13
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

const root = process.cwd();
const base = join(root, "apps/web");

console.log("\nVerifying FND.13 — app shell\n");

check("shell layout exists", existsSync(join(base, "app/(shell)/layout.tsx")));
check(
  "shell landing page (/) exists",
  existsSync(join(base, "app/(shell)/page.tsx")),
);
check("no conflicting app/page.tsx", !existsSync(join(base, "app/page.tsx")));
check("nav loading state", existsSync(join(base, "app/(shell)/loading.tsx")));
check("nav error state", existsSync(join(base, "app/(shell)/error.tsx")));

for (const c of [
  "Sidebar",
  "NavSection",
  "AgentPane",
  "AgentRail",
  "TraceConsole",
]) {
  check(
    `component ${c}.tsx`,
    existsSync(join(base, `components/shell/${c}.tsx`)),
  );
}

check(
  "nav data helper (getNavModules)",
  /getNavModules/.test(read(join(base, "lib/nav.ts"))),
);
check(
  "ui store (zustand persist)",
  /persist\(/.test(read(join(base, "lib/ui-store.ts"))),
);
check(
  "session stub flags AUTH.1",
  /AUTH\.1/.test(read(join(base, "lib/session.ts"))),
);
check(
  "landing leaves MC.1 TODO",
  /MC\.1/.test(read(join(base, "app/(shell)/page.tsx"))),
);

// Token hygiene across shell components (no raw hex, no emoji)
const shellDir = join(base, "components/shell");
const shellFiles = readdirSync(shellDir)
  .map((f) => read(join(shellDir, f)))
  .join("\n");
check(
  "no raw hex in shell components",
  !/#[0-9a-fA-F]{3,6}\b/.test(shellFiles),
);
check(
  "no emoji in shell components",
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(shellFiles),
);
check(
  "TraceConsole leaves SSE hook for ART.5",
  /ART\.5/.test(read(join(shellDir, "TraceConsole.tsx"))),
);
check(
  "keyboard hook handles cmd/ctrl K",
  /key\s*===\s*["']k["']/i.test(shellFiles),
);
check(
  "agent pane min 280 / max 520 / rail 52",
  /280/.test(read(join(base, "lib/ui-store.ts"))) &&
    /520/.test(read(join(base, "lib/ui-store.ts"))) &&
    /52/.test(read(join(base, "lib/ui-store.ts"))),
);

if (failed === 0) {
  console.log(`\nPASSED — ${passed} checks`);
} else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
