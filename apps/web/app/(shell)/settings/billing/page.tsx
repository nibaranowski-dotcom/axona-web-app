import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

// /settings/billing (SET.2 sub-nav seam) — placeholder until a later billing story.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsPlaceholder title="Billing" story="a later billing story" />;
}
