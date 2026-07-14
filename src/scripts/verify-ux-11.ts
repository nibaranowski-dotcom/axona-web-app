/**
 * Verify UX.11 — table overflow containment + one-click launcher ask. Pure
 * static check (no DB, no browser). Run: pnpm verify:ux-11
 *
 *   1. Table cells that hold variable text truncate (min-w-0 + truncate) instead
 *      of overflowing into the next column — asserted strictly on /audit (the
 *      reported collision: Actor was an inline-flex that overflowed; now a block
 *      flex min-w-0 with a truncating label + title), plus a representative set of
 *      the swept tables that gained truncate/title.
 *   2. The Command Center "Ask Axona" action submits the prompt directly (autoSend
 *      → the pane sends), not a prefill: copilot-seed carries `autoSend`,
 *      CommandCenter calls setSeed(t, true), PaneChat sends when autoSend is set.
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
  console.log("\nVerifying UX.11 — table overflow + one-click ask\n");

  // ---- BUG 1: /audit table containment ----
  const audit = read("components/audit/AuditView.tsx");
  console.log("BUG 1 · /audit —");
  check(
    "ActorBadge is a block flex min-w-0 (not inline-flex → no overflow)",
    () => {
      // the label must truncate inside a block flex that fills the grid track
      return (
        /<span className="flex min-w-0 items-center gap-1\.5">/.test(audit) &&
        !/inline-flex min-w-0 items-center gap-1\.5/.test(audit)
      );
    },
  );
  check("actor label truncates with a title tooltip", () => {
    return /truncate text-\[12px\] text-ink"\s*\n?\s*title=\{`\$\{type\} · \$\{label\}`\}/.test(
      audit,
    );
  });
  check("action cell truncates + title", () => {
    return /className="truncate font-mono[^"]*"\s*\n?\s*title=\{e\.action\}/.test(
      audit,
    );
  });
  check("target cell is min-w-0 truncate", () => {
    return /<span className="min-w-0 truncate text-\[12px\]">/.test(audit);
  });
  check(
    "approver cell is a flex min-w-0 with a truncating + titled label",
    () => {
      return (
        /<span className="flex min-w-0 items-center text-\[12px\]">/.test(
          audit,
        ) && /truncate text-ink" title=\{e\.approverLabel\}/.test(audit)
      );
    },
  );
  check("summary cell truncates + title", () => {
    return /min-w-0 truncate text-\[12\.5px\][^"]*"\s*\n?\s*title=\{e\.summary\}/.test(
      audit,
    );
  });
  check("design column widths preserved (grid-cols template intact)", () => {
    return /grid grid-cols-\[76px_minmax\(110px,1\.1fr\)/.test(audit);
  });

  // ---- BUG 1: swept tables gained truncate/title ----
  console.log("BUG 1 · sweep —");
  const sweptTitle: [string, string][] = [
    ["components/field-service/WorkOrderQueue.tsx", "w.issue"],
    ["components/sales/DealsTable.tsx", "d.account"],
    ["components/machines/MachinesView.tsx", "m.name"],
    ["components/projects/ProjectsView.tsx", "title="],
    ["components/workflows/WorkflowsView.tsx", "title="],
    ["components/quality/NcrTable.tsx", "n.defect"],
    ["components/procurement/PoRow.tsx", "po.supplier"],
    ["components/legal/MattersTable.tsx", "m.title"],
    ["components/marketing/CampaignsTable.tsx", "c.name"],
  ];
  for (const [file, needle] of sweptTitle) {
    const src = read(file);
    const name = file.split("/").pop();
    check(`${name} has a title tooltip (${needle})`, () => {
      return needle === "title="
        ? /title=\{/.test(src)
        : new RegExp(`title=\\{[^}]*${needle.replace(/\./g, "\\.")}`).test(src);
    });
  }
  // MembersView email cell uses a multi-line INVITED/email ternary for its title
  check("MembersView email cell has a title tooltip (m.email)", () => {
    const src = read("components/settings/MembersView.tsx");
    return (
      /text-ink-faint"\s*\n\s*title=\{/.test(src) && /:\s*m\.email/.test(src)
    );
  });
  // the wrapping cells now clip (truncate added)
  check("UnitEconomics product cell now truncates", () => {
    const src = read("components/finance/UnitEconomics.tsx");
    return (
      /min-w-0 truncate[^"]*"[^>]*>\{u\.product\}/.test(src) ||
      /truncate[^"]*"\s*[^>]*title=\{u\.product\}/.test(src)
    );
  });

  // ---- BUG 2: one-click Ask submits directly ----
  console.log("BUG 2 · one-click ask —");
  const seed = read("lib/copilot-seed.ts");
  const cc = read("components/core/CommandCenter.tsx");
  const pane = read("components/shell/PaneChat.tsx");
  const uiStore = read("lib/ui-store.ts");
  const agentPane = read("components/shell/AgentPane.tsx");
  check("copilot-seed store carries autoSend + setSeed(q, autoSend?)", () => {
    return (
      /autoSend:\s*boolean/.test(seed) &&
      /setSeed:\s*\(q:[^)]*autoSend\?:\s*boolean\)/.test(seed) &&
      /setSeed:\s*\(seed,\s*autoSend\s*=\s*false\)\s*=>\s*set\(\{ seed, autoSend \}\)/.test(
        seed,
      )
    );
  });
  check("Command Center Ask sends straight through (setSeed(t, true))", () => {
    return /setSeed\(t,\s*true\)/.test(cc);
  });
  check("PaneChat submits on autoSend (deferred send), else prefills", () => {
    return (
      /const autoSend = useCopilotSeed\(\(s\) => s\.autoSend\)/.test(pane) &&
      /if \(autoSend && agentId\)/.test(pane) &&
      /setTimeout\(\(\) => \{[\s\S]*?void send\(seed\)/.test(pane) &&
      /setInput\(seed\)/.test(pane)
    );
  });
  // forceOpen: keeps the pane open past Command Center's re-collapse so the send survives
  check("ui-store has a transient (non-persisted) agentPaneForceOpen", () => {
    return (
      /agentPaneForceOpen:\s*boolean/.test(uiStore) &&
      /setAgentPaneForceOpen:/.test(uiStore) &&
      // partialize excludes forceOpen from persistence
      /partialize:/.test(uiStore) &&
      !/partialize:[\s\S]*?agentPaneForceOpen/.test(uiStore)
    );
  });
  check("Command Center Ask sets forceOpen(true)", () => {
    return /setForceOpen\(true\)/.test(cc);
  });
  check(
    "AgentPane keeps the pane open when forceOpen (rail gated on !forceOpen)",
    () => {
      return (
        /const forceOpen = useUi\(\(s\) => s\.agentPaneForceOpen\)/.test(
          agentPane,
        ) &&
        /collapsed && !forceOpen\) return <AgentRail/.test(agentPane) &&
        // per-visit reset when leaving /core
        /if \(moduleKey !== "core"\) setForceOpen\(false\)/.test(agentPane)
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
