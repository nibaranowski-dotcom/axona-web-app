import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getQualityData } from "@/lib/quality";
import {
  QualityView,
  type QualityScreenData,
} from "@/components/quality/QualityView";

// /quality (build-spec §4.13) — the Quality & Testing screen: the SPC control
// chart (signature artifact) + defect Pareto + NCR tracker + certs. Read-only,
// data from QUAL.1 getQualityData (org-scoped). Static shell route → precedence
// over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: QualityScreenData = {
  spcSeries: [],
  ncrs: [],
  certs: [],
  defectPareto: [],
  traceLines: [],
};

export default async function QualityPage() {
  const user = await getCurrentUser();
  if (!user) return <QualityView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [quality, latestRun] = await Promise.all([
      getQualityData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "quality", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <QualityView data={{ ...quality, traceLines }} />;
  } catch {
    return <QualityView data={EMPTY} error />;
  }
}
