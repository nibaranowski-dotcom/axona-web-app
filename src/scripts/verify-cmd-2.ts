/**
 * Verify CMD.2 — Command Center screen (static; live render in manual-checks).
 * Run: pnpm verify:cmd-2
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean): void => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

console.log("\nVerifying CMD.2 — Command Center screen\n");

check(
  "core route + components exist",
  existsSync(join(base, "app/(shell)/core/page.tsx")) &&
    [
      "CommandCenter",
      "KpiStrip",
      "KpiTile",
      "ModuleKpiGrid",
      "ExceptionFeed",
      "ExceptionRow",
    ].every((c) => existsSync(join(base, `components/core/${c}.tsx`))),
);

check(
  "renders getCoreSummary (server fetch)",
  /getCoreSummary/.test(read(join(base, "app/(shell)/core/page.tsx"))),
);

const feed =
  read(join(base, "components/core/ExceptionFeed.tsx")) +
  read(join(base, "components/core/ExceptionRow.tsx"));
check(
  "exception rows link to source + ripple modules",
  /ex\.url/.test(feed) && /ripples/.test(feed) && /\/\$\{r\}/.test(feed),
);

const sevFiles =
  read(join(base, "components/core/ExceptionRow.tsx")) +
  read(join(base, "components/core/KpiTile.tsx"));
check(
  "severity dots ink/lime/green (no red)",
  /bg-ink-strong/.test(sevFiles) &&
    /bg-accent/.test(sevFiles) &&
    /bg-success/.test(sevFiles) &&
    !/\bred\b|#f00|ff0000/i.test(sevFiles),
);

check(
  "copilot entry reuses the agent pane (no second chat)",
  /useCopilotSeed|toggleAgentPane|Axona agent/.test(
    read(join(base, "components/core/CommandCenter.tsx")),
  ),
);

const coreDir = join(base, "components/core");
const allCore = readdirSync(coreDir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => read(join(coreDir, f)))
  .join("\n");
check(
  "no emoji / no raw hex in core components",
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(allCore) &&
    !/#[0-9a-fA-F]{3,6}\b/.test(allCore),
);

if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
