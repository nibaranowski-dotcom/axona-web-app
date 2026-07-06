import { createHash, randomBytes } from "node:crypto";
import type { OrgScopedDb } from "../../src";

// SET.5 — seed integration statuses + one (revocable) API key + a default SSO row
// for the demo org. Stubbed connectors; the API key hash is real (plaintext discarded).
export async function seedIntegrations(
  db: OrgScopedDb,
  orgId: string,
  adminId: string,
): Promise<void> {
  await db.integration.deleteMany({ where: { orgId } });
  await db.apiKey.deleteMany({ where: { orgId } });
  await db.ssoConfig.deleteMany({ where: { orgId } });

  const statuses: {
    kind: "ERP" | "PLM" | "MES" | "SLACK" | "EMAIL" | "TELEMETRY";
    status: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
    connected?: boolean;
  }[] = [
    { kind: "ERP", status: "CONNECTED", connected: true },
    { kind: "PLM", status: "CONNECTED", connected: true },
    { kind: "MES", status: "ERROR" },
    { kind: "TELEMETRY", status: "CONNECTED", connected: true },
    { kind: "SLACK", status: "NOT_CONNECTED" },
    { kind: "EMAIL", status: "NOT_CONNECTED" },
  ];
  for (const s of statuses) {
    await db.integration.create({
      data: {
        kind: s.kind,
        status: s.status,
        connectedAt: s.connected ? new Date() : null,
      },
    });
  }

  // one seeded API key (hash only — plaintext is discarded, never stored)
  const raw = randomBytes(24).toString("hex");
  const plaintext = `ax_live_${raw}`;
  await db.apiKey.create({
    data: {
      name: "Production ingest",
      prefix: `ax_live_${raw.slice(0, 4)}`,
      keyHash: createHash("sha256").update(plaintext).digest("hex"),
      createdById: adminId,
      lastUsedAt: new Date(Date.now() - 3 * 3600_000),
    },
  });

  await db.ssoConfig.create({ data: { orgId, enforce: false } });
}
