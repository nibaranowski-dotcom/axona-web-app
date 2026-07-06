import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SettingsNav } from "@/components/settings/SettingsNav";

// SET.2 — the Settings screen frame (used inside the app shell's <main>): a sticky
// 60px topbar (eyebrow + title + optional right slot) over a two-pane body (the
// reusable SettingsNav + the page content). Matches Settings - Members.dc.html.
export function SettingsShell({
  eyebrow,
  title,
  adminOnly = false,
  children,
}: {
  eyebrow: string;
  title: string;
  adminOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            {eyebrow}
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h1>
        </div>
        {adminOnly && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            Admin only
          </span>
        )}
      </header>
      <div className="flex flex-1">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
