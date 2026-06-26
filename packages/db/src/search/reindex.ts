import type { SearchType } from "@prisma/client";
import { prisma } from "../client";

// Rebuild the SearchDoc index from source objects. Idempotent (upsert by
// type+refId). Full mode (no orgId) also reindexes globals (Modules) and prunes
// orphans. Uses the bare prisma client — this is a system/seed task, and it
// writes both global (orgId NULL) and per-tenant rows explicitly.
//
// Indexed set (build-spec §4.2): Modules (global), Agents, Workflows, Projects,
// Files, Chats. Value-chain/robotics entities are a documented phase-2 extension.

interface DocInput {
  orgId: string | null;
  type: SearchType;
  refId: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  url: string;
}

async function upsertDoc(d: DocInput): Promise<void> {
  await prisma.searchDoc.upsert({
    where: { type_refId: { type: d.type, refId: d.refId } },
    create: d,
    update: {
      orgId: d.orgId,
      title: d.title,
      subtitle: d.subtitle,
      body: d.body,
      url: d.url,
    },
  });
}

/** Delete SearchDoc rows of a type whose refId is no longer a live source row. */
async function prune(type: SearchType, liveRefIds: string[]): Promise<void> {
  await prisma.searchDoc.deleteMany({
    where: {
      type,
      refId: { notIn: liveRefIds.length ? liveRefIds : ["__none__"] },
    },
  });
}

export async function reindex(orgId?: string): Promise<void> {
  const where = orgId ? { orgId } : {};

  // GLOBAL: modules (orgId NULL) — only on a full reindex
  if (!orgId) {
    const modules = await prisma.module.findMany();
    for (const m of modules) {
      await upsertDoc({
        orgId: null,
        type: "MODULE",
        refId: m.key,
        title: m.name,
        subtitle: m.group,
        body: null,
        url: `/${m.key}`,
      });
    }
    await prune(
      "MODULE",
      modules.map((m) => m.key),
    );
  }

  const agents = await prisma.agent.findMany({ where });
  for (const a of agents) {
    await upsertDoc({
      orgId: a.orgId,
      type: "AGENT",
      refId: a.id,
      title: a.name,
      subtitle: `${a.role} · ${a.moduleKey}`,
      body: a.description,
      url: `/agents#${a.code}`,
    });
  }

  const projects = await prisma.project.findMany({ where });
  const projectOrg = new Map(projects.map((p) => [p.id, p.orgId]));
  for (const p of projects) {
    await upsertDoc({
      orgId: p.orgId,
      type: "PROJECT",
      refId: p.id,
      title: p.name,
      subtitle: p.moduleKey,
      body: p.description,
      url: `/projects/${p.id}`,
    });
  }

  const workflows = await prisma.workflow.findMany({ where });
  for (const w of workflows) {
    await upsertDoc({
      orgId: w.orgId,
      type: "WORKFLOW",
      refId: w.id,
      title: w.name,
      subtitle: w.moduleKey,
      body: w.description,
      url: `/workflows/${w.id}`,
    });
  }

  // Files inherit org via their project (resolve from the cached map; fall back
  // to a lookup for files outside the current scope).
  const files = await prisma.file.findMany({
    where: orgId ? { project: { orgId } } : {},
  });
  for (const f of files) {
    let org = projectOrg.get(f.projectId) ?? null;
    if (org === null && !projectOrg.has(f.projectId)) {
      const proj = await prisma.project.findUnique({
        where: { id: f.projectId },
        select: { orgId: true },
      });
      org = proj?.orgId ?? null;
    }
    await upsertDoc({
      orgId: org,
      type: "FILE",
      refId: f.id,
      title: f.name,
      subtitle: f.type,
      body: f.linkedTo,
      url: `/projects/${f.projectId}`,
    });
  }

  const chats = await prisma.chat.findMany({ where });
  for (const c of chats) {
    await upsertDoc({
      orgId: c.orgId,
      type: "CHAT",
      refId: c.id,
      title: c.scope,
      subtitle: "chat",
      body: null,
      url: `/agents`,
    });
  }

  // Prune orphans for the tenant-owned types on a full reindex.
  if (!orgId) {
    await prune(
      "AGENT",
      agents.map((a) => a.id),
    );
    await prune(
      "PROJECT",
      projects.map((p) => p.id),
    );
    await prune(
      "WORKFLOW",
      workflows.map((w) => w.id),
    );
    await prune(
      "FILE",
      files.map((f) => f.id),
    );
    await prune(
      "CHAT",
      chats.map((c) => c.id),
    );
  }
}
