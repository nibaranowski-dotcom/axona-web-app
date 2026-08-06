import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
import { getEngineeringData } from "@/lib/engineering";
import { hasRole } from "@/lib/rbac";
import {
  EngineeringView,
  type EngineeringScreenData,
} from "@/components/engineering/EngineeringView";

// /engineering (build-spec §4.18) — the Engineering screen: the ECO stage
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

export default async function EngineeringPage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
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

    // LINK.2 — a LINK.1 hop arrives with ?focus=<code>; resolve it so the record is
    // surfaced instead of the visitor landing on a bare list (a soft dead-end).
    const focused = await getFocusedRecord(
      user.orgId,
      "PRODUCT_MODEL",
      searchParams?.focus,
      async (code) => {
        const r = await db.productModel.findFirst({
          where: { code },
          select: { name: true },
        });
        return r ? r.name : null;
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
            basePath="/engineering"
          />
        )}
        <EngineeringView
          data={{
            ...engineering,
            traceLines,
            canAdvance: hasRole(user, ["ENGINEER", "ADMIN"]),
          }}
        />
      </>
    );
  } catch {
    return <EngineeringView data={EMPTY} error />;
  }
}
