import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getLegalData } from "@/lib/legal";
import { LegalView, type LegalScreenData } from "@/components/legal/LegalView";

// /legal (build-spec §4.23) — Legal & Compliance: contract obligations vs live
// ops, export control, matters linked to source modules. Data from LEGAL.1
// getLegalData (org-scoped), read-only. Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: LegalScreenData = {
  obligations: [],
  exportLicenses: [],
  legalMatters: [],
  rollup: { obligationsAtRisk: 0, exportHolds: 0, openMatters: 0 },
  traceLines: [],
};

export default async function LegalPage() {
  const user = await getCurrentUser();
  if (!user) return <LegalView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [legal, latestRun] = await Promise.all([
      getLegalData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "legal", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <LegalView data={{ ...legal, traceLines }} />;
  } catch {
    return <LegalView data={EMPTY} error />;
  }
}
