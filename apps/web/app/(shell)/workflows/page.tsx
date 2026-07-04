import { getCurrentUser } from "@/lib/session";
import { getWorkflowsData } from "@/lib/workflows";
import {
  WorkflowsView,
  type WorkflowsScreenData,
} from "@/components/workflows/WorkflowsView";

// /workflows (build-spec §4.5) — agent orchestration by module. Data from WFL.1
// getWorkflowsData (org-scoped), read-only. Static shell route → precedence over
// (shell)/[module]. The global Axona pane (GA.1) shows here (Core route).
export const dynamic = "force-dynamic";

const EMPTY: WorkflowsScreenData = {
  groups: [],
  rollup: { total: 0, active: 0, runs: 0, agentsOrchestrated: 0 },
  now: 0,
};

export default async function WorkflowsPage() {
  const user = await getCurrentUser();
  if (!user) return <WorkflowsView data={EMPTY} />;

  try {
    const data = await getWorkflowsData(user.orgId);
    return <WorkflowsView data={{ ...data, now: Date.now() }} />;
  } catch {
    return <WorkflowsView data={EMPTY} error />;
  }
}
