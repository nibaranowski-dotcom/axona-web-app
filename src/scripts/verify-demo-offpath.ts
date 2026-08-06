/**
 * DEMO.7 §4 — OFF-PATH ROBUSTNESS. Run: pnpm verify:demo-offpath <scenario>
 *
 * The scripted walk is verified by `verify:demo` (links resolve) and
 * `verify:demo-script` (the spoken numbers are true). Neither covers what happens when
 * someone POKES: clicks a connected object nobody rehearsed, opens a module screen the
 * script never visits. This asserts the three ways that goes wrong:
 *
 *   1. EMPTY      — a reachable demo screen renders nothing ("looks unfinished")
 *   2. DEAD-END   — a LINK.1 hop resolves but lands on a bare list instead of the
 *                   record (the "soft dead-end" LINK.2 closes)
 *   3. MARQUE     — a real name reaches a rendered string, via the SEED.1 scanner
 *
 * Read-only and org-scoped: it walks the tenant's own graph and read models. Nothing to
 * clean up, which is the strongest form of self-cleaning a checker can have.
 *
 * NOT in verify:all — it asserts gitignored demo-tenant seeds. Per-scenario, like
 * verify:demo. MARQUE-FREE: the tenant is resolved from its script manifest, never named.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BANNED_RE } from "./lib/anonymization";
import type { ScriptManifest } from "./lib/script-manifest";

const ROOT = process.cwd();
const PROSPECTS = join(ROOT, "prospects");

/** The module screens a curious visitor can reach from the sidebar. */
const MODULE_SCREENS = [
  "core",
  "units",
  "procurement",
  "inventory",
  "manufacturing",
  "quality",
  "engineering",
  "fulfillment",
  "finance",
  "field-service",
  "fleet",
  "configurations",
  "changes",
  "blast-radius",
] as const;

interface Issue {
  kind: "EMPTY" | "DEAD-END" | "MARQUE";
  where: string;
  detail: string;
}

/** A screen counts as populated when its read model returns at least one row. */
async function screenPopulation(
  orgId: string,
  screen: string,
): Promise<{ n: number; note: string }> {
  const { dbForOrg } = await import("@axona/db");
  const db = dbForOrg(orgId);
  switch (screen) {
    case "core":
      return { n: await db.agent.count(), note: "agents" };
    case "units":
      return { n: await db.unit.count(), note: "units" };
    case "procurement":
      return { n: await db.purchaseOrder.count(), note: "purchase orders" };
    case "inventory":
      return { n: await db.part.count(), note: "parts" };
    case "manufacturing":
      return { n: await db.workOrderMfg.count(), note: "work orders" };
    case "quality":
      return { n: await db.nCR.count(), note: "NCRs" };
    case "engineering":
      return { n: await db.eCO.count(), note: "ECOs" };
    case "fulfillment":
      return { n: await db.delivery.count(), note: "deliveries" };
    case "finance":
      return { n: await db.invoice.count(), note: "invoices" };
    case "field-service":
      return { n: await db.workOrderField.count(), note: "field work orders" };
    case "fleet":
      return { n: await db.robot.count(), note: "robots" };
    case "configurations":
      return {
        n: await db.configurationVersion.count(),
        note: "configurations",
      };
    case "changes":
      return { n: await db.eCO.count(), note: "change orders" };
    case "blast-radius":
      return { n: await db.entityLink.count(), note: "graph edges" };
    default:
      return { n: 1, note: "n/a" };
  }
}

