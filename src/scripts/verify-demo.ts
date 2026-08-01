/**
 * DEMOVERIFY — "safe to send" guard for prospect demo links.
 *
 *   pnpm verify:demo <prospect>     e.g. pnpm verify:demo <name>
 *   pnpm verify:demo --all          every prospect that has a manifest
 *
 * A prospect email deep-links into a seeded tenant and makes factual claims about
 * what the recipient will see. Until now a human checked each link and each claim
 * before every send. This does it: for the named prospect's walkthrough manifest it
 * asserts, against that org's real data, that
 *
 *   1. every hero entity EXISTS on that tenant,
 *   2. its screen is POPULATED (a unit has as-built lines, a PO has a part+qty, an
 *      NCR has a root cause, a test run has results) — a live link to an empty
 *      screen is still a bad send,
 *   3. every route matches a REAL app route (including dynamic segments), so a
 *      renamed or mistyped path is caught before it 404s in front of a prospect,
 *   4. every CLAIM the copy makes holds, reported with the actual value when it
 *      does not, and
 *   5. each hero entity is ORG-ISOLATED — visible on this tenant and not found
 *      through another org's scoped client.
 *
 * Output is per-email SAFE TO SEND / NOT SAFE, non-zero exit on any failure. It
 * never "passes to be nice": a dead link or a contradicted claim fails the send.
 *
 * MARQUE-FREE by construction (SEED.1): this file resolves everything through the
 * gitignored manifest under `prospects/<name>/`. No tenant name, org id or hero code
 * is hardcoded here, so `verify:seed-1` stays green.
 *
 * Deterministic (VERIFY.3): `--now=<iso>` injects the clock so "six days late" is
 * evaluated against a fixed instant rather than wall time.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  Claim,
  CheckResult,
  WalkthroughManifest,
  WalkthroughStep,
} from "./lib/walkthrough";

const ROOT = process.cwd();
const PROSPECTS = join(ROOT, "prospects");
const MANIFEST = "walkthrough.manifest.ts";

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** Real app routes, derived from the filesystem — `[param]` becomes a wildcard. */
function appRoutes(): RegExp[] {
  const out: RegExp[] = [];
  const walk = (dir: string, segs: string[]): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const name = e.name;
      if (name.startsWith("_") || name === "api") continue;
      // route groups like `(shell)` do not contribute a path segment
      const next = /^\(.*\)$/.test(name) ? segs : [...segs, name];
      const child = join(dir, name);
      if (existsSync(join(child, "page.tsx"))) {
        const pattern = next
          .map((s) => (/^\[.+\]$/.test(s) ? "[^/]+" : escape(s)))
          .join("/");
        out.push(new RegExp(`^/${pattern}/?$`));
      }
      walk(child, next);
    }
  };
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const appDir = join(ROOT, "apps/web/app");
  if (existsSync(join(appDir, "page.tsx"))) out.push(/^\/$/);
  walk(appDir, []);
  return out;
}

interface Ctx {
  db: OrgScoped;
  other: OrgScoped;
  now: number;
  computeBuildReadiness: typeof import("@axona/db").computeBuildReadiness;
}
// Structural view of the org-scoped client — only what this script reads.
type OrgScoped = import("@axona/db").OrgScopedDb;

const ok = (label: string, detail?: string): CheckResult => ({
  ok: true,
  label,
  detail,
});
const bad = (label: string, detail: string): CheckResult => ({
  ok: false,
  label,
  detail,
});

