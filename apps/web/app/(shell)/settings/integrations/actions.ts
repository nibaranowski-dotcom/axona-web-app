"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  dbForOrg,
  prisma,
  type IntegrationKind,
  type IntegrationStatus,
} from "@axona/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { generateApiKey } from "@/lib/integrations";

// SET.5 — integrations / SSO / API-key actions. ADMIN-gated + org-scoped + audited.
// Connect flows are stubbed (CONN.1); SSO is config-only (AUTH.2). API keys are
// hashed at rest — createApiKey returns the plaintext ONCE, then it's gone forever.

const KINDS: IntegrationKind[] = [
  "ERP",
  "PLM",
  "MES",
  "SLACK",
  "EMAIL",
  "TELEMETRY",
];
const STATUSES: IntegrationStatus[] = ["NOT_CONNECTED", "CONNECTED", "ERROR"];

export interface IntegrationsActionResult {
  ok: boolean;
  message?: string;
  plaintextKey?: string; // createApiKey only — shown ONCE
}

function actor(user: { id: string; name: string; email: string }) {
  return { id: user.id, label: user.name || user.email };
}

// integration connect/disconnect — STUBBED (no real ingest). Sets status + audits.
export async function setIntegrationStatus(
  kind: string,
  status: string,
): Promise<IntegrationsActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  if (
    !KINDS.includes(kind as IntegrationKind) ||
    !STATUSES.includes(status as IntegrationStatus)
  ) {
    return { ok: false, message: "Unknown integration." };
  }
  const db = dbForOrg(user!.orgId);
  const connected = status === "CONNECTED";
  await db.integration.upsert({
    where: {
      orgId_kind: { orgId: user!.orgId, kind: kind as IntegrationKind },
    },
    update: {
      status: status as IntegrationStatus,
      connectedAt: connected ? new Date() : null,
    },
    create: {
      orgId: user!.orgId,
      kind: kind as IntegrationKind,
      status: status as IntegrationStatus,
      connectedAt: connected ? new Date() : null,
    },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "integration.status_change",
    target: { type: "Integration", id: kind },
    summary: `${kind} integration → ${status} (stubbed — no live ingest)`,
    output: { kind, status, live: false },
    approver: actor(user!),
  });
  revalidatePath("/settings/integrations");
  return { ok: true };
}

// createApiKey — generate + hash; return the plaintext ONCE. Audit apikey.create.
const nameSchema = z.string().trim().min(1, "Name the key.").max(80);
export async function createApiKey(
  name: string,
): Promise<IntegrationsActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message };
  const { plaintext, prefix, keyHash } = generateApiKey();
  const db = dbForOrg(user!.orgId);
  await db.apiKey.create({
    data: {
      orgId: user!.orgId,
      name: parsed.data,
      prefix,
      keyHash,
      createdById: user!.id,
    },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "apikey.create",
    target: { type: "ApiKey", id: prefix },
    summary: `Created API key “${parsed.data}” (${prefix})`,
    output: { name: parsed.data, prefix }, // NEVER the plaintext or hash
    approver: actor(user!),
  });
  revalidatePath("/settings/integrations");
  return { ok: true, plaintextKey: plaintext }; // shown once — never stored
}

// revokeApiKey — set revokedAt. Audit apikey.revoke.
export async function revokeApiKey(
  id: string,
): Promise<IntegrationsActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const db = dbForOrg(user!.orgId);
  const key = await db.apiKey.findFirst({ where: { id } }); // org-scoped
  if (!key) return { ok: false, message: "Key not found." };
  await db.apiKey.updateMany({
    where: { id },
    data: { revokedAt: new Date() },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "apikey.revoke",
    target: { type: "ApiKey", id: key.prefix },
    summary: `Revoked API key “${key.name}”`,
    approver: actor(user!),
  });
  revalidatePath("/settings/integrations");
  return { ok: true };
}

// updateSsoConfig — config-only (no live auth = AUTH.2). Audit sso.config_change.
const ssoSchema = z.object({
  provider: z.string().trim().max(80).nullable().optional(),
  idpMetadata: z.string().trim().max(20_000).nullable().optional(),
  enforce: z.boolean(),
});
export async function updateSsoConfig(input: {
  provider?: string | null;
  idpMetadata?: string | null;
  enforce: boolean;
}): Promise<IntegrationsActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const parsed = ssoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid SSO config." };
  // SsoConfig is orgId-unique (not a tenant model) — write with explicit orgId.
  await prisma.ssoConfig.upsert({
    where: { orgId: user!.orgId },
    update: {
      provider: parsed.data.provider ?? null,
      idpMetadata: parsed.data.idpMetadata
        ? { xml: parsed.data.idpMetadata }
        : undefined,
      enforce: parsed.data.enforce,
    },
    create: {
      orgId: user!.orgId,
      provider: parsed.data.provider ?? null,
      idpMetadata: parsed.data.idpMetadata
        ? { xml: parsed.data.idpMetadata }
        : undefined,
      enforce: parsed.data.enforce,
    },
  });
  const db = dbForOrg(user!.orgId);
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "sso.config_change",
    target: { type: "SsoConfig", id: user!.orgId },
    summary: `Updated SSO config (enforce: ${parsed.data.enforce}) — config-only, live auth in AUTH.2`,
    output: {
      provider: parsed.data.provider ?? null,
      enforce: parsed.data.enforce,
    },
    approver: actor(user!),
  });
  revalidatePath("/settings/integrations");
  return { ok: true };
}
