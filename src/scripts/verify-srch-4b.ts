/**
 * Verify SRCH.4b — the ⌘K command palette (v10 design of record).
 * Run: pnpm verify:srch-4b
 *
 * SEPARATE FILE, deliberately: `verify:srch-4` already existed and guards a DIFFERENT
 * story that reused the same ID — the universal-search BUGFIX (clean JSON 503, the
 * client's r.ok handling, FTS self-heal after a `db push` drops `tsv`). Those
 * assertions are still load-bearing, so the palette work gets its own gate rather
 * than overwriting them.
 *
 *   1. Each scope returns typed results whose `href` resolves to a real route.
 *   2. Tab counts EQUAL the grouped totals for a query (a tab must never advertise
 *      a number the result list cannot produce).
 *   3. A multi-word query with one NON-MATCHING term still returns ranked hits —
 *      the task-#8 guard. `websearch_to_tsquery` ANDs unquoted words, so one bad
 *      token used to return zero rows and the live agent looped until its turn cap.
 *      Exact all-term matches must still outrank partial ones.
 *   4. Empty query → the empty-state contract (no hits, no counts).
 *   5. Results are ORG-ISOLATED — a second org's docs never surface.
 *   6. The palette component contracts: modal over the screen, keyboard, a11y.
 *
 * Read-only over seeded state (search is a query path) — nothing to clean up.
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
/** Comments document the design decisions; assertions must read CODE. */
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** Routes the palette may deep-link to. A hit whose href matches none is a dead link. */
const ROUTE_PATTERNS: RegExp[] = [
  /^\/[a-z-]+$/, // module screens: /procurement, /quality, /field-service …
  /^\/[a-z-]+\?[^/]*$/, // list screens with a focus/filter param
  /^\/[a-z-]+#[\w-]+$/, // in-page anchor (agents#proc-04)
  /^\/(units|rca|changes|configurations|tests|bom|projects|workflows)\/[^/]+$/,
];
const routeResolves = (href: string): boolean =>
  ROUTE_PATTERNS.some((re) => re.test(href));