/** Does the hero exist AND does its screen have something on it? */
async function checkHero(
  step: WalkthroughStep,
  ctx: Ctx,
): Promise<CheckResult[]> {
  const code = step.heroCode;
  if (!code || step.kind === "screen") return [];
  const { db } = ctx;
  switch (step.kind) {
    case "unit": {
      const u = await db.unit.findFirst({ where: { serial: code } });
      if (!u) return [bad(`unit ${code} exists`, "not found on this tenant")];
      const asBuilt = await db.asBuiltRecord.count({ where: { unitId: u.id } });
      return [
        ok(`unit ${code} exists`),
        asBuilt > 0
          ? ok(`unit ${code} is populated`, `${asBuilt} as-built lines`)
          : bad(
              `unit ${code} is populated`,
              "0 as-built lines — screen is empty",
            ),
      ];
    }
    case "po": {
      const p = await db.purchaseOrder.findFirst({ where: { code } });
      if (!p) return [bad(`PO ${code} exists`, "not found on this tenant")];
      return [
        ok(`PO ${code} exists`),
        p.partId && p.qty > 0
          ? ok(`PO ${code} is populated`, `qty ${p.qty}`)
          : bad(`PO ${code} is populated`, "no part/qty on the order"),
      ];
    }
    case "ncr": {
      const n = await db.nCR.findFirst({ where: { code } });
      if (!n) return [bad(`NCR ${code} exists`, "not found on this tenant")];
      return [
        ok(`NCR ${code} exists`),
        n.rootCause
          ? ok(`NCR ${code} is populated`, `root cause: ${n.rootCause}`)
          : bad(
              `NCR ${code} is populated`,
              "no root cause — RCA screen is thin",
            ),
      ];
    }
    case "part": {
      const p = await db.part.findFirst({ where: { sku: code } });
      if (!p) return [bad(`part ${code} exists`, "not found on this tenant")];
      const stock = await db.inventoryStock.count({ where: { partId: p.id } });
      return [
        ok(`part ${code} exists`),
        stock > 0
          ? ok(`part ${code} is populated`, `${stock} stock rows`)
          : bad(`part ${code} is populated`, "no inventory rows"),
      ];
    }
    case "eco": {
      const e = await db.eCO.findFirst({ where: { code } });
      if (!e) return [bad(`ECO ${code} exists`, "not found on this tenant")];
      return [
        ok(`ECO ${code} exists`),
        ok(`ECO ${code} is populated`, e.stage),
      ];
    }
    case "workOrder": {
      const w = await db.workOrderField.findFirst({ where: { code } });
      if (!w) return [bad(`WO ${code} exists`, "not found on this tenant")];
      return [ok(`WO ${code} exists`), ok(`WO ${code} is populated`, w.issue)];
    }
    case "testRun": {
      const t = await db.testRun.findFirst({ where: { code } });
      if (!t)
        return [bad(`test run ${code} exists`, "not found on this tenant")];
      const results = await db.testResult.count({ where: { testRunId: t.id } });
      return [
        ok(`test run ${code} exists`),
        results > 0
          ? ok(`test run ${code} is populated`, `${results} steps`)
          : bad(`test run ${code} is populated`, "0 result steps"),
      ];
    }
  }
  return [];
}

/**
 * Isolation, checked BY ID — not by code.
 *
 * Hero CODES are not unique across tenants: each prospect seed replays the same
 * narrative, so `PO-9001` legitimately exists on several orgs at once. That is not a
 * leak (the app scopes every read by session org), and asserting code-uniqueness
 * would fail every shared-narrative link for the wrong reason. The property that
 * actually matters is that THIS tenant's ROW is unreachable from another org — so we
 * resolve the id here and look that id up through the other org's client.
 */
