/**
 * Verify DEMO.6 beat #7 — the reorder agent surfaces the min breach
 * Run: pnpm verify:demo-6-7
 *
 * The invariants live in lib/demo-6-surface (shared with the other surfacing beats,
 * so they cannot drift apart); this file supplies only what is specific to #7.
 * Self-cleaning. SEED.1 — the tenant is resolved from a non-marque anchor.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runSurfaceChecks, makeRunner } from "./lib/demo-6-surface";

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log(
    "\nVerifying DEMO.6 #7 — the reorder agent surfaces the min breach\n",
  );
  const r = makeRunner();
  const { prisma } = await import("@axona/db");
  const ANCHOR = "NM-GRIP-SERVO";
  const subject = {
    label: "#7 reorder shortage",
    kind: "inventory.review",
    targetType: "Part",
    code: ANCHOR,
    resolveOrg: async () =>
      (
        await prisma.part.findFirst({
          where: { sku: ANCHOR },
          select: { orgId: true },
        })
      )?.orgId ?? null,
    resolveProposal: async (orgId: string) => {
      const { getInventoryData } = await import("../../apps/web/lib/inventory");
      return (await getInventoryData(orgId)).agent;
    },
    staticFiles: [
      {
        path: "apps/web/lib/inventory.ts",
        mustMatch: [/buildAgentProposal/, /severity/],
      },
      {
        path: "apps/web/components/inventory/InventoryView.tsx",
        mustMatch: [/AgentProposalPanel/],
      },
    ],
    // confirming a shortage must NOT touch stock or move any PO — money stays gated
    snapshotProtected: async (orgId: string) => {
      const p = await prisma.part.findFirst({
        where: { orgId, sku: ANCHOR },
        select: { onHand: true, reorderPoint: true },
      });
      const pos = await prisma.purchaseOrder.findMany({
        where: { orgId, part: { sku: ANCHOR } },
        select: { code: true, status: true },
        orderBy: { code: "asc" },
      });
      return JSON.stringify({ p, pos });
    },
  };
  await runSurfaceChecks(subject, r, read);
  await prisma.$disconnect();
  r.finish();
}
run();
