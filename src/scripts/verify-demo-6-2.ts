/**
 * Verify DEMO.6 beat #2 — the as-built diff flags drift
 * Run: pnpm verify:demo-6-2
 *
 * The invariants live in lib/demo-6-surface (shared with the other surfacing beats,
 * so they cannot drift apart); this file supplies only what is specific to #2.
 * Self-cleaning. SEED.1 — the tenant is resolved from a non-marque anchor.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runSurfaceChecks, makeRunner } from "./lib/demo-6-surface";

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying DEMO.6 #2 — the as-built diff flags drift\n");
  const r = makeRunner();
  const { prisma } = await import("@axona/db");
  const ANCHOR = "SN-DC-4471";
  const subject = {
    label: "#2 as-built drift",
    kind: "asbuilt.review",
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
      const { getAsBuiltView } = await import("../../apps/web/lib/as-built");
      return (await getAsBuiltView(orgId, ANCHOR))?.agent ?? null;
    },
    staticFiles: [
      {
        path: "apps/web/lib/as-built.ts",
        mustMatch: [/buildAgentProposal/, /quarantinedRows/],
      },
      {
        path: "apps/web/components/units/AsBuiltDiffView.tsx",
        mustMatch: [/AgentProposalPanel/],
      },
      {
        path: "apps/web/app/(shell)/units/[serial]/as-built/actions.ts",
        mustMatch: [/asbuilt\.review/],
      },
    ],
    // an as-built capture is immutable: the row count + substitution flags must not move
    snapshotProtected: async (orgId: string) => {
      const rows = await prisma.asBuiltRecord.findMany({
        where: { unit: { orgId, serial: ANCHOR } },
        select: { bomPosition: true, isSubstitution: true, lotCode: true },
        orderBy: { bomPosition: "asc" },
      });
      return JSON.stringify(rows);
    },
  };
  await runSurfaceChecks(subject, r, read);
  await prisma.$disconnect();
  r.finish();
}
run();
