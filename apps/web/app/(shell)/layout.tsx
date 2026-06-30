import type { ReactNode } from "react";
import { getAxonaAgent } from "@axona/agents";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane } from "@/components/shell/AgentPane";
import { getNavModules } from "@/lib/nav";
import { getCurrentUser } from "@/lib/session";

// The app shell — left sidebar, content <main>, right agent pane. Every screen
// from MC.1 onward renders into <main>. Nav reads the 22 seeded modules. The
// pane chats the general Axona agent (GA.1), resolved org-scoped here.
export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [groups, user] = await Promise.all([getNavModules(), getCurrentUser()]);
  const axona = user ? await getAxonaAgent(user.orgId) : null;
  return (
    <div className="grid h-dvh grid-cols-[auto_1fr_auto] bg-paper text-ink">
      <Sidebar groups={groups} />
      <main aria-label="Main content" className="min-w-0 overflow-y-auto">
        {children}
      </main>
      <AgentPane axonaAgentId={axona?.id} />
    </div>
  );
}
