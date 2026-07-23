import { getCurrentUser } from "@/lib/session";
import { getTestExplorer } from "@/lib/tests";
import {
  TestExplorerView,
  type TestExplorerData,
} from "@/components/tests/TestExplorerView";

// /tests (PLM.6 · `Test Explorer.dc.html`) — the test-traceability list, answering
// Q3 at fleet scale: every run grouped by procedure, filterable, with compare mode
// surfacing config deltas. LIST screen → back-arrow to Quality + mono eyebrow.
// Org-scoped via getTestExplorer → dbForOrg.
export const dynamic = "force-dynamic";

const EMPTY: TestExplorerData = {
  groups: [],
  facets: { procedure: [], config: [], unit: [], outcome: [] },
  total: 0,
  matched: 0,
};

export default async function TestsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) return <TestExplorerView data={EMPTY} />;

  const one = (k: string): string | undefined => {
    const v = searchParams?.[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.length > 0 ? s : undefined;
  };
  const filters = {
    q: one("q"),
    procedure: one("procedure"),
    config: one("config"),
    unit: one("unit"),
    outcome: one("outcome"),
  };

  try {
    const data = await getTestExplorer(user.orgId, filters);
    return <TestExplorerView data={data} filters={filters} />;
  } catch {
    return <TestExplorerView data={EMPTY} error />;
  }
}
