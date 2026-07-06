import { getCurrentUser } from "@/lib/session";
import { getOrgSettings } from "@/lib/org-settings";
import { getIntegrations, getApiKeys, getSsoConfig } from "@/lib/integrations";
import { IntegrationsView } from "@/components/settings/IntegrationsView";

// /settings/integrations (SET.5) — integrations · SSO config · API keys.
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const settings = await getOrgSettings(user.orgId);
  const [integrations, apiKeys, sso] = await Promise.all([
    getIntegrations(user.orgId),
    getApiKeys(user.orgId),
    getSsoConfig(user.orgId, settings?.slug ?? "workspace"),
  ]);
  return (
    <IntegrationsView
      integrations={integrations}
      apiKeys={apiKeys}
      sso={sso}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
