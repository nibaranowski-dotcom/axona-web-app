/**
 * Verify DEMO.6 beat #10 — the fault-to-part-order loop is navigable, both ways.
 * Run: pnpm verify:demo-6-10
 *
 * The Phase-1 audit found this beat DATA-ONLY with LINK.1 absent from the whole
 * path, and the chain itself unlinked: ZERO EntityLink edges touched the work order,
 * the cell, the part or the reorder. The narrative existed only as prose inside each
 * record. This asserts the loop is now the graph:
 *
 *   1 (static). The three module screens accept `?focus=` and host the LINK.1 panel;
 *      `entityRoute` deep-links to the record rather than a bare list.
 *   2 (data).   Every hop resolves through getConnectedObjects — WO → cell, WO → part,
 *      part → reorder, reorder → WO — with a real route on every neighbour.
 *   3 (data).   BOTH directions: each hop is reachable from its far end too, so the
 *      human can walk back. This is what "no dead-ends" means operationally.
 *   4 (data).   The loop CLOSES: from the reorder you reach the originating work
 *      order, so the walk returns to its start rather than trailing off.
 *   5 (data).   The reorder is agent-drafted and carries a CALIBRATED confidence read
 *      from its own audit entry — not a literal, not raw.
 *
 * Read-only: it walks the graph and asserts. Nothing to clean up.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntityType } from "@axona/db";

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

// SEED.1 — the tenant is resolved by a NON-marque anchor (the work-order code), never
// named. Hardcoding its org id put a banned marque in the tracked tree and the wall
// caught it; the same rule every other prospect verify follows.
const WO = "WO-NM-5521";
const CELL = "NM-PICK-0132";
const PART = "NM-GRIP-SERVO";
const PO = "PO-NM-9007";

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log(
    "\nVerifying DEMO.6 #10 — the fault loop is navigable both ways\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const links = read("packages/db/src/ontology/links.ts");
  const focusPanel = read("apps/web/components/ontology/FocusedRecord.tsx");
  const connected = read("apps/web/lib/connected-objects.ts");
  const screens = {
    "field-service": read("apps/web/app/(shell)/field-service/page.tsx"),
    inventory: read("apps/web/app/(shell)/inventory/page.tsx"),
    procurement: read("apps/web/app/(shell)/procurement/page.tsx"),
  };

  await check(
    "entityRoute deep-links module records (?focus=), one resolver",
    () => {
      return (
        /\/inventory\?focus=\$\{c\}/.test(links) &&
        /\/procurement\?focus=\$\{c\}/.test(links) &&
        /\/field-service\?focus=\$\{c\}/.test(links)
      );
    },
  );

  await check(
    "all three fault-loop screens host the LINK.1 focus panel",
    () => {
      return Object.values(screens).every(
        (s) => /getFocusedRecord/.test(s) && /FocusedRecord/.test(s),
      );
    },
  );

  await check(
    "the focus panel reuses ConnectedObjects — no parallel nav",
    () => {
      return (
        /ConnectedObjects/.test(focusPanel) &&
        /getConnectedObjects/.test(connected) &&
        // the shared resolver returns null for an unknown code (never invents a record)
        /if \(!id\) return null/.test(connected)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  // Resolve the tenant FROM the anchor, so this file never carries its name.
  const anchor = await prisma.workOrderField.findFirst({
    where: { code: WO },
    select: { orgId: true },
  });
  const TENANT = anchor?.orgId;
  if (!TENANT) {
    console.log("\n  SKIP data checks — that tenant is not seeded");
    finish();
    return;
  }

  const { getConnectedObjects } =
    await import("../../apps/web/lib/connected-objects");
  const neighbours = async (type: EntityType, code: string) =>
    (await getConnectedObjects(TENANT, type, code)).flatMap((g) => g.items);

  const wo = await neighbours("WORK_ORDER", WO);
  const cell = await neighbours("UNIT", CELL);
  const part = await neighbours("PART", PART);
  const po = await neighbours("PURCHASE_ORDER", PO);

  const reaches = (from: { code: string; route: string }[], code: string) =>
    from.some((n) => n.code === code && n.route.length > 0);

  // ── 2: forward — the walk the demo makes ──
  await check(`FORWARD: ${WO} → ${CELL} → ... every hop resolves`, () => {
    console.log(
      `        ${WO}: ${wo.length} neighbours · ${CELL}: ${cell.length} · ${PART}: ${part.length} · ${PO}: ${po.length}`,
    );
    return (
      reaches(wo, CELL) && // the fault: which cell
      reaches(wo, PART) && // the fix: the spare consumed
      reaches(part, PO) // the shortage → the reorder
    );
  });

  // ── 3: backward — the same edges walked the other way ──
  await check("BACKWARD: every hop is reachable from its far end", () => {
    return (
      reaches(cell, WO) && // cell → back to the work order
      reaches(part, WO) && // part → back to the work order
      reaches(po, PART) // reorder → back to the part
    );
  });

  // ── 4: the loop closes ──
  await check(`the loop CLOSES: ${PO} reaches back to ${WO}`, () => {
    return reaches(po, WO);
  });

  // ── no dead-ends: every neighbour on the path has a usable route ──
  await check(
    "NO DEAD-ENDS: every neighbour carries a resolvable route",
    () => {
      const all = [...wo, ...cell, ...part, ...po];
      const bad = all.filter((n) => !n.route || !n.code);
      if (bad.length)
        console.log(`        ${bad.length} neighbour(s) without a route`);
      return all.length > 0 && bad.length === 0;
    },
  );

  await check(
    "the module hops land ON the record (deep-linked, not a bare list)",
    () => {
      const hops = [
        ...wo.filter((n) => n.code === PART),
        ...part.filter((n) => n.code === PO),
        ...po.filter((n) => n.code === WO),
      ];
      const deep = hops.filter((n) => n.route.includes("?focus="));
      console.log(
        `        ${deep.length}/${hops.length} module hops deep-link`,
      );
      return hops.length >= 3 && deep.length === hops.length;
    },
  );

  // ── 5: the reorder's agent surface ──
  await check(
    "the reorder is agent-drafted with a CALIBRATED confidence (not raw, not a literal)",
    async () => {
      const { getProcurementQueue } =
        await import("../../apps/web/lib/procurement");
      const q = await getProcurementQueue(TENANT, {});
      const row = q.pos.find((p) => p.code === PO);
      if (!row?.agentDrafted || !row.agentConfidence) return false;
      const c = row.agentConfidence;
      console.log(
        `        ${PO}: raw ${c.raw} → calibrated ${c.calibrated} (${c.state}) · ${c.model}`,
      );
      return (
        c.state === "calibrated" && c.calibrated !== c.raw && !!c.model.length
      );
    },
  );

  await check(
    "approving the reorder carries the proposal into the audit",
    () => {
      const actions = read("apps/web/app/(shell)/procurement/actions.ts");
      // Reuses beat #4's DecideContext seam rather than a second agent layer.
      return (
        /proposalFor/.test(actions) &&
        /\{ proposal \}/.test(actions) &&
        /calibratedConfidence/.test(actions)
      );
    },
  );

  await prisma.$disconnect();
  finish();
}

run();
