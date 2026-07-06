import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

// /settings/organization (SET.2 sub-nav seam) — placeholder until SET.1.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsPlaceholder title="Organization" story="SET.1" />;
}
