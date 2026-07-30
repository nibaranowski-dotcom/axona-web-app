import {
  dbForOrg,
  presignedGetUrl,
  resolveEntityId,
  type EntityType,
  type OrgScopedDb,
} from "@axona/db";

// ATTACH.1 — the read model for the <Attachments> panel. It is a THIN layer over
// the EXTENDED FILE.1 `File` model: attachments are File rows carrying
// {orgId,targetType,targetId} (nullable projectId), grouped by attach point (name)
// into current + version history. Blobs go through putObject/presignedGetUrl (the
// FILE.1 storage seam); text is extracted by the FILE.2 pipeline (processFile).
// No new file model / blob store / extractor. File is NOT in TENANT_MODELS, so
// every query scopes by an explicit `orgId` (project files stay scoped via project).

export interface AttachmentVersion {
  id: string;
  version: number;
  sizeBytes: number;
  ext: string;
  /** FILE.2 extraction produced searchable text (feeds search/MTX/memory). */
  hasText: boolean;
  uploadedByLabel: string | null;
  createdAt: Date;
}

export interface AttachmentGroup {
  /** the attach point — re-uploading the same name creates a new version. */
  name: string;
  type: string;
  current: AttachmentVersion;
  versionCount: number;
  /** all versions, newest-first (current first). */
  versions: AttachmentVersion[];
}

export interface RecordAttachments {
  targetType: string | null;
  /** the resolved record cuid the files attach to; null ⇒ upload disabled. */
  targetId: string | null;
  groups: AttachmentGroup[];
}

// A detail-view entity → its attachment targetType string (audit-style, matching
// HIST.1's convention so a record's history + attachments share one target key).
const ATTACH_TARGET_BY_ENTITY: Partial<Record<EntityType, string>> = {
  UNIT: "Unit",
  NCR: "NCR",
  ECO: "ECO",
  CONFIG_VERSION: "ConfigurationVersion",
  TEST_RUN: "TestRun",
};

export function attachTargetFor(entity: EntityType): string | null {
  return ATTACH_TARGET_BY_ENTITY[entity] ?? null;
}

/** Attachments at (targetType,targetId), grouped by attach point → current + history. */
export async function getRecordAttachments(
  orgId: string,
  targetType: string,
  targetId: string,
): Promise<AttachmentGroup[]> {
  const db = dbForOrg(orgId);
  const rows = await db.file.findMany({
    where: { orgId, targetType, targetId, deletedAt: null },
    orderBy: [{ name: "asc" }, { version: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      version: true,
      sizeBytes: true,
      ext: true,
      text: true,
      uploadedByLabel: true,
      createdAt: true,
    },
  });

  const toV = (r: (typeof rows)[number]): AttachmentVersion => ({
    id: r.id,
    version: r.version,
    sizeBytes: r.sizeBytes,
    ext: r.ext,
    hasText: !!(r.text && r.text.length > 0),
    uploadedByLabel: r.uploadedByLabel,
    createdAt: r.createdAt,
  });

  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byName.get(r.name) ?? [];
    arr.push(r);
    byName.set(r.name, arr);
  }
  return [...byName.entries()]
    .map(([name, versions]) => {
      const current = versions[0]!; // version desc → the highest is current
      return {
        name,
        type: current.type,
        current: toV(current),
        versionCount: versions.length,
        versions: versions.map(toV),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Page-facing convenience (mirrors recordHistoryFor / getConnectedObjects):
 * resolve a record's human code → the cuid (REUSING resolveEntityId — one natural-
 * key resolver), map the entity → its attach targetType, and read its attachments.
 */
export async function attachmentsFor(
  orgId: string,
  entity: EntityType,
  code: string,
): Promise<RecordAttachments> {
  const targetType = attachTargetFor(entity);
  if (!targetType) return { targetType: null, targetId: null, groups: [] };
  const db = dbForOrg(orgId);
  const targetId = await resolveEntityId(db, entity, code);
  if (!targetId) return { targetType, targetId: null, groups: [] };
  const groups = await getRecordAttachments(orgId, targetType, targetId);
  return { targetType, targetId, groups };
}

/**
 * Download URL for one file — the FILE.1 `presignedGetUrl` seam (org-scoped, for
 * both an entity attachment (File.orgId) and a legacy project file (project.orgId)).
 * Returns null when the file isn't in this org.
 */
export async function attachmentDownloadUrl(
  orgId: string,
  id: string,
): Promise<string | null> {
  const db = dbForOrg(orgId);
  const file = await db.file.findFirst({
    where: { id, OR: [{ orgId }, { project: { orgId } }] },
    select: { blobKey: true },
  });
  if (!file) return null;
  return presignedGetUrl(file.blobKey);
}

/**
 * The next version at an attach point + the current head it supersedes. Prior
 * versions are RETAINED — a re-upload never overwrites, it adds version N+1.
 */
export async function nextAttachmentVersion(
  db: OrgScopedDb,
  a: { orgId: string; targetType: string; targetId: string; name: string },
): Promise<{ version: number; supersedesId: string | null }> {
  const prior = await db.file.findFirst({
    where: {
      orgId: a.orgId,
      targetType: a.targetType,
      targetId: a.targetId,
      name: a.name,
      deletedAt: null,
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });
  return {
    version: (prior?.version ?? 0) + 1,
    supersedesId: prior?.id ?? null,
  };
}
