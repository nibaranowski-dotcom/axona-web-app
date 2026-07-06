import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

// /settings/profile (SET.2 sub-nav seam) — placeholder until SET.3.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsPlaceholder title="Your profile" story="SET.3" />;
}
