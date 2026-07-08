/**
 * Verify UX.10 — agent-chat + trace-pane scroll containment. Pure static/
 * structural check (no DB). Run: pnpm verify:ux-10
 *
 *   1. The agent chat is a height-bounded flex column (h-full + min-h-0 down the
 *      chain) so the PAGE does not scroll while chatting. The MESSAGE LIST is the
 *      single scroll container (flex-1 + min-h-0 + overflow-y-auto) and auto-sticks
 *      to the newest message; the composer is flex-none (always visible). Applies to
 *      BOTH surfaces — the co-working right pane (PaneChat) and /agents (AgentChat).
 *   2. The /agents split is height-bounded (grid min-h-0 + a bounded row + min-h-0
 *      sections) so its chat column honours the viewport instead of growing.
 *   3. The open TRACE sub-pane is a bounded internally-scrolling box: the pane is
 *      flex:none (never grows over the composer) and its CONTENT region has a
 *      max-height + min-h-0 + overflow-y-auto, so long result lines scroll WITHIN
 *      the pane. Look unchanged (UX.9): reduced-motion preserved, no reds / emoji.
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
  console.log(
    "\nVerifying UX.10 — agent-chat + trace-pane scroll containment\n",
  );

  const pane = read("components/shell/TracePane.tsx");
  const paneChat = read("components/shell/PaneChat.tsx");
  const agentChat = read("components/agents/AgentChat.tsx");
  const agentsView = read("components/agents/AgentsView.tsx");
  const stick = read("components/agents/use-stick-to-bottom.ts");

  // 1. AgentChat (/agents) column is height-bounded
  check(
    "AgentChat root is a height-bounded flex column (h-full + min-h-0)",
    () => {
      return /flex h-full min-h-0 flex-col/.test(agentChat);
    },
  );
  check(
    "AgentChat message list = the scroll container (flex-1 + min-h-0 + overflow-y-auto)",
    () => {
      return /flex min-h-0 flex-1 flex-col[^"]*overflow-y-auto/.test(agentChat);
    },
  );
  check("AgentChat composer is flex-none (always visible)", () => {
    return /<form[\s\S]*?flex flex-none items-center[\s\S]*?border-t/.test(
      agentChat,
    );
  });

  // 2. PaneChat (co-working right pane) column bindings
  check(
    "PaneChat message list = the scroll container (flex-1 + min-h-0 + overflow-y-auto)",
    () => {
      return /flex min-h-0 flex-1 flex-col[^"]*overflow-y-auto/.test(paneChat);
    },
  );
  check("PaneChat composer is flex-none (always visible)", () => {
    return /flex-none border-t border-line/.test(paneChat);
  });

  // both surfaces auto-stick to the newest message
  check(
    "both chats auto-stick to the newest message (useStickToBottom)",
    () => {
      return (
        existsSync(join(web, "components/agents/use-stick-to-bottom.ts")) &&
        /scrollTop = .*scrollHeight/.test(stick) &&
        /useStickToBottom/.test(agentChat) &&
        /ref=\{scrollRef\}/.test(agentChat) &&
        /useStickToBottom/.test(paneChat) &&
        /ref=\{scrollRef\}/.test(paneChat)
      );
    },
  );

  // 3. /agents split is height-bounded so the page does not scroll
  check(
    "/agents grid is height-bounded (min-h-0 + a bounded row) so main does not scroll",
    () => {
      return (
        /grid h-full min-h-0/.test(agentsView) &&
        /lg:grid-rows-\[minmax\(0,1fr\)\]/.test(agentsView) &&
        // both split sections carry min-h-0
        (agentsView.match(/min-h-0 min-w-0/g)?.length ?? 0) >= 2
      );
    },
  );

  // 4. TRACE sub-pane: bounded, internally-scrolling, never grows over composer
  check(
    "TracePane container is flex:none (never grows to push the composer out)",
    () => {
      return /\.tracepane\{display:flex;flex-direction:column;flex:none;min-height:0\}/.test(
        pane,
      );
    },
  );
  check(
    "TracePane CONTENT is a bounded scroll box (max-height + min-h-0 + overflow-y-auto)",
    () => {
      return /<ol className="max-h-\[40vh\] min-h-0 overflow-y-auto/.test(pane);
    },
  );
  check(
    "the old unbounded [open]{flex:1} split is gone (would escape the column)",
    () => {
      return !/\.tracepane\[open\]\{flex:1/.test(pane);
    },
  );

  // 5. look unchanged (UX.9): reduced-motion + dark tokens; no reds / emoji
  check(
    "prefers-reduced-motion still disables the chevron transition (UX.9)",
    () => {
      return /prefers-reduced-motion:reduce\)\{\.tracechev\{transition:none\}\}/.test(
        pane,
      );
    },
  );
  check("no invented reds / emoji in the touched files", () => {
    const t = pane + paneChat + agentChat + agentsView + stick;
    return (
      !/\b(bg|text|border)-red\b/.test(t) && !/[\u{1F300}-\u{1FAFF}]/u.test(t)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
