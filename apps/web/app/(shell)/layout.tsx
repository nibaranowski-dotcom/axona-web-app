import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane } from "@/components/shell/AgentPane";
import { getNavModules } from "@/lib/nav";

// The app shell — left sidebar, content <main>, right agent pane. Every screen
// from MC.1 onward renders into <main>. Nav reads the 22 seeded modules.
export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const groups = await getNavModules();
  return (
    <div className="grid h-dvh grid-cols-[auto_1fr_auto] bg-paper text-ink">
      <Sidebar groups={groups} />
      <main className="min-w-0 overflow-y-auto">{children}</main>
      <AgentPane />
    </div>
  );
}
