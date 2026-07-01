/**
 * Verify PROC.2 — Procurement screen. Static checks always run; the queue +
 * role-gate structural checks are gated on DATABASE_URL. Run: pnpm verify:proc-2
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying PROC.2 — Procurement screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/procurement/page.tsx")) &&
      ["ProcurementView", "PoQueue", "PoRow", "ReorderBanner"].every((c) =>
        existsSync(join(base, `components/procurement/${c}.tsx`)),
      ),
  );

  const actions = read(join(base, "app/(shell)/procurement/actions.ts"));
  await check(
    "approve action: requireRole FIRST, org-scoped, revalidates",
    () =>
      /requireRole\(user, \["OPS", "ADMIN"\]\)/.test(actions) &&
      /dbForOrg/.test(actions) &&
      /revalidatePath/.test(actions) &&
      // requireRole call precedes the dbForOrg(...) call (not the import)
      actions.indexOf("requireRole(") < actions.indexOf("dbForOrg("),
  );
  await check("AUDIT.3 seam left for the event log", () =>
    /AUDIT\.3/.test(actions),
  );
  await check(
    "only human reaches SENT (agent never auto-sends: APPROVED→SENT is the human step)",
    () => /APPROVED:\s*"SENT"/.test(actions),
  );
  await check("status pills — no red", () => {
    const t = read(join(base, "components/procurement/PoRow.tsx"));
    return (
      !/\bred\b|#f00|ff0000/i.test(t) &&
      /bg-success/.test(t) &&
      /bg-accent/.test(t)
    );
  });
  await check("no emoji / no raw hex in procurement components", () => {
    const all = readdirSync(join(base, "components/procurement"))
      .map((f) => read(join(base, "components/procurement", f)))
      .join("\n");
    return (
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(all)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getProcurementQueue } =
      await import("../../apps/web/lib/procurement");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      await check("queue has the agent-drafted PO-9007 flagged", async () => {
        const q = await getProcurementQueue(org.id, {});
        const po = q.pos.find((p) => p.code === "PO-9007");
        return !!po && po.agentDrafted === true;
      });
      await check("reorder candidates present (SERVO-205 / -204)", async () => {
        const q = await getProcurementQueue(org.id, {});
        return q.reorderCandidates.some((c) =>
          /SERVO-205|SERVO-204/.test(c.sku),
        );
      });
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
