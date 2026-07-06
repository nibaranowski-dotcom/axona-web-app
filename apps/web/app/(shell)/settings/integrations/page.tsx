import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

// /settings/integrations (SET.2 sub-nav seam) — placeholder until SET.5.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsPlaceholder title="Integrations" story="SET.5" />;
}
