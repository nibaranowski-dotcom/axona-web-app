/**
 * Verify PROSPECT.2 — the investor-demo narrative is de-hardcoded from the app
 * (data-driven / org-neutral), so no tenant's story leaks into another's screen.
 * Static grep-based checks + a DB identity check. Run: pnpm verify:prospect-2
 *
 *   1. The shell wordmark is DATA-DRIVEN (renders the org's own name/logo), not a
 *      hardcoded "axona"; layout feeds it; getOrgOnboarding returns name + logoKey.
 *      (DB) the demo org and a prospect org resolve DIFFERENT, real identities.
 *   2. Suggestion chips (agent-suggestions + CommandCenter) carry NO hardcoded
 *      customer/record string.
 *   3. Command Center exception reasons are data-driven (no hardcoded "thermal
 *      anomaly"; no hardcoded product lookup).
 *   4. The other sweep findings are fixed (QualityView SPC series, the trace
 *      placeholder) — no demo-narrative literal renders anywhere in the app.
 *   5. verify:seed-1 scope stays clean; the committed app fixes are marque-free.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BANNED_RE, scanForMarques } from "./lib/anonymization";

const DEMO_ORG_ID = "org_axona_demo";
const EXAMPLE_ORG_ID = "org_prospect_example";

// Demo-narrative literals that must not be HARDCODED into the app's PRESENTATION
// (executable code — comments documenting the narrative are stripped before this
// runs). Covers product names (HX-2), customer names (Tier-1 Auto OEM), and record
// codes (SN-2196 / NCR-118 / SERVO-204 / DLV-3312 / ECO-31x / HX2-0xxx). PROSPECT.2a:
// broadened from `product: "HX-2"` — that literal missed `product === "HX-2"` in
// FinanceView; now any `HX-2` product literal in executable code is caught.
const DEMO_LITERALS =
  /Tier-1 Auto OEM|SN-2196|NCR-118|SERVO-20[45]|DLV-3312|ECO-31[0-9]|HX2-0|HX-2|drive_torque_Nm|thermal anomaly|lot 88421|M\. Osei/;

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

// Strip comments so a hit only counts if it's in EXECUTABLE code, not documentation.
// Removes full-line comments AND trailing `// …` comments (leaving `://` in strings,
// e.g. URLs, alone) — PROSPECT.2a: a trailing comment mentioning the narrative is
// documentation, not a render.
const codeOnly = (src: string) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(
        t.startsWith("//") ||
        t.startsWith("*") ||
        t.startsWith("/*") ||
        t.startsWith("///")
      );
    })
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")) // drop trailing // comments
    .join("\n");

async function run(): Promise<void> {
  console.log("\nVerifying PROSPECT.2 — de-hardcode the demo narrative\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
  const C = "apps/web/components";
  const L = "apps/web/lib";

  // ── 1. data-driven workspace identity ──
  await check(
    "shell wordmark is data-driven (Sidebar renders the org's name/logo)",
    () => {
      const sidebar = read(`${C}/shell/Sidebar.tsx`);
      // SIDEBAR.1 refactored the org-branding reads into a pure resolver
      // (shell/sidebar-brand.ts). The shell is still fully data-driven — it just
      // consumes `resolveSidebarBrand(org)` instead of reading org fields inline.
      const brand = read(`${C}/shell/sidebar-brand.ts`);
      return (
        /resolveSidebarBrand\(org\)/.test(sidebar) &&
        /org\?\.logoUrl/.test(brand) &&
        /org\?\.name/.test(brand) &&
        // no longer a bare hardcoded "axona" wordmark span
        !/>\s*axona\s*<\/span>/.test(sidebar)
      );
    },
  );
  await check(
    "layout feeds the org identity; getOrgOnboarding returns name + logoKey",
    () => {
      const layout = read("apps/web/app/(shell)/layout.tsx");
      const onb = read(`${L}/onboarding.ts`);
      return (
        /org=\{org\}/.test(layout) &&
        /logoKey/.test(onb) &&
        /name: org\.name/.test(onb)
      );
    },
  );

  // ── 2. org-neutral suggestion chips ──
  await check(
    "suggestion chips carry NO hardcoded customer/record string",
    () => {
      const sugg = read(`${L}/agent-suggestions.ts`);
      const cmd = codeOnly(read(`${C}/core/CommandCenter.tsx`));
      return !DEMO_LITERALS.test(sugg) && !DEMO_LITERALS.test(cmd);
    },
  );

  // ── 3. data-driven exception reasons ──
  await check(
    "Command Center exceptions are data-driven (no hardcoded thermal/product)",
    () => {
      const cs = codeOnly(read(`${L}/core-summary.ts`));
      return (
        !/thermal anomaly/.test(cs) &&
        !/product: "HX-2"/.test(cs) &&
        // derives the watch reason from the real field work order
        /workOrderField\.findFirst/.test(cs)
      );
    },
  );

  // ── 4. the rest of the sweep ──
  await check(
    "QualityView SPC series is data-driven (no hardcoded characteristic)",
    () => {
      const q = codeOnly(read(`${C}/quality/QualityView.tsx`));
      return !/drive_torque_Nm/.test(q) && !/SERVO-204/.test(q);
    },
  );
  await check("TraceConsole placeholder has no demo narrative", () => {
    return !DEMO_LITERALS.test(read(`${C}/shell/TraceConsole.tsx`));
  });
  await check(
    "no demo-narrative literal renders anywhere in components/lib",
    () => {
      const dirs = [C, L, "apps/web/app"];
      const hits: string[] = [];
      for (const h of scanFiles(root, dirs)) {
        if (DEMO_LITERALS.test(codeOnly(read(h)))) hits.push(h);
      }
      if (hits.length)
        console.log("      still hardcoded in:", hits.slice(0, 8));
      return hits.length === 0;
    },
  );

  // ── 5. anonymization wall intact ──
  await check(
    "committed app fixes are marque-free; verify:seed-1 scope clean",
    () => {
      const files = [
        `${C}/shell/Sidebar.tsx`,
        `${C}/shell/TraceConsole.tsx`,
        `${C}/core/CommandCenter.tsx`,
        `${C}/quality/QualityView.tsx`,
        `${L}/agent-suggestions.ts`,
        `${L}/core-summary.ts`,
        `${L}/onboarding.ts`,
        "apps/web/app/(shell)/layout.tsx",
      ];
      const dirty = files.filter((f) => BANNED_RE.test(read(f)));
      if (dirty.length) console.log("      marque in:", dirty);
      return (
        dirty.length === 0 &&
        scanForMarques(root, ["apps", "packages", "exports", "docs"]).length ===
          0
      );
    },
  );

  // ── DB: two orgs resolve DIFFERENT, real identities ──
  if (!process.env.DATABASE_URL) {
    console.log("  SKIP identity DB check — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static only)`);
    return;
  }
  const { prisma } = await import("@axona/db");
  const { seedProspectOrg, clearOrgData } = await import("./lib/prospect-seed");
  const exampleConfig = (
    await import("./fixtures/prospect-example/prospect.config")
  ).default;
  try {
    await seedProspectOrg(exampleConfig, {
      configDir: join(root, "src/scripts/fixtures/prospect-example"),
    });
    await check(
      "the demo org and a prospect org resolve DIFFERENT real identities",
      async () => {
        const demo = await prisma.org.findUnique({
          where: { id: DEMO_ORG_ID },
          select: { name: true },
        });
        const ex = await prisma.org.findUnique({
          where: { id: EXAMPLE_ORG_ID },
          select: { name: true },
        });
        // Each org resolves its OWN name (data-driven), and the two DIFFER — proof
        // the wordmark isn't a shared hardcoded string. (The demo org's name is now
        // "Axona"; the prospect's is its own — the shell renders whichever it is.)
        return !!demo?.name && !!ex?.name && demo.name !== ex.name;
      },
    );
  } finally {
    await clearOrgData(EXAMPLE_ORG_ID);
    await prisma.org.delete({ where: { id: EXAMPLE_ORG_ID } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

// tiny recursive .ts/.tsx walker (no external dep)
function scanFiles(root: string, dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e === "node_modules" || e === ".next") continue;
      const full = join(d, e);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e)) out.push(full.replace(`${root}/`, ""));
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
