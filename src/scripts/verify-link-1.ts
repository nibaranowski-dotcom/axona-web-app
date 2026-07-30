/**
 * Verify LINK.1 — connected-objects / where-used nav (generalizes ONT.1 1-hop).
 * Static checks always run; DB checks gate on DATABASE_URL. Run: pnpm verify:link-1
 *
 *   1. BUILD-ON-TOP: getBlastRadius is a BFS OVER the shared getEntityLinks and its
 *      behavior is byte-unchanged (verify:ont-1's NCR-118 contract reproduced).
 *   2. getEntityLinks returns DIRECT neighbors both directions with correct
 *      labels/relations/routes; org-scoped (a 2nd org → 0).
 *   3. The <ConnectedObjects> panel renders on ≥5 detail views with one-click links
 *      to the right detail routes; empty state when a record is unlinked.
 *   4. REUSE: exactly ONE 1-hop edge fetch (getEntityLinks) — no forked traversal
 *      (getBlastRadius + recall both call it; entityLink.findMany lives in one file);
 *      one route resolver (hrefFor → entityRoute); one code→id (resolveSubjectId →
 *      resolveEntityId).
 *   5. BOUNDARY: LINK.1 is 1-hop (getEntityLinks has no BFS); getBlastRadius owns N-hop.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying LINK.1 — connected objects / where-used nav\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
  const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

  const links = read("packages/db/src/ontology/links.ts");
  const ontology = read("packages/agents/src/tools/ontology.ts");
  const recall = read("packages/db/src/memory/recall.ts");
  const blastLib = read("apps/web/lib/blast-radius.ts");
  const connectedLib = read("apps/web/lib/connected-objects.ts");
  const panel = read("apps/web/components/ontology/ConnectedObjects.tsx");

  // ── 4 (static): REUSE — ONE 1-hop edge fetch; no forked traversal/resolver ──
  const EDGE_RE = /entityLink\.findMany/g;
  await check(
    "exactly ONE entityLink.findMany (in links.ts) — no forked traversal",
    () => {
      return (
        count(links, EDGE_RE) === 1 &&
        count(ontology, EDGE_RE) === 0 && // getBlastRadius now BFS's over getEntityLinks
        count(recall, EDGE_RE) === 0 && // recall's neighborhood too
        /export async function getEntityLinks/.test(links)
      );
    },
  );
  await check(
    "getBlastRadius + recall both BFS over the shared getEntityLinks",
    () => {
      return (
        /getEntityLinks/.test(ontology) &&
        /getEntityLinks\(db, \{/.test(ontology) &&
        /getEntityLinks/.test(recall)
      );
    },
  );
  await check(
    "ONE route resolver — hrefFor delegates to the centralized entityRoute",
    () => {
      return (
        /entityRoute\(/.test(blastLib) &&
        /export function entityRoute/.test(links) &&
        // the old inline per-type switch is gone from hrefFor
        !/case "SUPPLIER":\s*\n\s*case "PURCHASE_ORDER":\s*\n\s*return "\/procurement"/.test(
          blastLib,
        )
      );
    },
  );
  await check(
    "ONE code→id resolver — recall's resolveSubjectId delegates to resolveEntityId",
    () => {
      return (
        /export async function resolveEntityId/.test(links) &&
        /resolveEntityId\(db, type, value\)/.test(recall) &&
        // the forked per-type natural keys were removed from resolveSubjectId
        !/case "UNIT":\s*\n\s*hit = pick\(/.test(recall)
      );
    },
  );

  // ── 5 (static): BOUNDARY — getEntityLinks is 1-hop; getBlastRadius owns N-hop ──
  await check(
    "boundary: getEntityLinks is 1-hop (no BFS/queue/maxDepth); getBlastRadius keeps the BFS",
    () => {
      const fn = links.slice(
        links.indexOf("export async function getEntityLinks"),
        links.indexOf("async function resolveNeighbors"),
      );
      const noBfs =
        !/\bwhile\b/.test(fn) && !/\bqueue\b/.test(fn) && !/maxDepth/.test(fn);
      const blastHasBfs =
        /maxDepth/.test(ontology) &&
        /while \(queue\.length/.test(ontology) &&
        /BFS/.test(ontology);
      return noBfs && blastHasBfs;
    },
  );

  // ── 3 (static): the panel + its wiring on the 5 detail views ──
  await check(
    "the <ConnectedObjects> panel links each neighbor + has an empty state",
    () => {
      return (
        /href=\{it\.route\}/.test(panel) &&
        /aria-label=/.test(panel) && // labelled links (a11y)
        /Nothing is linked to this record yet/.test(panel) && // empty state
        !/#[0-9a-fA-F]{6}\b/.test(panel) && // v2 tokens, no raw hex
        /relationLabel/.test(connectedLib) // grouped by relation
      );
    },
  );
  await check(
    "the panel is wired on ≥5 entity detail views (Unit·NCR·ECO·Config·Test)",
    () => {
      const views: [string, string][] = [
        ["apps/web/components/units/UnitView.tsx", "UNIT"],
        ["apps/web/components/rca/RcaView.tsx", "NCR"],
        ["apps/web/components/changes/ChangeOrderView.tsx", "ECO"],
        [
          "apps/web/components/configurations/ConfigurationDetailView.tsx",
          "CONFIG_VERSION",
        ],
        ["apps/web/components/tests/TestRunView.tsx", "TEST_RUN"],
      ];
      const pages: [string, string][] = [
        ["apps/web/app/(shell)/units/[serial]/page.tsx", '"UNIT"'],
        ["apps/web/app/(shell)/rca/[ncrCode]/page.tsx", '"NCR"'],
        ["apps/web/app/(shell)/changes/[code]/page.tsx", '"ECO"'],
        [
          "apps/web/app/(shell)/configurations/[code]/page.tsx",
          '"CONFIG_VERSION"',
        ],
        ["apps/web/app/(shell)/tests/[code]/page.tsx", '"TEST_RUN"'],
      ];
      const viewsOk = views.every(([f]) => /ConnectedObjects/.test(read(f)));
      const pagesOk = pages.every(([f, t]) => {
        const s = read(f);
        return /getConnectedObjects\(/.test(s) && s.includes(t);
      });
      return viewsOk && pagesOk;
    },
  );
  await check(
    "the touched detail routes are registered for the a11y scan",
    () => {
      const a = read("src/scripts/a11y-routes.ts");
      return (
        /\/rca\/NCR-118/.test(a) &&
        /\/changes\/ECO-305/.test(a) &&
        /\/tests\/TR-8390/.test(a)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { dbForOrg, getEntityLinks, resolveEntityId } =
    await import("@axona/db");
  const { getBlastRadius } = await import("@axona/agents");
  const { getConnectedObjects } =
    await import("../../apps/web/lib/connected-objects");
  const db = dbForOrg(DEMO);

  // ── 1: BUILD-ON-TOP — getBlastRadius byte-unchanged (ont-1's NCR-118 contract) ──
  await check(
    "BUILD-ON-TOP: getBlastRadius(NCR-118) unchanged — ≥6 modules · bidirectional · path-rooted",
    async () => {
      const r118 = await getBlastRadius(db, {
        entityType: "NCR",
        code: "NCR-118",
      });
      const nodes = r118.groups.flatMap((g) => g.nodes);
      const r114 = await getBlastRadius(db, {
        entityType: "NCR",
        code: "NCR-114",
      });
      return (
        r118.found &&
        r118.moduleCount >= 6 &&
        nodes.length >= 8 &&
        nodes.every((n) => n.code && n.label && n.path) &&
        nodes.some((n) => /←\w+—/.test(n.path)) && // bidirectional
        nodes.every((n) => n.path.startsWith("NCR-118")) &&
        r114.found &&
        r114.moduleCount < r118.moduleCount // NCR-114 smaller, not hardcoded
      );
    },
  );

  // ── 2: getEntityLinks — direct neighbors, both directions, labels/routes/relations ──
  await check(
    "getEntityLinks(NCR-118): DIRECT neighbors both directions with labels·relations·routes·note",
    async () => {
      const id = await resolveEntityId(db, "NCR", "NCR-118");
      if (!id) return false;
      const n = await getEntityLinks(db, { type: "NCR", id });
      // SN-2208 is AMONG the unit neighbors (membership — edge/findMany order is
      // not deterministic across an accumulated substrate, so don't assert the
      // FIRST unit is SN-2208).
      const sn2208 = n.some(
        (x) => x.type === "UNIT" && x.route === "/units/SN-2208",
      );
      return (
        n.length >= 5 &&
        n.some((x) => x.direction === "out") &&
        n.every((x) => x.relation && x.code && x.label && x.route) &&
        n.some((x) => x.note) && // the "why"
        sn2208 // the demo unit resolves to its real detail route
      );
    },
  );
  await check(
    "org-scoped: a 2nd org sees ZERO connected objects for the first org's record",
    async () => {
      const groups = await getConnectedObjects(SECOND, "NCR", "NCR-118");
      return groups.length === 0;
    },
  );

  // ── 3 (behavior): the panel read model — where-used + one-click detail links + empty ──
  await check(
    "getConnectedObjects(NCR-118): grouped by relation, each item a detail-route link with a why",
    async () => {
      const groups = await getConnectedObjects(DEMO, "NCR", "NCR-118");
      const items = groups.flatMap((g) => g.items);
      return (
        groups.length > 0 &&
        groups.every((g) => !!g.relationLabel && g.items.length > 0) &&
        items.every((i) => i.route.startsWith("/") && !!i.label) &&
        items.some((i) => i.note) &&
        items.some((i) => i.route === "/units/SN-2208") // one-click to the Unit page
      );
    },
  );
  await check(
    "where-used: SN-2208's connected objects link to /rca and /changes DETAIL routes",
    async () => {
      const groups = await getConnectedObjects(DEMO, "UNIT", "SN-2208");
      const routes = groups.flatMap((g) => g.items.map((i) => i.route));
      return (
        routes.some((r) => r.startsWith("/rca/")) &&
        routes.some((r) => r.startsWith("/changes/"))
      );
    },
  );
  await check(
    "empty state: an unlinked record returns no connected objects",
    async () => {
      const groups = await getConnectedObjects(DEMO, "ECO", "ECO-305");
      return Array.isArray(groups) && groups.length === 0;
    },
  );

  const { prisma } = await import("@axona/db");
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
