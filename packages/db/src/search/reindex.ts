import type { SearchType } from "@prisma/client";
import { prisma } from "../client";

// Rebuild the SearchDoc index from source objects. Idempotent (upsert by
// type+refId). Full mode (no orgId) also reindexes globals (Modules) and prunes
// orphans. Uses the bare prisma client — this is a system/seed task, and it
// writes both global (orgId NULL) and per-tenant rows explicitly.
//
// Indexed set (build-spec §4.2): Modules (global), Agents, Workflows, Projects,
// Files, Chats — plus, since DEMO.7 §3, the operational entity classes (Units, Parts
// and lots, Purchase Orders, Work Orders, NCRs, ECOs). Those were the "phase-2
// extension" the comment used to promise; leaving them out meant the Axona agent
// could not find a PO or a lot through its search tool at all.

export interface DocInput {
  orgId: string | null;
  type: SearchType;
  refId: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  url: string;
}

export async function upsertDoc(d: DocInput): Promise<void> {
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

/**
 * Repair the FTS objects the SearchDoc index depends on, idempotently — the
 * generated `tsv` column + its GIN index (the add_searchdoc_fts migration).
 * `prisma db push` (used for the dev DB, which has no migration history) drops
 * raw-SQL objects that schema.prisma doesn't model, so a push can silently
 * remove `tsv` and make `/api/search` 500 on every query. Running this before a
 * full reindex makes the index self-heal. No-op when the objects already exist
 * (IF NOT EXISTS). Fresh/prod DBs get these from the migration; this is the
 * belt-and-suspenders for the push-managed dev DB. (SRCH.4)
 */
export async function ensureSearchIndexSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SearchDoc" ADD COLUMN IF NOT EXISTS "tsv" tsvector ` +
      `GENERATED ALWAYS AS (` +
      `setweight(to_tsvector('english', coalesce("title", '')), 'A') || ` +
      `setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') || ` +
      `setweight(to_tsvector('english', coalesce("body", '')), 'C')` +
      `) STORED`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "searchdoc_tsv_gin" ON "SearchDoc" USING gin ("tsv")`,
  );
}

export async function reindex(orgId?: string): Promise<void> {
  const where = orgId ? { orgId } : {};

  // Self-heal the FTS objects before a full rebuild so search never 500s on a
  // missing `tsv` (e.g. after a `db push` dropped it). Full reindex only.
  if (!orgId) await ensureSearchIndexSchema();

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
    // ATTACH.1 — a project file resolves its org via project.orgId; an entity
    // attachment (nullable projectId) carries File.orgId directly.
    let org: string | null;
    if (f.projectId) {
      org = projectOrg.get(f.projectId) ?? null;
      if (org === null && !projectOrg.has(f.projectId)) {
        const proj = await prisma.project.findUnique({
          where: { id: f.projectId },
          select: { orgId: true },
        });
        org = proj?.orgId ?? null;
      }
    } else {
      org = f.orgId ?? null;
    }
    if (!org) continue; // unscopable file → skip (never index cross-org)
    await upsertDoc({
      orgId: org,
      type: "FILE",
      refId: f.id,
      title: f.name,
      subtitle: f.type,
      body: f.linkedTo,
      url: f.projectId ? `/projects/${f.projectId}` : "",
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

  // ── DEMO.7 §3 — the OPERATIONAL entity classes ────────────────────────────
  // Previously unindexed ("phase-2"), which meant the Axona agent's search tool
  // could not find a purchase order, a lot or a unit at all — it answered "no record
  // exists" about seeded data. Indexed by HUMAN CODE (the thing a person says out
  // loud) with the code repeated into `body`, so both an exact code and a bare
  // fragment of one reach the right row through FTS.
  const units = await prisma.unit.findMany({
    where,
    select: { id: true, orgId: true, serial: true, status: true },
  });
  for (const u of units)
    await upsertDoc({
      orgId: u.orgId,
      type: "UNIT",
      refId: u.id,
      title: u.serial,
      subtitle: `unit · ${u.status}`,
      body: u.serial,
      url: `/units/${encodeURIComponent(u.serial)}`,
    });

  // Parts AND lots: a lot is a Part row whose sku carries the LOT- prefix. The body
  // holds the bare numeric too, so "88471" finds LOT-88471 without special-casing
  // any particular lot.
  const parts = await prisma.part.findMany({
    where,
    select: { id: true, orgId: true, sku: true, name: true },
  });
  for (const p of parts)
    await upsertDoc({
      orgId: p.orgId,
      type: "PART",
      refId: p.id,
      title: p.sku,
      subtitle: p.name,
      body: [p.sku, p.sku.replace(/^LOT-/i, ""), p.name].join(" "),
      url: `/inventory?focus=${encodeURIComponent(p.sku)}`,
    });

  const pos = await prisma.purchaseOrder.findMany({
    where,
    select: { id: true, orgId: true, code: true, status: true },
  });
  for (const po of pos)
    await upsertDoc({
      orgId: po.orgId,
      type: "PURCHASE_ORDER",
      refId: po.id,
      title: po.code,
      subtitle: `purchase order · ${po.status}`,
      body: po.code,
      url: `/procurement?focus=${encodeURIComponent(po.code)}`,
    });

  const wos = await prisma.workOrderField.findMany({
    where,
    select: { id: true, orgId: true, code: true, issue: true, status: true },
  });
  for (const w of wos)
    await upsertDoc({
      orgId: w.orgId,
      type: "WORK_ORDER",
      refId: w.id,
      title: w.code,
      subtitle: `work order · ${w.status}`,
      body: [w.code, w.issue].join(" "),
      url: `/field-service?focus=${encodeURIComponent(w.code)}`,
    });

  const ncrs = await prisma.nCR.findMany({
    where,
    select: { id: true, orgId: true, code: true, defect: true },
  });
  for (const n of ncrs)
    await upsertDoc({
      orgId: n.orgId,
      type: "NCR",
      refId: n.id,
      title: n.code,
      subtitle: "non-conformance",
      body: [n.code, n.defect].join(" "),
      url: `/rca/${encodeURIComponent(n.code)}`,
    });

  const ecos = await prisma.eCO.findMany({
    where,
    select: { id: true, orgId: true, code: true, title: true },
  });
  for (const e of ecos)
    await upsertDoc({
      orgId: e.orgId,
      type: "ECO",
      refId: e.id,
      title: e.code,
      subtitle: "change order",
      body: [e.code, e.title].join(" "),
      url: `/changes/${encodeURIComponent(e.code)}`,
    });

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
