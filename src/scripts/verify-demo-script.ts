/**
 * DEMO.7 — SCRIPT FIDELITY GATE. Run: pnpm verify:demo-script <scenario>
 *
 *   pnpm verify:demo-script <name>     one prospect's run-of-show
 *   pnpm verify:demo-script --all      every prospect that has a script manifest
 *
 * `verify:demo` asks "does every link resolve and every screen render". This asks the
 * question that costs the most when it is wrong: **is the number the presenter SAYS
 * still true of the seed?** A demo can be perfectly navigable and still fall apart the
 * moment a spoken "seven days late" meets a screen reading six.
 *
 * NOT in verify:all, deliberately: it asserts against gitignored, tenant-specific demo
 * data that CI does not have. Like verify:demo it SKIPS cleanly when the tenant is not
 * seeded, and it is run per-scenario before a send.
 *
 * MARQUE-FREE (SEED.1): every claim, code and org id comes from the gitignored
 * `prospects/<name>/script.manifest.ts`. Nothing prospect-named is hardcoded here.
 *
 * Read-only: it asserts against the seed and writes nothing, so there is nothing to
 * clean up — the strongest form of "self-cleaning" available to a checker.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ScriptManifest, SpokenClaim } from "./lib/script-manifest";

const ROOT = process.cwd();
const PROSPECTS = join(ROOT, "prospects");
const MANIFEST = "script.manifest.ts";

interface Result {
  say: string;
  ok: boolean;
  detail: string;
}

/** Assert one spoken claim against the live seed. Returns what was actually found. */
async function assertClaim(
  orgId: string,
  c: SpokenClaim,
): Promise<{ ok: boolean; detail: string }> {
  const { prisma, dbForOrg } = await import("@axona/db");
  const db = dbForOrg(orgId); // org-scoped: a claim can never be satisfied by another tenant

  switch (c.kind) {
    case "unit.populated": {
      const u = await db.unit.findFirst({
        where: { serial: c.serial },
        select: { id: true },
      });
      if (!u) return { ok: false, detail: `${c.serial} not found` };
      const lines = await db.asBuiltRecord.count({ where: { unitId: u.id } });
      const min = c.minAsBuiltLines ?? 1;
      return {
        ok: lines >= min,
        detail: `${c.serial}: ${lines} as-built lines (need >= ${min})`,
      };
    }
    case "unit.driftFlagged": {
      const u = await db.unit.findFirst({
        where: { serial: c.serial },
        select: { id: true },
      });
      if (!u) return { ok: false, detail: `${c.serial} not found` };
      const subs = await db.asBuiltRecord.count({
        where: { unitId: u.id, isSubstitution: true },
      });
      const min = c.atLeast ?? 1;
      return {
        ok: subs >= min,
        detail: `${c.serial}: ${subs} flagged substitution(s) (need >= ${min})`,
      };
    }
    case "test.outcome": {
      const t = await db.testRun.findFirst({
        where: { code: c.code },
        select: { outcome: true },
      });
      return {
        ok: t?.outcome === c.equals,
        detail: `${c.code}: outcome=${t?.outcome ?? "MISSING"} (want ${c.equals})`,
      };
    }
    case "rca.proposedCause": {
      const n = await db.nCR.findFirst({
        where: { code: c.code },
        select: { rootCause: true, linkedTo: true, configSnapshot: true },
      });
      if (!n) return { ok: false, detail: `${c.code} not found` };
      // The presenter says the agent proposed a cause AND names the suspect part/lot.
      // Both must be real: a cause with nothing bound to it is a guess on a slide.
      const bound = c.boundTo
        ? (n.linkedTo ?? "").includes(c.boundTo)
        : !!n.linkedTo;
      const hasSnapshot = n.configSnapshot !== null;
      return {
        ok: !!n.rootCause && bound && hasSnapshot,
        detail: `${c.code}: cause=${n.rootCause ?? "none"} · boundTo="${n.linkedTo ?? "none"}" · frozen-config=${hasSnapshot}`,
      };
    }
    case "eco.blastUnits": {
      const eco = await db.eCO.findFirst({
        where: { code: c.code },
        select: { id: true },
      });
      if (!eco) return { ok: false, detail: `${c.code} not found` };
      const { affectedUnits } = await import("@axona/agents");
      const res = await affectedUnits(db, { ecoId: c.code });
      return {
        ok: res.units.length >= c.atLeast,
        detail: `${c.code}: ${res.units.length} affected unit(s) (need >= ${c.atLeast})`,
      };
    }
    case "config.dualApprovedBaseline": {
      const cfg = await db.configurationVersion.findFirst({
        where: { name: c.name },
        select: {
          isBaseline: true,
          lockedAt: true,
          lockProposedById: true,
          lockedById: true,
        },
      });
      if (!cfg) return { ok: false, detail: `${c.name} not found` };
      const dual =
        !!cfg.lockProposedById &&
        !!cfg.lockedById &&
        cfg.lockProposedById !== cfg.lockedById;
      return {
        ok: cfg.isBaseline && !!cfg.lockedAt && dual,
        detail: `${c.name}: baseline=${cfg.isBaseline} locked=${!!cfg.lockedAt} proposer!=locker=${dual}`,
      };
    }
    case "part.stockLevel": {
      const p = await db.part.findFirst({
        where: { sku: c.sku },
        select: { onHand: true, reorderPoint: true },
      });
      if (!p) return { ok: false, detail: `${c.sku} not found` };
      return {
        ok:
          p.onHand === c.onHand &&
          p.reorderPoint === c.minLevel &&
          p.onHand < p.reorderPoint,
        detail: `${c.sku}: ${p.onHand} on hand vs min ${p.reorderPoint} (say ${c.onHand}/${c.minLevel}, below-min)`,
      };
    }
    case "part.locationSpread": {
      const p = await db.part.findFirst({
        where: { sku: c.sku },
        select: { id: true },
      });
      if (!p) return { ok: false, detail: `${c.sku} not found` };
      const rows = await db.inventoryStock.findMany({
        where: { partId: p.id },
        select: { location: true },
      });
      const distinct = [...new Set(rows.map((r) => r.location))];
      return {
        ok: distinct.length >= c.atLeast,
        detail: `${c.sku}: ${distinct.length} distinct location(s) (need >= ${c.atLeast}) — ${distinct.join(" · ")}`,
      };
    }
    case "po.status": {
      const po = await db.purchaseOrder.findFirst({
        where: { code: c.code },
        select: { status: true, draftedByAgentId: true },
      });
      if (!po) return { ok: false, detail: `${c.code} not found` };
      const agentOk =
        c.agentDrafted === undefined ||
        !!po.draftedByAgentId === c.agentDrafted;
      return {
        ok: po.status === c.equals && agentOk,
        detail: `${c.code}: status=${po.status} agent-drafted=${!!po.draftedByAgentId}`,
      };
    }
    case "po.daysPastPromised": {
      const po = await db.purchaseOrder.findFirst({
        where: { code: c.code },
        select: { eta: true, receivedAt: true },
      });
      if (!po?.eta)
        return { ok: false, detail: `${c.code} has no promised date` };
      const days = Math.floor((Date.now() - po.eta.getTime()) / 86_400_000);
      return {
        ok: days >= c.atLeast,
        detail: `${c.code}: ${days}d past promised (need >= ${c.atLeast})`,
      };
    }
    case "po.threeWayMatch": {
      const po = await db.purchaseOrder.findFirst({
        where: { code: c.code },
        select: { qty: true, status: true },
      });
      if (!po) return { ok: false, detail: `${c.code} not found` };
      // The spoken "six of six" is PO qty vs the qty on the packing list the agent
      // read, with the invoice bound and the serial captured at receipt. All four
      // have to be real for the sentence to be true.
      const file = await db.file.findFirst({
        where: { linkedTo: { contains: c.code } },
        select: { extracted: true },
      });
      const ex = (file?.extracted ?? null) as {
        invoice?: string;
        threeWayMatch?: boolean;
        lineItems?: { qty?: number; serials?: string[] }[];
      } | null;
      const line = ex?.lineItems?.[0];
      const invoice = await db.invoice.findFirst({
        where: { code: c.invoiceCode },
        select: { code: true },
      });
      const captured = await db.asBuiltRecord.findFirst({
        where: { componentSerial: c.capturedSerial },
        select: { componentSerial: true },
      });
      const ok =
        po.qty === c.qty &&
        line?.qty === c.qty &&
        ex?.threeWayMatch === true &&
        ex?.invoice === c.invoiceCode &&
        !!invoice &&
        !!captured;
      return {
        ok,
        detail: `${c.code}: PO qty=${po.qty} · packing-list qty=${line?.qty ?? "?"} · 3-way=${ex?.threeWayMatch} · invoice ${c.invoiceCode}=${!!invoice} · serial ${c.capturedSerial}=${!!captured}`,
      };
    }
    case "chain.resolves": {
      const wo = await db.workOrderField.findFirst({
        where: { code: c.workOrder },
        select: { robotSerial: true },
      });
      const unit = await db.unit.findFirst({
        where: { serial: c.unitSerial },
        select: { customerLabel: true },
      });
      const part = await db.part.findFirst({
        where: { sku: c.partSku },
        select: { onHand: true, reorderPoint: true },
      });
      const po = await db.purchaseOrder.findFirst({
        where: { code: c.poCode },
        select: { code: true },
      });
      const hops = [
        wo?.robotSerial === c.unitSerial,
        !!unit && (!c.unitCustomer || unit.customerLabel === c.unitCustomer),
        !!part && part.onHand < part.reorderPoint,
        !!po,
      ];
      return {
        ok: hops.every(Boolean),
        detail: `${c.workOrder}→${c.unitSerial}(${unit?.customerLabel ?? "?"})→${c.partSku}(short=${part ? part.onHand < part.reorderPoint : "?"})→${c.poCode}(${po ? "found" : "MISSING"})`,
      };
    }
    case "unit.buildReadiness": {
      const u = await db.unit.findFirst({
        where: { serial: c.serial },
        select: { id: true },
      });
      if (!u) return { ok: false, detail: `${c.serial} not found` };
      const { computeBuildReadiness } = await import("@axona/db");
      const r = await computeBuildReadiness(db, u.id, { now: Date.now() });
      return {
        ok:
          r.pctInHouse === c.pctInHouse &&
          r.blockingParts.length === c.blockingParts,
        detail: `${c.serial}: ${r.pctInHouse}% in-house, ${r.blockingParts.length} blocking (say ${c.pctInHouse}%, ${c.blockingParts})`,
      };
    }
  }
  // exhaustive by construction; `prisma` kept referenced for the import above
  void prisma;
  return { ok: false, detail: "unknown claim kind" };
}