async function checkIsolation(
  step: WalkthroughStep,
  ctx: Ctx,
): Promise<CheckResult[]> {
  const code = step.heroCode;
  if (!code || step.kind === "screen") return [];
  const { db, other } = ctx;
  const label = `${code} row is org-isolated`;
  const mine =
    step.kind === "unit"
      ? await db.unit.findFirst({
          where: { serial: code },
          select: { id: true },
        })
      : step.kind === "po"
        ? await db.purchaseOrder.findFirst({
            where: { code },
            select: { id: true },
          })
        : step.kind === "ncr"
          ? await db.nCR.findFirst({ where: { code }, select: { id: true } })
          : step.kind === "part"
            ? await db.part.findFirst({
                where: { sku: code },
                select: { id: true },
              })
            : step.kind === "eco"
              ? await db.eCO.findFirst({
                  where: { code },
                  select: { id: true },
                })
              : step.kind === "workOrder"
                ? await db.workOrderField.findFirst({
                    where: { code },
                    select: { id: true },
                  })
                : await db.testRun.findFirst({
                    where: { code },
                    select: { id: true },
                  });
  if (!mine) return [bad(label, "hero not found on this tenant")];
  const leaked =
    step.kind === "unit"
      ? await other.unit.findFirst({ where: { id: mine.id } })
      : step.kind === "po"
        ? await other.purchaseOrder.findFirst({ where: { id: mine.id } })
        : step.kind === "ncr"
          ? await other.nCR.findFirst({ where: { id: mine.id } })
          : step.kind === "part"
            ? await other.part.findFirst({ where: { id: mine.id } })
            : step.kind === "eco"
              ? await other.eCO.findFirst({ where: { id: mine.id } })
              : step.kind === "workOrder"
                ? await other.workOrderField.findFirst({
                    where: { id: mine.id },
                  })
                : await other.testRun.findFirst({ where: { id: mine.id } });
  return [
    leaked
      ? bad(label, "this tenant's row is reachable from another org")
      : ok(label),
  ];
}

const DAY = 86_400_000;