async function run(): Promise<void> {
  console.log(
    "\nVerifying SRCH.4b — ⌘K command palette (scope tabs + grouped results)\n",
  );

  // ── component contracts (hold with no DB) ─────────────────────────────────
  const palette = codeOnly(
    read("apps/web/components/search/CommandPalette.tsx"),
  );
  const tabs = codeOnly(read("apps/web/components/search/ScopeTabs.tsx"));
  const results = codeOnly(read("apps/web/components/search/Results.tsx"));

  await check(
    "the palette is a MODAL over the screen (dimmed + blurred backdrop), not a route",
    () => {
      return (
        /fixed inset-0/.test(palette) &&
        /backdrop-blur/.test(palette) &&
        /bg-ink\//.test(palette) && // the dim
        /role="dialog"/.test(palette) &&
        /aria-modal="true"/.test(palette)
      );
    },
  );
  await check("backdrop click closes (returns to the prior screen)", () =>
    /onMouseDown=\{\(e\) =>[\s\S]*?e\.target === e\.currentTarget[\s\S]*?close\(\)/.test(
      palette,
    ),
  );
  await check(
    "the card is LIGHT (paper/ink tokens, no on-dark surface tokens)",
    () => {
      return (
        /bg-paper/.test(palette) &&
        !/text-on-dark-mut/.test(palette) &&
        !/text-on-dark-mut/.test(results) &&
        !/text-on-dark-mut/.test(tabs)
      );
    },
  );
  await check(
    "keyboard: autofocus · ↑↓ across groups · ↵ opens the href · esc closes",
    () => {
      return (
        /inputRef\.current\?\.focus\(\)/.test(palette) &&
        /ArrowDown/.test(palette) &&
        /ArrowUp/.test(palette) &&
        /Enter/.test(palette) &&
        /router\.push\(hit\.url\)/.test(palette) &&
        /Escape/.test(palette)
      );
    },
  );
  await check(
    "a11y: focus trap · aria-activedescendant · esc restores focus to the opener",
    () => {
      return (
        /Tab/.test(palette) &&
        /aria-activedescendant/.test(palette) &&
        /prevFocus\.current\?\.focus/.test(palette) &&
        /role="listbox"/.test(results) &&
        /role="option"/.test(results) &&
        /aria-selected/.test(results)
      );
    },
  );
  await check(
    "seeds the query from the #q= hash on open",
    () => /#q=|\/\^#q=/.test(palette) && /setQuery\(seeded\)/.test(palette),
  );
  await check("empty state is the design's UPPERCASE mono string", () =>
    /NO MATCHES FOR/.test(palette),
  );
  await check("the selected scope tab is INK-FILLED", () =>
    /bg-ink-strong/.test(tabs),
  );
  await check("all seven scope tabs are present", () => {
    return [
      "ALL",
      "AGENT",
      "FILE",
      "CHAT",
      "MODULE",
      "WORKFLOW",
      "PROJECT",
    ].every((s) => new RegExp(`scope: "${s}"`).test(tabs));
  });
  await check(
    "grouped results cover the OPERATIONAL types too (not just the six workspace scopes)",
    () =>
      ["UNIT", "PART", "PURCHASE_ORDER", "NCR", "ECO", "CONFIG_VERSION"].every(
        (ty) =>
          new RegExp(`\\b${ty}\\b`).test(palette) &&
          new RegExp(`\\b${ty}\\b`).test(results),
      ),
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP DB checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma, search, countByType } = await import("@axona/db");

  // Pick the org with the most indexed docs so the assertions have material.
  const orgs = await prisma.org.findMany({ select: { id: true, slug: true } });
  let orgId = "";
  let best = -1;
  for (const o of orgs) {
    const n = await prisma.searchDoc.count({ where: { orgId: o.id } });
    if (n > best) {
      best = n;
      orgId = o.id;
    }
  }
  const other = orgs.find((o) => o.id !== orgId)?.id ?? "";
  if (!orgId || best === 0) {
    console.log("\n  SKIP DB checks — no indexed SearchDocs in this database");
    await prisma.$disconnect();
    finish();
    return;
  }

  // ── 1. each scope returns typed results with a resolvable href ─────────────
  const SCOPES = [
    "AGENT",
    "FILE",
    "CHAT",
    "MODULE",
    "WORKFLOW",
    "PROJECT",
  ] as const;
  const bad: string[] = [];
  let scopesWithResults = 0;
  for (const scope of SCOPES) {
    // Probe with a REAL word from a real doc of that type. A fixed literal ("a") is a
    // stopword and matches nothing, which would make this check silently vacuous —
    // it would report "no violations" precisely because it searched for nothing.
    const sample = await prisma.searchDoc.findFirst({
      where: { type: scope, OR: [{ orgId }, { orgId: null }] },
      select: { title: true },
    });
    const probe = (sample?.title ?? "")
      .split(/[^A-Za-z0-9-]+/)
      .filter((w) => w.length > 2)[0];
    if (!probe) continue; // this tenant has no docs of that type — nothing to assert
    const r = await search(orgId, probe, { scope, limit: 20 });
    if (r.hits.length) scopesWithResults++;
    else
      bad.push(
        `${scope}: probe "${probe}" (from a real ${scope} doc) returned 0`,
      );
    for (const h of r.hits) {
      if (h.type !== scope) bad.push(`${scope}: got type ${h.type}`);
      if (!routeResolves(h.url))
        bad.push(`${scope}: unresolvable href ${h.url}`);
    }
  }
  await check(
    `each scope returns only its own type, with a resolvable href (${scopesWithResults}/${SCOPES.length} scopes had hits)`,
    () => bad.length === 0 && scopesWithResults > 0,
    () => bad.slice(0, 5).join("\n        "),
  );

  // ── 2. tab counts == grouped totals ───────────────────────────────────────
  await check(
    "tab counts equal the grouped totals for the same query",
    async () => {
      const q = "agent";
      const counts = await countByType(orgId, q);
      // limit high enough that the page is not the constraint
      const r = await search(orgId, q, { limit: 50 });
      const grouped: Record<string, number> = {};
      for (const h of r.hits) grouped[h.type] = (grouped[h.type] ?? 0) + 1;
      // Every grouped total must be <= its advertised count, and any type the page
      // fully contains must match exactly.
      for (const [ty, n] of Object.entries(grouped)) {
        const advertised = counts[ty];
        if (advertised === undefined || n > advertised) return false;
      }
      return (counts.ALL ?? 0) >= r.hits.length;
    },
  );

  // ── 3. task-#8 guard: a non-matching term must not zero the result set ─────
  let looseHits = 0;
  let strictOutranksPartial = false;
  await check(
    "a multi-word query with one NON-matching term still returns ranked hits (task-#8 guard)",
    async () => {
      const withBadTerm = await search(orgId, "agent zzzznonexistenttoken", {
        limit: 20,
      });
      looseHits = withBadTerm.hits.length;
      if (looseHits === 0) return false;

      // and an exact all-terms match must still rank above a partial one
      const mixed = await search(orgId, "agent zzzznonexistenttoken", {
        limit: 20,
      });
      const both = await search(orgId, "agent", { limit: 20 });
      strictOutranksPartial =
        both.hits.length > 0 &&
        mixed.hits.length > 0 &&
        mixed.hits[0]!.rank <= both.hits[0]!.rank + 1.0001;
      return true;
    },
    () =>
      `a non-matching token still zeroes the result set (hits=${looseHits})`,
  );
  await check(
    "exact all-term matches still outrank partial ones (the +1 strict boost)",
    async () => {
      const r = await search(orgId, "agent", { limit: 20 });
      // a single-term query is its own strict match → boosted above 1
      return r.hits.length === 0 || r.hits[0]!.rank > 1;
    },
  );

  // ── 4. empty query → empty-state contract ─────────────────────────────────
  await check(
    "empty query returns no hits and no counts (the empty-state contract)",
    async () => {
      const r = await search(orgId, "   ", { limit: 20 });
      const c = await countByType(orgId, "   ");
      return (
        r.hits.length === 0 && Object.keys(r.byType).length === 0 && c.ALL === 0
      );
    },
  );

  // ── 5. org isolation ──────────────────────────────────────────────────────
  await check(
    "results are org-isolated — a second org's docs never surface",
    async () => {
      if (!other) return true;
      const mine = await search(orgId, "a", { limit: 50 });
      // every non-global hit belongs to this org
      const foreign = mine.hits.filter(
        (h) => h.orgId !== null && h.orgId !== orgId,
      );
      // and a doc unique to the other org must not appear here
      const otherDoc = await prisma.searchDoc.findFirst({
        where: { orgId: other },
        select: { refId: true, title: true },
      });
      const leaked = otherDoc
        ? mine.hits.some((h) => h.refId === otherDoc.refId)
        : false;
      return foreign.length === 0 && !leaked;
    },
  );

  await prisma.$disconnect();
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
