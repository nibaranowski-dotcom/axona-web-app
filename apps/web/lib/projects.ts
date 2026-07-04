import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { ProjectStatus } from "@axona/db";

// PROJ.1 — Projects read model (build-spec §4.7). Workspaces by module. Read-only
// over the existing Project + File models (FND.7): no schema change. Per project
// surfaces the module, name/description, status, member breakdown (agents +
// humans from the members Json), file COUNT, and last activity. Grouped module-
// separated. Org-scoped via dbForOrg; the list paginated with the FND.11 helpers.
//
// The per-project file MATRIX (opening a project → AI-extracted columns) is MTX.2,
// a separate later story blocked on the files pipeline — this exposes the file
// COUNT only; the matrix + extraction are NOT built here.
//
// MOAT / gating: create-project / add-file / assign are agent-DRAFTED/proposed
// only. /// RBAC.4: the workspace/assignment approval state machine.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver. Do not
/// add those columns here.

const PROJECT_CAP = 500;
const NEEDS_ATTENTION = new Set<ProjectStatus>(["BLOCKED", "IN_REVIEW"]);

// moduleKey → display name (matches the module catalog / sidebar).
const MODULE_LABEL: Record<string, string> = {
  procurement: "Procurement",
  manufacturing: "Manufacturing",
  inventory: "Inventory",
  fulfillment: "Fulfillment",
  quality: "Quality",
  sales: "Sales & CRM",
  marketing: "Marketing",
  fleet: "Fleet",
  "field-service": "Field Service",
  engineering: "Engineering",
  autonomy: "Autonomy",
  finance: "Finance",
  people: "People",
  security: "Security",
  legal: "Legal",
};
const moduleLabel = (key: string) =>
  MODULE_LABEL[key] ??
  key.replace(/(^|-)([a-z])/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());

export interface ProjectRow {
  id: string;
  moduleKey: string;
  name: string;
  description: string;
  status: ProjectStatus;
  agentCount: number; // agents on the project (from members Json)
  humanMembers: string[]; // human member names
  fileCount: number; // files.length (the matrix itself is MTX.2)
  updatedAt: Date;
  needsAttention: boolean; // blocked / in-review
}
export interface ProjectGroup {
  moduleKey: string;
  module: string; // display label
  count: number;
  projects: ProjectRow[];
}
export interface ProjectsRollup {
  total: number;
  modules: number; // distinct modules with a project
  files: number; // total file count
  needsAttention: number;
  byStatus: { status: ProjectStatus; count: number }[];
}
export interface ProjectsData {
  groups: ProjectGroup[];
  rollup: ProjectsRollup;
}

const PROJECT_SELECT = {
  id: true,
  moduleKey: true,
  name: true,
  description: true,
  status: true,
  members: true,
  updatedAt: true,
  _count: { select: { files: true } },
} as const;

function parseMembers(members: unknown): {
  agentCount: number;
  humanMembers: string[];
} {
  if (!members || typeof members !== "object")
    return { agentCount: 0, humanMembers: [] };
  const m = members as { agents?: unknown; humans?: unknown };
  const agents = Array.isArray(m.agents) ? m.agents : [];
  const humans = Array.isArray(m.humans)
    ? m.humans.filter((h): h is string => typeof h === "string")
    : [];
  return { agentCount: agents.length, humanMembers: humans };
}

function shape(p: {
  id: string;
  moduleKey: string;
  name: string;
  description: string;
  status: ProjectStatus;
  members: unknown;
  updatedAt: Date;
  _count: { files: number };
}): ProjectRow {
  const { agentCount, humanMembers } = parseMembers(p.members);
  return {
    id: p.id,
    moduleKey: p.moduleKey,
    name: p.name,
    description: p.description,
    status: p.status,
    agentCount,
    humanMembers,
    fileCount: p._count.files,
    updatedAt: p.updatedAt,
    needsAttention: NEEDS_ATTENTION.has(p.status),
  };
}

/**
 * The Projects list (PROJ.1 screen): projects grouped module-separated, each with
 * its member breakdown (agents + humans), file count, status, and last activity,
 * plus a rollup. Org-scoped and read-only.
 */
export async function getProjectsData(orgId: string): Promise<ProjectsData> {
  const rows = await dbForOrg(orgId).project.findMany({
    orderBy: { updatedAt: "desc" },
    take: PROJECT_CAP,
    select: PROJECT_SELECT,
  });
  const projects = rows.map(shape);

  // Group module-separated, ordered by project count then module name.
  const byModule = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    const list = byModule.get(p.moduleKey) ?? [];
    list.push(p);
    byModule.set(p.moduleKey, list);
  }
  const groups: ProjectGroup[] = [...byModule.entries()]
    .map(([moduleKey, ps]) => ({
      moduleKey,
      module: moduleLabel(moduleKey),
      count: ps.length,
      projects: ps,
    }))
    .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));

  const byStatusMap = new Map<ProjectStatus, number>();
  for (const p of projects)
    byStatusMap.set(p.status, (byStatusMap.get(p.status) ?? 0) + 1);
  const byStatus = [...byStatusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    groups,
    rollup: {
      total: projects.length,
      modules: byModule.size,
      files: projects.reduce((n, p) => n + p.fileCount, 0),
      needsAttention: projects.filter((p) => p.needsAttention).length,
      byStatus,
    },
  };
}

/** Paginated project list (read-only), optionally filtered by module / status. */
export async function listProjects(
  orgId: string,
  opts: {
    moduleKey?: string;
    status?: string;
    cursor?: string;
    take?: number;
  } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).project.findMany({
    where: {
      ...(opts.moduleKey ? { moduleKey: opts.moduleKey } : {}),
      ...(opts.status ? { status: opts.status as ProjectStatus } : {}),
    },
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: PROJECT_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map(shape), nextCursor };
}

// ---------------------------------------------------------------------------
// FILE.1 — the file list for a project (feeds the project view + MTX.2). Org-
// scoped explicitly via `project.orgId` (File has no orgId of its own — it
// inherits tenancy through Project, so every File read must join on it).
// Read-only; `extracted`/`embedding` stay untouched (FILE.2 / MEM.1 seams).
// ---------------------------------------------------------------------------
export interface ProjectFile {
  id: string;
  name: string;
  ext: string;
  sizeBytes: number;
  type: string;
  linkedTo: string | null;
  modifiedAt: Date;
}

export async function getProjectFiles(
  orgId: string,
  projectId: string,
): Promise<ProjectFile[]> {
  return dbForOrg(orgId).file.findMany({
    where: { projectId, project: { orgId } },
    orderBy: { modifiedAt: "desc" },
    select: {
      id: true,
      name: true,
      ext: true,
      sizeBytes: true,
      type: true,
      linkedTo: true,
      modifiedAt: true,
    },
  });
}
