/**
 * Verify UX.9 — agent-chat trace open/close (collapsible details sub-pane).
 * Pure static/structural check (no DB). Run: pnpm verify:ux-9
 *
 *   1. The agent-chat trace is a collapsible native <details> sub-pane: a summary
 *      bar (accent status dot + TRACE + orchestrator name + chevron), open →
 *      expanded lines, closed → summary only — matching the v9 Procurement pattern.
 *   2. Toggling rotates the chevron (.tracechev -90°↔0°) + expands/collapses via
 *      [open]; native <details>/<summary> is keyboard-accessible; reduced-motion
 *      disables the transition.
 *   3. Trace lines still render via the existing TraceLine shape (ts + text) — no
 *      content regression. Adopted in BOTH agent chats (right-pane + /agents).
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
  console.log("\nVerifying UX.9 — agent-chat trace open/close\n");

  const pane = read("components/shell/TracePane.tsx");
  const paneChat = read("components/shell/PaneChat.tsx");
  const agentChat = read("components/agents/AgentChat.tsx");

  // 1. collapsible <details> sub-pane + summary bar
  check(
    "TracePane is a native <details> collapsible sub-pane (.tracepane)",
    () => {
      return (
        /<details/.test(pane) && /tracepane/.test(pane) && /<summary/.test(pane)
      );
    },
  );
  check(
    "summary bar has the accent status dot + TRACE + orchestrator name",
    () => {
      return (
        /bg-accent/.test(pane) &&
        /TRACE/.test(pane) &&
        /\{orchestrator\}/.test(pane)
      );
    },
  );
  check(
    "summary bar has a Lucide chevron (.tracechev, ~1.7-2.2px stroke)",
    () => {
      return /ChevronDown/.test(pane) && /tracechev/.test(pane);
    },
  );

  // 2. open/close behavior
  check(
    "[open] expands (flex:1/min-height:120px); :not([open]) collapses to summary",
    () => {
      return (
        /\.tracepane\[open\]\{flex:1;min-height:120px\}/.test(pane) &&
        /\.tracepane:not\(\[open\]\)\{flex:none\}/.test(pane)
      );
    },
  );
  check(
    "chevron rotates -90°↔0° with a transition (native marker hidden)",
    () => {
      return (
        /\.tracechev\{transform:rotate\(-90deg\);transition:transform \.15s\}/.test(
          pane,
        ) &&
        /\.tracepane\[open\] \.tracechev\{transform:rotate\(0deg\)\}/.test(
          pane,
        ) &&
        /::-webkit-details-marker\{display:none\}/.test(pane)
      );
    },
  );
  check("prefers-reduced-motion disables the chevron transition", () => {
    return /prefers-reduced-motion:reduce\)\{\.tracechev\{transition:none\}\}/.test(
      pane,
    );
  });
  check(
    "dark surface via bg-ink-strong + on-dark text tokens (no literal hex)",
    () => {
      return (
        /bg-ink-strong/.test(pane) &&
        /text-on-dark-mut/.test(pane) &&
        /text-on-dark-faint/.test(pane)
      );
    },
  );

  // 3. trace CONTENT preserved via existing TraceLine shape
  check(
    "trace lines still render via the existing TraceLine shape (ts + text)",
    () => {
      return (
        /type \{ TraceLine \}/.test(pane) &&
        /l\.ts/.test(pane) &&
        /l\.text/.test(pane)
      );
    },
  );

  // adopted in BOTH agent chats; the old TraceConsole no longer used there
  check(
    "right-pane chat (PaneChat) renders <TracePane> (not TraceConsole)",
    () => {
      return (
        /<TracePane\b/.test(paneChat) &&
        /import \{ TracePane \}/.test(paneChat) &&
        !/TraceConsole/.test(paneChat)
      );
    },
  );
  check(
    "/agents chat (AgentChat) renders <TracePane> (not TraceConsole)",
    () => {
      return (
        /<TracePane\b/.test(agentChat) &&
        /import \{ TracePane \}/.test(agentChat) &&
        !/TraceConsole/.test(agentChat)
      );
    },
  );

  check("no invented reds / emoji in the touched files", () => {
    const t = pane + paneChat + agentChat;
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
