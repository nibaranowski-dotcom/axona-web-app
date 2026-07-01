import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getProcurementQueue } from "@/lib/procurement";
import { hasRole } from "@/lib/rbac";
import {
  ProcurementView,
  type ProcurementData,
} from "@/components/procurement/ProcurementView";

// /procurement (build-spec §4.10) — the wedge screen: the PO-queue signature
// artifact + the agent's reorder recommendation + human approval. Data from
// PROC.1 (getProcurementQueue, org-scoped). Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: ProcurementData = {
  pos: [],
  reorderCandidates: [],
  agentCount: 0,
  canApprove: false,
  traceLines: [],
};

export default async function ProcurementPage() {
  const user = await getCurrentUser();
  if (!user) return <ProcurementView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [{ pos, reorderCandidates }, agentCount, latestRun] =
      await Promise.all([
        getProcurementQueue(user.orgId, {}),
        db.agent.count({ where: { moduleKey: "procurement" } }),
        db.agentRun.findFirst({
          where: { agent: { moduleKey: "procurement", orgId: user.orgId } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return (
      <ProcurementView
        data={{
          pos,
          reorderCandidates,
          agentCount,
          canApprove: hasRole(user, ["OPS", "ADMIN"]),
          traceLines,
        }}
      />
    );
  } catch {
    return <ProcurementView data={EMPTY} error />;
  }
}
