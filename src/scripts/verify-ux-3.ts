/**
 * Verify UX.3 — land on the Command Center at "/". Pure routing/static checks (no
 * DB): "/" redirects to /core; /core renders the Command Center; /launcher renders
 * the launcher; no dangling "/"-as-launcher link remains. Run: pnpm verify:ux-3
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
const read = (p: string) =>
  existsSync(join(web, p)) ? readFileSync(join(web, p), "utf8") : "";

// Recursively collect app/ + components/ source (for the dangling-link scan).
function walk(dir: string, acc: string[] = []): string[] {
  const abs = join(web, dir);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    const rel = join(dir, name);
    if (statSync(join(web, rel)).isDirectory()) walk(rel, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(rel);
  }
  return acc;
}

function run(): void {
  console.log("\nVerifying UX.3 — land on the Command Center at /\n");

  const rootPage = read("app/page.tsx");
  check('"/" redirects to /core (no launcher render at root)', () => {
    return (
      /redirect\(["']\/core["']\)/.test(rootPage) && !/Launcher/.test(rootPage) // the launcher no longer renders at root
    );
  });

  check("/core renders the Command Center", () => {
    const corePage = read("app/(shell)/core/page.tsx");
    return (
      existsSync(join(web, "app/(shell)/core/page.tsx")) &&
      /CommandCenter/.test(corePage)
    );
  });

  check(
    "/launcher renders the launcher (full-screen, outside the shell)",
    () => {
      const launcher = read("app/launcher/page.tsx");
      return (
        existsSync(join(web, "app/launcher/page.tsx")) &&
        /Launcher/.test(launcher) &&
        // it must NOT be under the (shell) group (would add the sidebar/agent-pane)
        !existsSync(join(web, "app/(shell)/launcher/page.tsx"))
      );
    },
  );

  check("sidebar wordmark + search reach /launcher", () => {
    const sidebar = read("components/shell/Sidebar.tsx");
    return (
      /href=["']\/launcher["']/.test(sidebar) &&
      /router\.push\(["']\/launcher["']\)/.test(sidebar)
    );
  });

  check(
    'no dangling "/"-as-launcher link (href="/" / push("/") / redirect other than root)',
    () => {
      const files = walk("app").concat(walk("components"));
      for (const f of files) {
        if (f === "app/page.tsx") continue; // the root redirect is the one allowed
        const src = readFileSync(join(web, f), "utf8");
        if (/href=["']\/["']/.test(src)) return false;
        if (/router\.push\(["']\/["']\)/.test(src)) return false;
        if (/redirect\(["']\/["']\)/.test(src)) return false;
      }
      return true;
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
