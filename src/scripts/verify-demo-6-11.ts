/**
 * Verify DEMO.6 beat #11 — build readiness proposes a next action
 * Run: pnpm verify:demo-6-11
 *
 * The invariants live in lib/demo-6-surface (shared with the other surfacing beats,
 * so they cannot drift apart); this file supplies only what is specific to #11.
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
    "\nVerifying DEMO.6 #11 — build readiness proposes a next action\n",
  );
  const r = makeRunner();
  const { prisma } = await import("@axona/db");
  const ANCHOR = "NM-PICK-0142";
  const subject = {
    label: "#11 readiness next action",
    kind: "readiness.review",
    targetType: "Unit",
    code: ANCHOR,
    resolveOrg: async () =>
      (
        await prisma.unit.findFirst({
          where: { serial: ANCHOR },
          select: { orgId: true },
        })
      )?.orgId ?? null,
    resolveProposal: async (orgId: string) => {
      const { getUnitDetail } = await import("../../apps/web/lib/unit-detail");
      return (await getUnitDetail(orgId, ANCHOR))?.readinessAgent ?? null;
    },
    staticFiles: [
      {
        path: "apps/web/lib/unit-detail.ts",
        mustMatch: [/buildAgentProposal/, /readinessSignals/],
      },
      // LINK.1 — blockers deep-link to the RECORD, not a bare list
      {
        path: "apps/web/components/units/UnitView.tsx",
        mustMatch: [/AgentProposalPanel/, /\?focus=/],
      },
    ],
    // proposing an action must not order anything: POs and stock are untouched
    snapshotProtected: async (orgId: string) => {
      const pos = await prisma.purchaseOrder.findMany({
        where: { orgId },
        select: { code: true, status: true },
        orderBy: { code: "asc" },
      });
      return JSON.stringify(pos);
    },
  };
  await runSurfaceChecks(subject, r, read);
  await prisma.$disconnect();
  r.finish();
}
run();