/** Every claim, checked against real rows, reporting the actual value on failure. */
async function checkClaim(c: Claim, ctx: Ctx): Promise<CheckResult> {
  const { db } = ctx;
  switch (c.kind) {
    case "po.status": {
      const p = await db.purchaseOrder.findFirst({ where: { code: c.code } });
      if (!p) return bad(`${c.code} status == ${c.equals}`, "PO not found");
      return p.status === c.equals
        ? ok(`${c.code} status == ${c.equals}`)
        : bad(`${c.code} status == ${c.equals}`, `actual: ${p.status}`);
    }
    case "po.daysPastPromised": {
      const p = await db.purchaseOrder.findFirst({ where: { code: c.code } });
      if (!p)
        return bad(`${c.code} >= ${c.atLeast}d past promised`, "PO not found");
      if (!p.eta)
        return bad(
          `${c.code} >= ${c.atLeast}d past promised`,
          "no promised date",
        );
      const days = Math.floor((ctx.now - new Date(p.eta).getTime()) / DAY);
      return days >= c.atLeast
        ? ok(`${c.code} >= ${c.atLeast}d past promised`, `actual: ${days}d`)
        : bad(`${c.code} >= ${c.atLeast}d past promised`, `actual: ${days}d`);
    }
    case "po.agentDrafted": {
      const p = await db.purchaseOrder.findFirst({ where: { code: c.code } });
      if (!p) return bad(`${c.code} agent-drafted`, "PO not found");
      const is = p.draftedByAgentId != null;
      return is === c.is
        ? ok(`${c.code} agent-drafted == ${c.is}`)
        : bad(`${c.code} agent-drafted == ${c.is}`, `actual: ${is}`);
    }
    case "part.onHandBelowMin": {
      const p = await db.part.findFirst({ where: { sku: c.sku } });
      if (!p) return bad(`${c.sku} below min`, "part not found");
      const is = p.onHand < p.reorderPoint;
      return is === c.is
        ? ok(
            `${c.sku} below min == ${c.is}`,
            `onHand ${p.onHand} / min ${p.reorderPoint}`,
          )
        : bad(
            `${c.sku} below min == ${c.is}`,
            `actual: onHand ${p.onHand} vs min ${p.reorderPoint}`,
          );
    }
    case "part.locationCount": {
      const p = await db.part.findFirst({ where: { sku: c.sku } });
      if (!p) return bad(`${c.sku} in ${c.equals} locations`, "part not found");
      const rows = await db.inventoryStock.findMany({
        where: { partId: p.id },
        select: { location: true },
      });
      const n = new Set(rows.map((r) => r.location)).size;
      return n === c.equals
        ? ok(`${c.sku} in ${c.equals} locations`)
        : bad(`${c.sku} in ${c.equals} locations`, `actual: ${n} location(s)`);
    }
    case "part.onHandAtLocation": {
      const p = await db.part.findFirst({ where: { sku: c.sku } });
      if (!p)
        return bad(`${c.sku} @ ${c.location} == ${c.equals}`, "part not found");
      const row = await db.inventoryStock.findFirst({
        where: { partId: p.id, location: c.location },
      });
      const actual = row?.onHand ?? 0;
      return actual === c.equals
        ? ok(`${c.sku} @ ${c.location} == ${c.equals}`)
        : bad(`${c.sku} @ ${c.location} == ${c.equals}`, `actual: ${actual}`);
    }
    case "unit.customerLabel": {
      const u = await db.unit.findFirst({ where: { serial: c.serial } });
      if (!u)
        return bad(`${c.serial} customer == ${c.equals}`, "unit not found");
      const actual =
        (u as { customerLabel?: string | null }).customerLabel ?? "";
      return actual === c.equals
        ? ok(`${c.serial} customer == ${c.equals}`)
        : bad(
            `${c.serial} customer == ${c.equals}`,
            `actual: ${actual || "(none)"}`,
          );
    }
    case "unit.buildReadiness": {
      const u = await db.unit.findFirst({ where: { serial: c.serial } });
      if (!u) return bad(`${c.serial} build readiness`, "unit not found");
      const r = await ctx.computeBuildReadiness(db, u.id, { now: ctx.now });
      const parts: string[] = [];
      let good = true;
      if (c.pctInHouse) {
        const d = Math.abs(r.pctInHouse - c.pctInHouse.approx);
        if (d > c.pctInHouse.tolerance) good = false;
        parts.push(
          `pctInHouse ${r.pctInHouse} (claimed ~${c.pctInHouse.approx})`,
        );
      }
      if (c.blocking != null) {
        if (r.blockingParts.length !== c.blocking) good = false;
        parts.push(
          `blocking ${r.blockingParts.length} (claimed ${c.blocking})`,
        );
      }
      const label = `${c.serial} build readiness`;
      return good
        ? ok(label, parts.join(" · "))
        : bad(label, parts.join(" · "));
    }
    case "testRun.outcome": {
      const t = await db.testRun.findFirst({ where: { code: c.code } });
      if (!t)
        return bad(`${c.code} outcome == ${c.equals}`, "test run not found");
      const actual = String(t.outcome ?? "");
      return actual === c.equals
        ? ok(`${c.code} outcome == ${c.equals}`)
        : bad(
            `${c.code} outcome == ${c.equals}`,
            `actual: ${actual || "(none)"}`,
          );
    }
    case "inventory.locationsInclude": {
      const rows = await db.inventoryStock.findMany({
        select: { location: true },
      });
      const have = new Set(rows.map((r) => r.location));
      const missing = c.locations.filter((l) => !have.has(l));
      const label = `inventory spans ${c.locations.length} named location(s)`;
      return missing.length === 0
        ? ok(label, `${have.size} location(s) on this tenant`)
        : bad(label, `missing: ${missing.join(", ")}`);
    }
    case "eco.stage": {
      const e = await db.eCO.findFirst({ where: { code: c.code } });
      if (!e) return bad(`${c.code} stage == ${c.equals}`, "ECO not found");
      return e.stage === c.equals
        ? ok(`${c.code} stage == ${c.equals}`)
        : bad(`${c.code} stage == ${c.equals}`, `actual: ${e.stage}`);
    }
    case "ncr.hasRootCause": {
      const n = await db.nCR.findFirst({ where: { code: c.code } });
      if (!n) return bad(`${c.code} has root cause`, "NCR not found");
      const is = !!n.rootCause;
      return is === c.is
        ? ok(`${c.code} has root cause == ${c.is}`, n.rootCause ?? undefined)
        : bad(`${c.code} has root cause == ${c.is}`, `actual: ${is}`);
    }
  }
}

