/**
 * Verify SIDEBAR.2 — the Cloudflare-style app-shell navigation.
 * Run: pnpm verify:sidebar-2
 *
 *   1. Per-user UI prefs round-trip (collapsed + which nav groups are closed) and are
 *      ORG-SCOPED — one tenant's prefs are unreadable from another.
 *   2. Exactly ONE active nav row per in-shell route (never zero, never two).
 *   3. Every chevron target is a real module landing — no dead chevron.
 *   4. The rail exposes a tooltip NAME per row (an icon-only rail with no names is
 *      unusable, and this is the check that keeps it honest).
 *   5. The shell renders the design's card frame at the ruled 272px / 64px.
 *
 * Self-cleaning: the prefs round-trip writes to a real user row and restores whatever
 * was there before, so running the gate never leaves a tenant with a changed shell.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
  detail?: () => string,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok && detail) console.log(`        ${detail()}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const ROOT = process.cwd();
const read = (p: string) =>
  existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";
/** Assertions read CODE — comments document the decisions and must not satisfy them. */
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

async function run(): Promise<void> {
  console.log(
    "\nVerifying SIDEBAR.2 — Cloudflare-style app-shell navigation\n",
  );

  const sidebar = codeOnly(read("apps/web/components/shell/Sidebar.tsx"));
  const navSection = codeOnly(read("apps/web/components/shell/NavSection.tsx"));
  const layout = codeOnly(read("apps/web/app/(shell)/layout.tsx"));
  const prefsLib = codeOnly(read("apps/web/lib/ui-prefs.ts"));

  // ── structure: the design's card frame at the ruled widths ────────────────
  await check(
    "the sidebar is a 272px paper CARD (expanded) and 64px collapsed",
    () => {
      return (
        /w-\[272px\]/.test(sidebar) &&
        /w-\[64px\]/.test(sidebar) &&
        /rounded-\[16px\]/.test(sidebar) &&
        /border-line/.test(sidebar) &&
        /bg-paper/.test(sidebar)
      );
    },
  );
  await check(
    "the shell frames the card on --panel with 26px padding + gap",
    () =>
      /bg-panel/.test(layout) &&
      /p-\[26px\]/.test(layout) &&
      /gap-\[26px\]/.test(layout),
  );
  await check(
    "the card is height-capped so the account row + collapse toggle can't be clipped",
    () =>
      /grid-rows-\[minmax\(0,1fr\)\]/.test(layout) && /min-h-0/.test(sidebar),
  );

  // ── a11y: the safe faint token on TEXT ────────────────────────────────────
  await check(
    "group labels use the AA-safe mono token (--ink-faint fails AA as small text)",
    () =>
      /text-mono-faint/.test(navSection) &&
      !/text-ink-faint[^\w-]/.test(navSection.split("Icon")[0] ?? ""),
  );
  await check(
    "nav rows are keyboard-operable with a visible focus ring",
    () =>
      /focus-visible:ring-2/.test(navSection) &&
      /focus-visible:ring-accent/.test(navSection),
  );

  // ── chevrons: expandable only, derived not hand-listed ────────────────────
  await check(
    "the chevron marks EXPANDABLE rows and is derived from the child-route map",
    () =>
      /EXPANDABLE_MODULES/.test(navSection) &&
      /PLM_ROUTE_MODULE/.test(navSection) &&
      /ChevronRight/.test(navSection),
  );
  await check(
    "the group header is the accordion; the chevron row is a Link (drill-in)",
    () => {
      // the row is a <Link href>, i.e. navigation — not an open/close toggle
      return (
        /<Link\s+href=\{m\.href\}/.test(navSection) &&
        /aria-expanded=\{open\}/.test(navSection)
      );
    },
  );

  // ── prefs plumbing ────────────────────────────────────────────────────────
  await check(
    "prefs are SSR'd into the sidebar (no expanded-then-snap flash)",
    () =>
      /getUiPrefs\(/.test(layout) &&
      /prefs=\{uiPrefs\}/.test(layout) &&
      /prefs\?\.sidebarCollapsed/.test(sidebar),
  );
  await check(
    "the write resolves the user from the SESSION, never from an argument",
    () => {
      const action = codeOnly(read("apps/web/app/(shell)/ui-prefs-actions.ts"));
      return (
        /getCurrentUser\(\)/.test(action) && !/userId:\s*string/.test(action)
      );
    },
  );
  await check(
    "prefs reads never throw inside the shell layout",
    () => /catch/.test(prefsLib) && /DEFAULT_UI_PREFS/.test(prefsLib),
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { getUiPrefs, setUiPrefs } =
    await import("../../apps/web/lib/ui-prefs");
  const { getNavModules } = await import("../../apps/web/lib/nav");
  const { isNavItemActive } = await import("../../apps/web/lib/nav");

  const orgs = await prisma.org.findMany({ select: { id: true, slug: true } });
  const org = orgs[0];
  const other = orgs.find((o) => o.id !== org?.id);
  const user = org
    ? await prisma.user.findFirst({
        where: { orgId: org.id },
        select: { id: true, uiPrefs: true },
      })
    : null;
  if (!org || !user) {
    console.log("\n  SKIP DB checks — no seeded org/user in this database");
    await prisma.$disconnect();
    finish();
    return;
  }

  const original = user.uiPrefs;
  try {
    // ── 1. round-trip + org isolation ───────────────────────────────────────
    await check(
      "collapsed + per-group state round-trips for the user",
      async () => {
        await setUiPrefs(org.id, user.id, {
          sidebarCollapsed: true,
          navGroupsClosed: ["Robotics", "Back office"],
        });
        const back = await getUiPrefs(org.id, user.id);
        return (
          back.sidebarCollapsed === true &&
          back.navGroupsClosed.includes("Robotics") &&
          back.navGroupsClosed.includes("Back office")
        );
      },
    );
    await check(
      "a partial patch merges rather than clobbering the other key",
      async () => {
        await setUiPrefs(org.id, user.id, { sidebarCollapsed: false });
        const back = await getUiPrefs(org.id, user.id);
        return (
          back.sidebarCollapsed === false && back.navGroupsClosed.length === 2
        );
      },
    );
    await check(
      "prefs are ORG-SCOPED — another org cannot read this user's shell state",
      async () => {
        if (!other) return true;
        const cross = await getUiPrefs(other.id, user.id);
        // the org-scoped client finds no such user in the other org → defaults
        return (
          cross.sidebarCollapsed === false && cross.navGroupsClosed.length === 0
        );
      },
    );

    // ── 2. exactly one active row per in-shell route ─────────────────────────
    // getNavModules takes the org's enabledModules (null ⇒ all) — NOT an orgId.
    const groups = await getNavModules(null);
    const modules = groups.flatMap((g) => g.modules);
    await check(
      `exactly ONE active nav row for each of the ${modules.length} module routes`,
      () => {
        const bad: string[] = [];
        for (const m of modules) {
          const n = modules.filter((x) =>
            isNavItemActive(m.href, x.href),
          ).length;
          if (n !== 1) bad.push(`${m.href} → ${n} active`);
        }
        if (bad.length)
          console.log(`        ${bad.slice(0, 6).join("\n        ")}`);
        return bad.length === 0;
      },
    );

    // ── 3. no dead chevron ──────────────────────────────────────────────────
    const { PLM_ROUTE_MODULE } = await import("../../apps/web/lib/plm-routes");
    await check(
      "every chevron target is a real module landing (no dead chevron)",
      () => {
        const expandable = [...new Set(Object.values(PLM_ROUTE_MODULE))];
        const byKey = new Map(modules.map((m) => [m.key, m]));
        const dead = expandable.filter((k) => {
          const mod = byKey.get(k);
          // an expandable module must exist in the nav AND resolve to its own landing
          return !mod || !mod.href || mod.href !== `/${k}`;
        });
        if (dead.length) console.log(`        dead: ${dead.join(", ")}`);
        return expandable.length > 0 && dead.length === 0;
      },
    );

    // ── 4. the rail names every row ─────────────────────────────────────────
    await check(
      "the collapsed rail exposes a tooltip NAME + aria-label per row",
      () => {
        return (
          /title=\{m\.name\}/.test(sidebar) && /aria-label=\{/.test(sidebar)
        );
      },
    );
    await check(
      "the rail breaks sections with the design's short hairline",
      () => /w-\[26px\] bg-line/.test(sidebar),
    );
  } finally {
    // self-clean: restore whatever the user had before the round-trip
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { uiPrefs: (original ?? null) as never },
    });
    const restored = await prisma.user.findFirst({
      where: { id: user.id },
      select: { uiPrefs: true },
    });
    const same =
      JSON.stringify(restored?.uiPrefs ?? null) ===
      JSON.stringify(original ?? null);
    console.log(
      `  ${same ? "PASS" : "FAIL"} self-clean: the user's prefs are restored`,
    );
    same ? passed++ : failed++;
    await prisma.$disconnect();
  }

  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
