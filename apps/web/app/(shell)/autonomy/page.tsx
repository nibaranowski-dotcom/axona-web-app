import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getAutonomyData } from "@/lib/autonomy";
import { hasRole } from "@/lib/rbac";
import { approvalRoles } from "@/lib/approvals";
import {
  AutonomyView,
  type AutonomyScreenData,
} from "@/components/autonomy/AutonomyView";

// /autonomy (build-spec §4.19) — Robotics Ops / Autonomy: the autonomy-rate trend
// + policy versions + safety incidents. Data from AUTO.1 getAutonomyData (org-
// scoped); promote/rollback is the role-gated server action. Static shell route.
export const dynamic = "force-dynamic";

const EMPTY: AutonomyScreenData = {
  autonomySeries: [],
  safetyIncidents: [],
  policyVersions: [],
  rollup: {
    avgAutonomyRate: 0,
    avgTakeoversPer1k: 0,
    openIncidents: 0,
    canaryVersion: null,
  },
  traceLines: [],
  canManage: false,
};

export default async function AutonomyPage() {
  const user = await getCurrentUser();
  if (!user) return <AutonomyView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [autonomy, latestRun] = await Promise.all([
      getAutonomyData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "autonomy", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return (
      <AutonomyView
        data={{
          ...autonomy,
          traceLines,
          // RBAC.5 — the policy-rollback approval roles come from the registry.
          canManage: hasRole(user, approvalRoles("policy.rollback")),
        }}
      />
    );
  } catch {
    return <AutonomyView data={EMPTY} error />;
  }
}
