import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getWorkflowDetail } from "@/lib/workflows";
import { WorkflowDetailView } from "@/components/workflows/WorkflowDetailView";

// /workflows/:id (build-spec §4.6) — the workflow detail: step-flow canvas + run
// console (replays the latest persisted run; re-runs via WF.1's RBAC-gated API).
// Org-scoped, read-only data. Core route → the global Axona pane stays.
export const dynamic = "force-dynamic";

export default async function WorkflowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return notFound();
  const detail = await getWorkflowDetail(user.orgId, params.id);
  if (!detail) return notFound();
  return <WorkflowDetailView detail={detail} now={Date.now()} />;
}