async function runScenario(name: string): Promise<boolean> {
  const file = join(PROSPECTS, name, "script.manifest.ts");
  if (!existsSync(file)) {
    console.log(
      `\n  SKIP ${name} — no script manifest to resolve the tenant from`,
    );
    return true;
  }
  const mod = (await import(pathToFileURL(file).href)) as {
    default?: ScriptManifest;
  };
  const orgId = mod.default?.orgId;
  const label = mod.default?.script ?? name;
  if (!orgId) {
    console.log(`\n  FAIL ${name} — manifest has no orgId`);
    return false;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  if (!(await prisma.org.findUnique({ where: { id: orgId } }))) {
    console.log(`\n  SKIP ${label} — that tenant is not seeded here`);
    return true;
  }
  const db = dbForOrg(orgId);
  const issues: Issue[] = [];

  console.log(`\n═══ ${label} — off-path crawl ═══\n`);

  // ── 1. no empty states on reachable screens ──
  for (const s of MODULE_SCREENS) {
    const { n, note } = await screenPopulation(orgId, s);
    if (n === 0)
      issues.push({
        kind: "EMPTY",
        where: `/${s}`,
        detail: `0 ${note} — the screen renders an empty state`,
      });
  }
  console.log(
    `  screens crawled: ${MODULE_SCREENS.length} · empty: ${issues.filter((i) => i.kind === "EMPTY").length}`,
  );

  // ── 2. every LINK.1 hop lands ON its record ──
  // Walk EVERY edge in the tenant's graph and resolve both ends the way the panel
  // does. A neighbour with no route is unreachable; one whose route is a bare module
  // screen is the soft dead-end LINK.2 closes.
  const { getConnectedObjects } =
    await import("../../apps/web/lib/connected-objects");
  const DETAIL_ROUTES = /^\/(units|rca|changes|configurations|tests|bom)\//;
  const seeds: { type: string; code: string }[] = [];
  for (const u of await db.unit.findMany({
    select: { serial: true },
    take: 25,
  }))
    seeds.push({ type: "UNIT", code: u.serial });
  for (const n of await db.nCR.findMany({ select: { code: true }, take: 25 }))
    seeds.push({ type: "NCR", code: n.code });
  for (const e of await db.eCO.findMany({ select: { code: true }, take: 25 }))
    seeds.push({ type: "ECO", code: e.code });
  for (const p of await db.part.findMany({ select: { sku: true }, take: 25 }))
    seeds.push({ type: "PART", code: p.sku });

  let hops = 0;
  for (const s of seeds) {
    const groups = await getConnectedObjects(orgId, s.type as never, s.code);
    for (const g of groups)
      for (const item of g.items) {
        hops++;
        if (!item.route) {
          issues.push({
            kind: "DEAD-END",
            where: `${s.type}:${s.code} → ${item.type}:${item.code}`,
            detail: "neighbour has no route at all",
          });
          continue;
        }
        const deep = item.route.includes("?focus=");
        const detail = DETAIL_ROUTES.test(item.route);
        if (!deep && !detail)
          issues.push({
            kind: "DEAD-END",
            where: `${s.type}:${s.code} → ${item.type}:${item.code}`,
            detail: `lands on a bare list: ${item.route}`,
          });
      }
  }
  console.log(
    `  LINK.1 hops walked: ${hops} · soft dead-ends: ${issues.filter((i) => i.kind === "DEAD-END").length}`,
  );

  // ── 3. no FOREIGN marque in anything rendered ──
  // The tenant's OWN identity is not a leak to itself: a tailored demo is deliberately
  // branded with the recipient's name (org name, slug, demo login, the labels its own
  // seed writes), and that is what they are being shown. SEED.1's banned list exists to
  // keep marques out of COMMITTED CODE — verify:seed-1 still enforces that, unchanged.
  // What matters HERE is a marque that is not this tenant's: another company's name
  // rendered on this tenant is the unrecoverable mistake. So the tenant's own identity
  // is excluded and every other banned marque still fails.
  const orgRow = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true },
  });
  const own = [orgRow?.name, orgRow?.slug]
    .filter((x): x is string => !!x)
    .flatMap((x) => [x, x.replace(/-demo$/, "")])
    .map((x) => x.toLowerCase());
  const isOwn = (marque: string) =>
    own.some(
      (o) =>
        o.includes(marque.toLowerCase()) || marque.toLowerCase().includes(o),
    );

  // Sweep the string columns of every org-scoped model (the DMMF sweep SEED.4 built),
  // so a marque cannot hide in a field no hand-written list thought to check.
  const { Prisma } = await import("@axona/db");
  let rows = 0;
  for (const m of Prisma.dmmf.datamodel.models) {
    if (!m.fields.some((f) => f.name === "orgId")) continue;
    const strFields = m.fields
      .filter(
        (f) =>
          f.kind === "scalar" && (f.type === "String" || f.type === "Json"),
      )
      .map((f) => f.name);
    if (!strFields.length) continue;
    // The sweep is DMMF-driven, so the delegate is resolved by name at runtime and
    // cannot be statically typed — narrow it to the one call shape we use.
    type OrgScopedDelegate = {
      findMany?: (args: {
        where: { orgId: string };
      }) => Promise<Record<string, unknown>[]>;
    };
    const delegate = (prisma as unknown as Record<string, OrgScopedDelegate>)[
      m.name.charAt(0).toLowerCase() + m.name.slice(1)
    ];
    if (!delegate?.findMany) continue;
    const found = await delegate.findMany({ where: { orgId } });
    rows += found.length;
    for (const row of found)
      for (const f of strFields) {
        const v = row[f];
        const text =
          typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
        if (!text) continue;
        const hit = BANNED_RE.exec(text);
        if (hit && !isOwn(hit[1] ?? hit[0]))
          issues.push({
            kind: "MARQUE",
            where: `${m.name}.${f}`,
            detail: `FOREIGN marque "${hit[1] ?? hit[0]}" — ${text.slice(0, 110)}`,
          });
      }
  }
  console.log(
    `  rows scanned for FOREIGN marques: ${rows} · hits: ${issues.filter((i) => i.kind === "MARQUE").length}` +
      (own.length ? ` (this tenant's own identity excluded: ${own[0]})` : ""),
  );

  if (issues.length === 0) {
    console.log(
      `\n  OFF-PATH CLEAN — 0 empty · 0 soft dead-ends · 0 marques\n`,
    );
    return true;
  }
  console.log(`\n  OFF-PATH ISSUES — ${issues.length}:`);
  const byKind = ["EMPTY", "DEAD-END", "MARQUE"] as const;
  for (const k of byKind) {
    const list = issues.filter((i) => i.kind === k);
    if (!list.length) continue;
    console.log(`\n  ${k} (${list.length}):`);
    for (const i of list.slice(0, 12))
      console.log(`    · ${i.where}\n        ${i.detail}`);
    if (list.length > 12) console.log(`    …and ${list.length - 12} more`);
  }
  console.log("");
  return false;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const all = process.argv.includes("--all");
  if (!all && args.length === 0) {
    console.error("usage: pnpm verify:demo-offpath <scenario>   (or --all)");
    process.exit(1);
  }
  const names = all
    ? existsSync(PROSPECTS)
      ? readdirSync(PROSPECTS, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : []
    : args;

  console.log(
    "\nDEMO.7 §4 — off-path robustness (poking never hits empty/dead/leaky)",
  );
  let ok = true;
  for (const n of names) if (!(await runScenario(n))) ok = false;
  const { prisma } = await import("@axona/db");
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main();