async function runScenario(name: string): Promise<boolean> {
  const dir = join(PROSPECTS, name);
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) {
    console.log(`\n  SKIP ${name} — no ${MANIFEST}`);
    return true;
  }
  const mod = (await import(pathToFileURL(file).href)) as {
    default?: ScriptManifest;
  };
  const manifest = mod.default;
  if (!manifest?.orgId) {
    console.log(
      `\n  FAIL ${name} — ${MANIFEST} must default-export a ScriptManifest`,
    );
    return false;
  }

  const { prisma } = await import("@axona/db");
  const org = await prisma.org.findUnique({ where: { id: manifest.orgId } });
  if (!org) {
    console.log(`\n  SKIP ${manifest.script} — that tenant is not seeded here`);
    return true;
  }

  console.log(`\n═══ ${manifest.script} ═══\n`);
  const results: Result[] = [];
  for (const { say, claim } of manifest.claims) {
    const { ok, detail } = await assertClaim(manifest.orgId, claim);
    results.push({ say, ok, detail });
    console.log(`    ${ok ? "true " : "DRIFT"}  "${say}"`);
    console.log(`             ${detail}`);
  }

  const drift = results.filter((r) => !r.ok);
  if (drift.length === 0) {
    console.log(
      `\n  SCRIPT-TRUE — ${results.length} spoken claim(s), every one matches the seed\n`,
    );
    return true;
  }
  console.log(
    `\n  SCRIPT DRIFT — ${drift.length} of ${results.length} spoken claim(s) are NOT true of the seed:`,
  );
  for (const d of drift) console.log(`    · "${d.say}"\n        ${d.detail}`);
  console.log(
    "\n  Fix the SEED (or the script) before sending — the presenter says these out loud.\n",
  );
  return false;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const all = process.argv.includes("--all");
  if (!all && args.length === 0) {
    console.error("usage: pnpm verify:demo-script <scenario>   (or --all)");
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
    "\nDEMO.7 — script fidelity: does the SPOKEN number match the seed?",
  );
  let ok = true;
  for (const n of names) if (!(await runScenario(n))) ok = false;

  const { prisma } = await import("@axona/db");
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main();
