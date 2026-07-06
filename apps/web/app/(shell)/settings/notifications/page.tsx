import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

// /settings/notifications (SET.2 sub-nav seam) — placeholder until SET.4.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsPlaceholder title="Notifications" story="SET.4" />;
}
