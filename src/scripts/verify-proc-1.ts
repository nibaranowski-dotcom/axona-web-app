/**
 * Verify PROC.1 — Procurement data/API. Static checks always run; the queue +
 * reorder + isolation checks are gated on DATABASE_URL. Run: pnpm verify:proc-1
 */
import { existsSync } from "node:fs";
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

async function run(): Promise<void> {
  console.log("\nVerifying PROC.1 — Procurement data/API\n");

  const base = join(process.cwd(), "apps/web");
  await check(
    "lib + routes exist",
    () =>
      existsSync(join(base, "lib/procurement.ts")) &&
      existsSync(join(base, "app/api/procurement/pos/route.ts")) &&
      existsSync(join(base, "app/api/procurement/suppliers/route.ts")) &&
      existsSync(join(base, "app/api/procurement/parts/route.ts")),
  );

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
      const q = await getProcurementQueue(org.id, {});

      await check(
        "queue returns POs with joined supplier + part labels",
        () =>
          q.pos.length > 0 &&
          q.pos.every(
            (p) =>
              typeof p.supplier === "string" &&
              p.supplier.length > 0 &&
              typeof p.partSku === "string" &&
              p.partSku.length > 0,
          ),
      );

      await check("agent-drafted PO-9007 is present + flagged", async () => {
        const qa = await getProcurementQueue(org.id, {
          status: "AWAITING_APPROVAL",
        });
        const po = qa.pos.find((p) => p.code === "PO-9007");
        return (
          !!po &&
          po.status === "AWAITING_APPROVAL" &&
          po.agentDrafted === true &&
          po.draftedByAgentId !== null
        );
      });

      await check("status filter narrows the queue", async () => {
        const all = await getProcurementQueue(org.id, {});
        const sent = await getProcurementQueue(org.id, { status: "SENT" });
        return (
          sent.pos.every((p) => p.status === "SENT") &&
          sent.pos.length <= all.pos.length
        );
      });

      await check(
        "reorder candidates query works (onHand <= reorderPoint)",
        () =>
          Array.isArray(q.reorderCandidates) &&
          q.reorderCandidates.every(
            (c) => typeof c.sku === "string" && c.onHand <= c.reorderPoint,
          ),
      );

      await check(
        "org isolation — org B queue excludes org A's POs",
        async () => {
          const second = await prisma.org.findFirst({
            where: { name: "Isolation Test Co" },
          });
          if (!second) throw new Error("second org missing");
          const q2 = await getProcurementQueue(second.id, {});
          // The demo-org agent-drafted PO must never appear in org B's queue.
          return (
            q2.pos.every((p) => p.code !== "PO-9007") &&
            q2.pos.length <= q.pos.length
          );
        },
      );
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
