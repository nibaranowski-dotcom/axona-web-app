import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getPeopleData } from "@/lib/people";
import {
  PeopleView,
  type PeopleScreenData,
} from "@/components/people/PeopleView";

// /people (build-spec §4.21) — People & Workforce: the certification matrix that
// gates field dispatch, field-team growth, and headcount. Data from PPL.1
// getPeopleData (org-scoped), read-only. Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: PeopleScreenData = {
  certMatrix: { certKeys: [], technicians: [] },
  fieldTeam: [],
  requisitions: [],
  rollup: {
    certsExpiring: 0,
    headcountFilled: 0,
    headcountTarget: 0,
    fieldTeamSize: 0,
  },
  traceLines: [],
};

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return <PeopleView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [people, latestRun] = await Promise.all([
      getPeopleData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "people", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <PeopleView data={{ ...people, traceLines }} />;
  } catch {
    return <PeopleView data={EMPTY} error />;
  }
}
