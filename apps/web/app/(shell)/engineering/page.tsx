import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getEngineeringData } from "@/lib/engineering";
import { hasRole } from "@/lib/rbac";
import {
  EngineeringView,
  type EngineeringScreenData,
} from "@/components/engineering/EngineeringView";

// /engineering (build-spec §4.18) — the Engineering & PLM screen: the ECO stage
// board + the HW↔firmware compatibility matrix (signature artifacts) + firmware
// releases. Data from ENG.1 getEngineeringData (org-scoped); release advance is
// the role-gated server action. Static shell route → precedence over [module].
export const dynamic = "force-dynamic";

const EMPTY: EngineeringScreenData = {
  ecos: [],
  firmwareReleases: [],
  compatMatrix: { hwRevs: [], fwVersions: [], cells: [] },
  traceLines: [],
  canAdvance: false,
};

export default async function EngineeringPage() {
  const user = await getCurrentUser();
  if (!user) return <EngineeringView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [engineering, latestRun] = await Promise.all([
      getEngineeringData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "engineering", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return (
      <EngineeringView
        data={{
          ...engineering,
          traceLines,
          canAdvance: hasRole(user, ["ENGINEER", "ADMIN"]),
        }}
      />
    );
  } catch {
    return <EngineeringView data={EMPTY} error />;
  }
}
