import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getSecurityData, getAccessGrants } from "@/lib/security";
import {
  SecurityView,
  type SecurityScreenData,
} from "@/components/security/SecurityView";

// /security (build-spec §4.22) — IT & Security: fleet endpoint posture, command
// access, and CVE triage of the connected-robot attack surface. Data from SEC.1
// getSecurityData + getAccessGrants (org-scoped), read-only. Static shell route →
// precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: SecurityScreenData = {
  cves: [],
  devicePosture: [],
  patchRollouts: [],
  rollup: {
    bySeverity: [],
    byStatus: [],
    unitsAffected: 0,
    postureSpread: [],
    openRollouts: 0,
  },
  accessGrants: [],
  traceLines: [],
};

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) return <SecurityView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [security, accessGrants, latestRun] = await Promise.all([
      getSecurityData(user.orgId),
      getAccessGrants(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "security", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <SecurityView data={{ ...security, accessGrants, traceLines }} />;
  } catch {
    return <SecurityView data={EMPTY} error />;
  }
}
