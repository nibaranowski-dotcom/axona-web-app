/**
 * Verify DEMO.6 beat #5 — the blast radius is computed by an agent
 * Run: pnpm verify:demo-6-5
 *
 * The invariants live in lib/demo-6-surface (shared with the other surfacing beats,
 * so they cannot drift apart); this file supplies only what is specific to #5.
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
    "\nVerifying DEMO.6 #5 — the blast radius is computed by an agent\n",
  );
  const r = makeRunner();
  const { prisma } = await import("@axona/db");
  const ANCHOR = "ECO-DC-318";
  const subject = {
    label: "#5 blast radius",
    kind: "blast.review",
    targetType: "ECO",
    code: ANCHOR,
    resolveOrg: async () =>
      (
        await prisma.eCO.findFirst({
          where: { code: ANCHOR },
          select: { orgId: true },
        })
      )?.orgId ?? null,
    resolveProposal: async (orgId: string) => {
      const { getBlastRadiusView } =
        await import("../../apps/web/lib/blast-radius");
      return (await getBlastRadiusView(orgId, "eco" as never, ANCHOR)).agent;
    },
    staticFiles: [
      {
        path: "apps/web/lib/blast-radius.ts",
        mustMatch: [/buildAgentProposal/, /blastSignals/],
      },
      {
        path: "apps/web/components/units/BlastRadiusView.tsx",
        mustMatch: [/AgentProposalPanel/],
      },
      // the ECO release itself keeps its own gated kind — acknowledging is not releasing
      {
        path: "apps/web/app/(shell)/changes/actions.ts",
        mustMatch: [/eco\.release/, /ecoProposal/],
      },
    ],
    // the ECO stage is owned by decide("eco.release") — a blast acknowledgement must not move it
    snapshotProtected: async (orgId: string) => {
      const e = await prisma.eCO.findFirst({
        where: { orgId, code: ANCHOR },
        select: { stage: true, rolloutStatus: true },
      });
      return JSON.stringify(e);
    },
  };
  await runSurfaceChecks(subject, r, read);
  await prisma.$disconnect();
  r.finish();
}
run();
