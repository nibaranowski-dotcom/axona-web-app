/**
 * Verify UX.7 — audit/notifications/settings moved into a user-name contextual
 * menu. Pure static/structural check (no DB). Run: pnpm verify:ux-7
 *
 * The sidebar nav is MODULES ONLY: Audit trail, Notifications (with the unread
 * badge), and Settings are no longer top-level nav links — they live in an
 * upward contextual menu opened by the identity (name + role) button, alongside
 * the user + Sign out. aria-haspopup/expanded, Esc + click-outside close.
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
  console.log("\nVerifying UX.7 — user-name contextual menu\n");

  const sb = read("components/shell/Sidebar.tsx");

  check("a UserMenu with role=menu exists", () => {
    return /function UserMenu/.test(sb) && /role="menu"/.test(sb);
  });

  check(
    "the identity block is a button with aria-haspopup=menu + aria-expanded",
    () => {
      return (
        /aria-haspopup="menu"/.test(sb) &&
        /aria-expanded=\{open\}/.test(sb) &&
        /setOpen\(\(v\) => !v\)/.test(sb)
      );
    },
  );

  // Each of the three routes now lives INSIDE the menu (role=menuitem), NOT as a
  // top-level nav link — one occurrence of each href, each carrying menuitem.
  const inMenu = (href: string) => {
    const re = new RegExp(
      `href="${href.replace("/", "\\/")}"[\\s\\S]{0,80}?role="menuitem"`,
    );
    return re.test(sb);
  };
  check("Audit trail is a menuitem (not a top-level nav link)", () =>
    inMenu("/audit"),
  );
  check("Notifications is a menuitem (not a top-level nav link)", () =>
    inMenu("/notifications"),
  );
  check("Settings is a menuitem (not a top-level nav link)", () =>
    inMenu("/settings/members"),
  );

  check(
    "the three routes appear exactly once each (moved, not duplicated)",
    () => {
      const count = (h: string) => sb.split(`href="${h}"`).length - 1;
      return (
        count("/audit") === 1 &&
        count("/notifications") === 1 &&
        count("/settings/members") === 1
      );
    },
  );

  check("Notifications still carries the unread badge", () => {
    return /unreadCount > 0/.test(sb) && /unread`/.test(sb);
  });

  check("the menu contains the user + Sign out", () => {
    return (
      /roleLabel\(user\?\.role\)/.test(sb) &&
      /signOut\(\{ callbackUrl: "\/login" \}\)/.test(sb) &&
      /aria-label="Sign out"/.test(sb)
    );
  });

  check("Esc + click-outside close (focus mgmt on the trigger)", () => {
    return (
      /addEventListener\("mousedown"/.test(sb) &&
      /e\.key === "Escape"/.test(sb) &&
      /buttonRef\.current\?\.focus\(\)/.test(sb) &&
      /querySelector<HTMLElement>\('\[role="menuitem"\]'\)/.test(sb)
    );
  });

  check("Lucide chevron reflects open/closed state; no emoji", () => {
    return (
      /ChevronUp/.test(sb) &&
      /ChevronDown/.test(sb) &&
      !/[\u{1F300}-\u{1FAFF}]/u.test(sb)
    );
  });

  check("no invented reds in the shell", () => {
    return !/\bbg-red|text-red|border-red\b/.test(sb);
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
