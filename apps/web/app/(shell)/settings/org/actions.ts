"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbForOrg, buildOrgExport, type Role } from "@axona/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { normalizeEnabledModules } from "@/lib/org-settings";
import { VERTICALS } from "@/lib/provisioning";

// SET.1 — organization-settings actions. EVERY action: requireRole(["ADMIN"]) line
// 1, mutates via dbForOrg(user.orgId) (org isolation), and writes an AUDIT.1 entry.
// Guards: the module set always keeps the always-on Core on (keep-app-usable). The
// slug is display-only here (changing it breaks the workspace URL — deferred).

const ROLES: [Role, ...Role[]] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
];

export interface OrgActionResult {
  ok: boolean;
  message?: string;
}

function actor(user: { id: string; name: string; email: string }) {
  return { id: user.id, label: user.name || user.email };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter an organization name.").max(120),
  industry: z.enum(VERTICALS).nullable().optional(),
});

// updateOrgProfile — name + industry. (Logo upload UI is deferred; the logoKey
// column exists for the follow-up.) Audit org.profile_change.
export async function updateOrgProfile(input: {
  name: string;
  industry?: string | null;
}): Promise<OrgActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid profile.",
    };
  }
  const db = dbForOrg(user!.orgId);
  await db.org.updateMany({
    where: { id: user!.orgId },
    data: { name: parsed.data.name, industry: parsed.data.industry ?? null },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "org.profile_change",
    target: { type: "Org", id: user!.orgId },
    summary: `Updated org profile (${parsed.data.name})`,
    output: { name: parsed.data.name, industry: parsed.data.industry ?? null },
    approver: actor(user!),
  });
  revalidatePath("/settings/org");
  return { ok: true };
}

const defaultsSchema = z.object({
  timezone: z.string().trim().min(1).max(64).nullable().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  defaultMemberRole: z.enum(ROLES).nullable().optional(),
});

// updateOrgDefaults — timezone / fiscal start / default member role. Audit
// org.defaults_change. defaultMemberRole prefills new invites (SET.2/AUTH.5).
export async function updateOrgDefaults(input: {
  timezone?: string | null;
  fiscalYearStartMonth?: number | null;
  defaultMemberRole?: string | null;
}): Promise<OrgActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const parsed = defaultsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid defaults.",
    };
  }
  const db = dbForOrg(user!.orgId);
  await db.org.updateMany({
    where: { id: user!.orgId },
    data: {
      timezone: parsed.data.timezone ?? null,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth ?? null,
      defaultMemberRole: parsed.data.defaultMemberRole ?? null,
    },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "org.defaults_change",
    target: { type: "Org", id: user!.orgId },
    summary: `Updated org defaults`,
    output: {
      timezone: parsed.data.timezone ?? null,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth ?? null,
      defaultMemberRole: parsed.data.defaultMemberRole ?? null,
    },
    approver: actor(user!),
  });
  revalidatePath("/settings/org");
  return { ok: true };
}

// setEnabledModules — write Org.enabledModules (the sidebar nav reflects it). The
// always-on Core is always kept (keep-app-usable guard). Audit org.modules_change.
export async function setEnabledModules(
  keys: string[],
): Promise<OrgActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const enabledModules = normalizeEnabledModules(keys);
  const db = dbForOrg(user!.orgId);
  await db.org.updateMany({
    where: { id: user!.orgId },
    data: { enabledModules },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "org.modules_change",
    target: { type: "Org", id: user!.orgId },
    summary: `Updated enabled modules (${enabledModules.length} on)`,
    output: { enabledModules },
    approver: actor(user!),
  });
  revalidatePath("/settings/org");
  revalidatePath("/", "layout"); // the sidebar nav (shell layout) reflects enablement
  return { ok: true };
}

// PRIV.1a — export ALL of this org's data (portability half of data-subject
// rights, PRD-PRIV.1 §1). ADMIN-only, audited, and org-scoped by construction:
// the bundle is built through `dbForOrg(user.orgId)`, so every source reads the
// caller's tenant and no orgId is passed around to get wrong. No parallel
// exporter — buildOrgExport drives IO.2's exportEntity over the org's entity set.
export interface OrgExportResult extends OrgActionResult {
  /** The bundle as a JSON string, ready for the browser to save. */
  bundle?: string;
  filename?: string;
  totalRows?: number;
  entities?: { entity: string; label: string; count: number }[];
}

export async function exportOrgData(): Promise<OrgExportResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const db = dbForOrg(user!.orgId);
  const bundle = await buildOrgExport(db);
  // Audited BEFORE it leaves the building: an export of everything is a
  // security-relevant event, and the record of who took it is the point.
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "org.data_export",
    target: { type: "Org", id: user!.orgId },
    summary: `Exported all org data (${bundle.entities.length} entities · ${bundle.totalRows} rows)`,
    output: {
      entities: bundle.entities.map((e) => ({
        entity: e.entity,
        count: e.count,
      })),
      totalRows: bundle.totalRows,
      generatedAt: bundle.generatedAt,
    },
    approver: actor(user!),
  });
  return {
    ok: true,
    bundle: JSON.stringify(bundle, null, 2),
    filename: `axona-export-${user!.orgId}-${bundle.generatedAt.slice(0, 10)}.json`,
    totalRows: bundle.totalRows,
    entities: bundle.entities.map((e) => ({
      entity: e.entity,
      label: e.label,
      count: e.count,
    })),
  };
}
