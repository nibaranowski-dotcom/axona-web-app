import { randomBytes, createHash } from "node:crypto";
import {
  prisma,
  type IntegrationKind,
  type IntegrationStatus,
} from "@axona/db";

// SET.5 — integrations / SSO / API keys read model + key helpers (server-only).
// Connect flows are stubbed (CONN.1); SSO is config-only (AUTH.2). API keys are
// HASHED at rest — the plaintext is generated + shown ONCE and never stored/logged.

export const INTEGRATION_CATALOG: {
  kind: IntegrationKind;
  name: string;
  description: string;
  category: string;
}[] = [
  {
    kind: "ERP",
    name: "ERP",
    description: "SAP · NetSuite · Dynamics — POs, GL, inventory.",
    category: "Ingest",
  },
  {
    kind: "PLM",
    name: "PLM",
    description: "Windchill · Teamcenter — BOMs, ECOs, CAD.",
    category: "Ingest",
  },
  {
    kind: "MES",
    name: "MES",
    description: "Shop-floor execution — work orders, genealogy.",
    category: "Ingest",
  },
  {
    kind: "TELEMETRY",
    name: "Telemetry",
    description: "Fleet + plant signals — a first-class typed input.",
    category: "Ingest",
  },
  {
    kind: "SLACK",
    name: "Slack",
    description: "Route approvals + exceptions to a channel.",
    category: "Notify",
  },
  {
    kind: "EMAIL",
    name: "Email",
    description: "Outbound notification delivery (EMAIL.1).",
    category: "Notify",
  },
];

export interface IntegrationRow {
  kind: IntegrationKind;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  connectedAt: Date | null;
}

export async function getIntegrations(
  orgId: string,
): Promise<IntegrationRow[]> {
  const rows = await prisma.integration.findMany({ where: { orgId } });
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return INTEGRATION_CATALOG.map((c) => {
    const r = byKind.get(c.kind);
    return {
      ...c,
      status: r?.status ?? "NOT_CONNECTED",
      connectedAt: r?.connectedAt ?? null,
    };
  });
}

export interface ApiKeyRow {
  id: string;
  name: string;
  masked: string; // ax_live_••••7f3c
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export async function getApiKeys(orgId: string): Promise<ApiKeyRow[]> {
  const rows = await prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    masked: maskPrefix(r.prefix),
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
  }));
}

export interface SsoConfigView {
  provider: string | null;
  idpMetadata: string | null; // stored as text for the form
  enforce: boolean;
  acsUrl: string; // display-only
}

export async function getSsoConfig(
  orgId: string,
  slug: string,
): Promise<SsoConfigView> {
  const row = await prisma.ssoConfig.findUnique({ where: { orgId } });
  const meta = row?.idpMetadata as { xml?: string } | null;
  return {
    provider: row?.provider ?? null,
    idpMetadata: meta?.xml ?? null,
    enforce: row?.enforce ?? false,
    acsUrl: `${(process.env.APP_URL ?? "http://localhost:3001").replace(/\/+$/, "")}/api/auth/saml/${slug}/acs`,
  };
}

// ── API key generation ───────────────────────────────────────────────────────
// A key is `ax_live_<32 hex>`. We store its sha256 hash + a 4-char display prefix.
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  keyHash: string;
} {
  const raw = randomBytes(24).toString("hex"); // 48 hex chars
  const plaintext = `ax_live_${raw}`;
  const prefix = `ax_live_${raw.slice(0, 4)}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, keyHash };
}

function maskPrefix(prefix: string): string {
  // ax_live_7f3c → ax_live_••••7f3c
  const tail = prefix.replace(/^ax_live_/, "");
  return `ax_live_••••${tail}`;
}
