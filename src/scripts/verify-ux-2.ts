/**
 * Verify UX.2 — the global Axona pane is suppressed on /agents only (no duplicate
 * chat surface), unchanged everywhere else. Pure static check. Run: pnpm verify:ux-2
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  const ok = fn();
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

console.log("\nVerifying UX.2 — de-duplicate the agent pane on /agents\n");

const pane = read("apps/web/components/shell/AgentPane.tsx");

check("AgentPane suppresses the global pane on /agents (returns null)", () => {
  return (
    /usePathname/.test(pane) &&
    /pathname === "\/agents"/.test(pane) &&
    /return null/.test(pane)
  );
});

check(
  "suppression sits after the hooks (Rules of Hooks) and before render",
  () => {
    const guard = pane.indexOf('pathname === "/agents"');
    const firstReturnJsx = pane.indexOf("return (");
    const lastHook = Math.max(
      pane.lastIndexOf("useCallback("),
      pane.lastIndexOf("useEffect("),
      pane.lastIndexOf("useState("),
    );
    return guard > lastHook && guard < firstReturnJsx;
  },
);

check(
  "global pane still renders on other routes (aside not removed wholesale)",
  () => {
    // The pane JSX + the collapsed rail path are intact — only /agents is gated.
    return /<aside/.test(pane) && /AgentRail/.test(pane);
  },
);

if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
