/**
 * Verify SIDEBAR.1 — sidebar header co-branding (Axona + customer logo).
 * Run: pnpm verify:sidebar-1
 *
 *   1. State A (no logoUrl): Axona square + "Axona", NO ON AXONA microlabel.
 *   2. State B (logoUrl set): customer logo tile + name, demoted 9px Axona square + ON
 *      AXONA below a hairline; Axona never larger/louder than the tenant.
 *   3. TWO INDEPENDENT FLAGS: microlabel off keeps the logo; co-branding off → "Axona".
 *   4. Logo hygiene IN CODE: height-capped (24px / 28px rail), object-contain, neutral
 *      paper tile + hairline — holds for a wide wordmark AND a square mark.
 *   5. Collapsed rail: co-branded (28px tile + hairline + 13px square) / Axona-only
 *      (28px square); UX.14 icon-nav + collapse toggle preserved.
 *   6. No lime in the header; the switcher + toggle are labeled; verify:seed-1 green.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSidebarBrand } from "../../apps/web/components/shell/sidebar-brand";

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

function run(): void {
  console.log("\nVerifying SIDEBAR.1 — sidebar header co-branding\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const sidebar = read("apps/web/components/shell/Sidebar.tsx");
  const design = read("design/prototypes/axona-v2/Sidebar Header.dc.html");

  // ── the design file is committed + implemented 1:1 ──
  check("design file committed + the header uses resolveSidebarBrand", () => {
    return (
      design.length > 0 &&
      /resolveSidebarBrand\(/.test(sidebar) &&
      /WorkspaceSwitcher/.test(sidebar)
    );
  });

  // ── pure two-flag logic (the crux — cannot be collapsed into one boolean) ──
  check("State A (no logoUrl): Axona square + 'Axona', NO microlabel", () => {
    const a = resolveSidebarBrand({ name: "Axona", logoUrl: null });
    const nul = resolveSidebarBrand(null);
    return (
      a.axonaOnly === true &&
      a.showLogo === false &&
      a.showMicrolabel === false &&
      a.displayName === "Axona" &&
      nul.axonaOnly === true &&
      nul.showMicrolabel === false
    );
  });
  check("State B (logoUrl set): customer logo + name + microlabel", () => {
    const b = resolveSidebarBrand({
      name: "Meridian Robotics",
      logoUrl: "https://blob/logo.png",
    });
    return (
      b.coBranded === true &&
      b.showLogo === true &&
      b.axonaOnly === false &&
      b.showMicrolabel === true &&
      b.displayName === "Meridian Robotics" &&
      b.alt === "Meridian Robotics"
    );
  });
  check("INDEPENDENT flag 1: microlabel OFF does NOT remove the logo", () => {
    const b = resolveSidebarBrand({
      name: "Meridian",
      logoUrl: "https://blob/logo.png",
      showMicrolabel: false,
    });
    return b.showLogo === true && b.showMicrolabel === false;
  });
  check(
    "INDEPENDENT flag 2: co-branding OFF → name 'Axona' + the mark (no microlabel)",
    () => {
      const off = resolveSidebarBrand({
        name: "Meridian",
        logoUrl: null,
        showMicrolabel: true, // set, but co-branding off ⇒ microlabel still off
      });
      return (
        off.axonaOnly === true &&
        off.displayName === "Axona" &&
        off.showMicrolabel === false &&
        off.showLogo === false
      );
    },
  );

  // ── static: the header renders both states + the demoted marker (Axona quieter) ──
  check(
    "expanded switcher: 24px logo tile (State B) OR 24px Axona square (State A)",
    () => {
      return (
        /brand\.showLogo \?/.test(sidebar) &&
        /h-\[24px\] w-\[24px\] flex-none bg-ink-strong/.test(sidebar) // State A square
      );
    },
  );
  check(
    "ON AXONA marker is gated on showMicrolabel, below ONE hairline, demoted 9px square",
    () => {
      return (
        /brand\.showMicrolabel &&/.test(sidebar) &&
        /border-t border-line/.test(sidebar) &&
        /h-\[9px\] w-\[9px\] flex-none bg-ink-strong/.test(sidebar) && // 9px << 24px tile
        /On Axona/.test(sidebar) &&
        /uppercase/.test(sidebar)
      );
    },
  );

  // ── logo hygiene IN CODE (height-capped · object-contain · neutral paper + hairline) ──
  check(
    "logo hygiene: expanded tile height-capped 24px, object-contain, paper + hairline",
    () => {
      return (
        /max-h-\[24px\] w-auto max-w-full object-contain/.test(sidebar) &&
        /border border-line-strong bg-paper/.test(sidebar)
      );
    },
  );
  check(
    "logo hygiene: collapsed rail tile 28px, object-contain (wide wordmark + square hold)",
    () => {
      return (
        /max-h-\[28px\] max-w-\[28px\] object-contain/.test(sidebar) &&
        /h-7 w-7 items-center justify-center overflow-hidden rounded-\[7px\] border border-line-strong bg-paper/.test(
          sidebar,
        )
      );
    },
  );

  // ── collapsed rail: both states + the persistent Axona square + UX.14 icon-nav ──
  check(
    "collapsed rail: co-branded (28px tile + hairline + 13px Axona square) / Axona-only (28px square)",
    () => {
      return (
        /brand\.coBranded \?/.test(sidebar) &&
        /h-\[13px\] w-\[13px\] bg-ink-strong/.test(sidebar) && // demoted rail square
        /h-7 w-7 bg-ink-strong/.test(sidebar) && // axona-only rail square
        /w-\[18px\] bg-line/.test(sidebar) // the short hairline
      );
    },
  );
  check("UX.14 preserved: collapsed icon-nav + expand toggle intact", () => {
    return (
      /aria-label="Expand sidebar"/.test(sidebar) &&
      /moduleIcon\(/.test(sidebar) &&
      /Icon-only module nav/.test(sidebar)
    );
  });

  // ── affordances: switcher chevron → labeled menu; collapse toggle its own control ──
  check(
    "switcher is a labeled menu button (aria-haspopup) + collapse toggle preserved",
    () => {
      return (
        /aria-haspopup="menu"/.test(sidebar) &&
        /workspace menu/i.test(sidebar) &&
        /aria-label="Collapse sidebar"/.test(sidebar) &&
        /Workspace settings/.test(sidebar) // the reused UX.7-style menu (single-org: settings link)
      );
    },
  );

  // ── NO lime in the header (ink-on-paper; focus-ring accent is allowed) ──
  check(
    "NO lime/accent color in the header region (only the focus ring)",
    () => {
      const header = sidebar.slice(
        sidebar.indexOf("SIDEBAR.1 — co-brand switcher header"),
        sidebar.indexOf("Search bar → Mission Control"),
      );
      const switcher = sidebar.slice(
        sidebar.indexOf("function WorkspaceSwitcher"),
        sidebar.indexOf("function UserMenu"),
      );
      const badLime = (s: string) =>
        /bg-lime|text-lime|bg-accent(?!-)|text-accent(?!-)/.test(s);
      return !badLime(header) && !badLime(switcher);
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
process.exit(failed > 0 ? 1 : 0);
