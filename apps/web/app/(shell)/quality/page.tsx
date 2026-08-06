import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
import { hasRole } from "@/lib/rbac";
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
  testTrace: [],
  traceLines: [],
  canClassify: false,
};

export default async function QualityPage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
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

    // LINK.2 — a LINK.1 hop arrives with ?focus=<code>; resolve it so the record is
    // surfaced instead of the visitor landing on a bare list (a soft dead-end).
    const focused = await getFocusedRecord(
      user.orgId,
      "SPC_SAMPLE",
      searchParams?.focus,
      async (code) => {
        const r = await db.spcSample.findFirst({
          where: { serial: code },
          select: { characteristic: true, value: true },
        });
        return r ? `${r.characteristic} · ${r.value}` : null;
      },
    );
    return (
      <>
        {focused && (
          <FocusedRecord
            type={focused.type}
            code={focused.code}
            label={focused.label}
            groups={focused.groups}
            basePath="/quality"
          />
        )}
        <QualityView
          data={{
            ...quality,
            traceLines,
            canClassify: hasRole(user, ["ENGINEER", "OPS", "ADMIN"]),
          }}
        />
      </>
    );
  } catch {
    return <QualityView data={EMPTY} error />;
  }
}