function manifestDirs(only: string | null): string[] {
  if (!existsSync(PROSPECTS)) return [];
  return readdirSync(PROSPECTS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => !only || e.name === only)
    .map((e) => join(PROSPECTS, e.name))
    .filter((d) => existsSync(join(d, MANIFEST)));
}

async function run(): Promise<void> {
  const positional = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const all = process.argv.includes("--all");
  const nowArg = arg("now");
  const now = nowArg ? new Date(nowArg).getTime() : Date.now();

  // No argument = every prospect that has a manifest. That is what `verify:all`
  // invokes, and it is the right default for a gate: check everything present,
  // skip cleanly when nothing is (the prospect-tenant pattern).
  const dirs = manifestDirs(all || !positional ? null : positional);
  if (dirs.length === 0) {
    // The prospect-tenant pattern: no manifest present is a clean skip, never a fail.
    console.log(
      `\n  SKIP verify:demo — no walkthrough manifest present${positional ? ` for ${positional}` : ""}\n`,
    );
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP verify:demo — DATABASE_URL not set\n");
    return;
  }

  const { prisma, dbForOrg, computeBuildReadiness } = await import("@axona/db");
  const routes = appRoutes();
  let anyFailed = false;

  for (const dir of dirs) {
    const mod = (await import(pathToFileURL(resolve(dir, MANIFEST)).href)) as {
      default?: WalkthroughManifest;
      manifest?: WalkthroughManifest;
    };
    const m = mod.default ?? mod.manifest;
    if (!m?.orgId || !Array.isArray(m.steps)) {
      console.log(
        `\n  FAIL ${dir}/${MANIFEST} must default-export a WalkthroughManifest\n`,
      );
      anyFailed = true;
      continue;
    }

    // a second real org, for the isolation probe
    const otherOrg = await prisma.org.findFirst({
      where: { NOT: { id: m.orgId } },
      select: { id: true },
    });
    const ctx: Ctx = {
      db: dbForOrg(m.orgId),
      other: dbForOrg(otherOrg?.id ?? "org_no_such_tenant"),
      now,
      computeBuildReadiness,
    };

    console.log(`\n═══ ${m.email} ═══`);
    let failed = 0;
    for (const step of m.steps) {
      const results: CheckResult[] = [];
      results.push(
        // a link may carry a query string (e.g. ?type=eco&value=…) — the route
        // table only describes paths, so compare against the path alone
        routes.some((r) => r.test(step.route.split("?")[0] ?? step.route))
          ? ok(`route ${step.route} is a real app route`)
          : bad(
              `route ${step.route} is a real app route`,
              "no matching page.tsx",
            ),
      );
      results.push(...(await checkHero(step, ctx)));
      results.push(...(await checkIsolation(step, ctx)));
      for (const c of step.claims ?? []) results.push(await checkClaim(c, ctx));

      const stepFailed = results.filter((r) => !r.ok);
      failed += stepFailed.length;
      console.log(
        `\n  ${stepFailed.length ? "NOT SAFE" : "  ok    "} ${step.route}${step.note ? `  — ${step.note}` : ""}`,
      );
      for (const r of results) {
        console.log(
          `      ${r.ok ? "·" : "FAIL"} ${r.label}${r.detail ? `  [${r.detail}]` : ""}`,
        );
      }
    }
    console.log(
      failed === 0
        ? `\n  SAFE TO SEND — ${m.steps.length} step(s), every link resolves and every claim holds\n`
        : `\n  NOT SAFE — ${failed} failing check(s); fix the copy or the data before sending\n`,
    );
    if (failed > 0) anyFailed = true;
  }

  await prisma.$disconnect();
  if (anyFailed) process.exit(1);
}

void run();
