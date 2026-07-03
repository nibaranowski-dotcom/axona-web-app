import { getCurrentUser } from "@/lib/session";
import { getProjectsData } from "@/lib/projects";
import {
  ProjectsView,
  type ProjectsScreenData,
} from "@/components/projects/ProjectsView";

// /projects (build-spec §4.7) — workspaces by module. Data from PROJ.1
// getProjectsData (org-scoped), read-only. The per-project file matrix is MTX.2.
// Static shell route → precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: ProjectsScreenData = {
  groups: [],
  rollup: { total: 0, modules: 0, files: 0, needsAttention: 0, byStatus: [] },
  now: 0,
};

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) return <ProjectsView data={EMPTY} />;

  try {
    const data = await getProjectsData(user.orgId);
    return <ProjectsView data={{ ...data, now: Date.now() }} />;
  } catch {
    return <ProjectsView data={EMPTY} error />;
  }
}
