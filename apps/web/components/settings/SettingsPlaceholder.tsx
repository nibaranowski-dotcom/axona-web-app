import { SettingsShell } from "@/components/settings/SettingsShell";

// SET.2 — a "coming soon" placeholder for the settings sub-routes not yet built
// (SET.1 Organization · SET.3 Your profile · SET.4 Notifications · SET.5
// Integrations · Billing). Keeps the sub-nav navigable without a 404/500.
export function SettingsPlaceholder({
  title,
  story,
}: {
  title: string;
  story: string;
}) {
  return (
    <SettingsShell eyebrow="Settings" title={title}>
      <div className="mx-auto flex max-w-[940px] flex-1 items-center justify-center py-20">
        <div className="max-w-[360px] text-center">
          <h2 className="text-[15px] font-semibold text-ink">Coming soon</h2>
          <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
            {title} settings land in {story}. Members administration is
            available now under the Members tab.
          </p>
        </div>
      </div>
    </SettingsShell>
  );
}
