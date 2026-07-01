import type { ReactNode } from "react";
import { dbForOrg } from "@axona/db";
import { getAxonaAgent } from "@axona/agents";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane, type PaneAgent } from "@/components/shell/AgentPane";
import { getNavModules } from "@/lib/nav";
import { getModuleAlerts } from "@/lib/module-alerts";
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
  const [axona, alerts, allAgents] = user
    ? await Promise.all([
        getAxonaAgent(user.orgId),
        getModuleAlerts(user.orgId),
        dbForOrg(user.orgId).agent.findMany({
          orderBy: [{ moduleKey: "asc" }, { code: "asc" }],
        }),
      ])
    : [null, {}, []];

  // Group the org's agents by module for the context-aware pane (picked by route
  // client-side, so navigation between modules needs no re-fetch).
  const agentsByModule: Record<string, PaneAgent[]> = {};
  for (const a of allAgents) {
    (agentsByModule[a.moduleKey] ??= []).push({
      id: a.id,
      name: a.name,
      code: a.code,
      role: a.role,
      description: a.description,
      state: a.state,
    });
  }

  return (
    <div className="grid h-dvh grid-cols-[auto_1fr_auto] bg-paper text-ink">
      <Sidebar groups={groups} alerts={alerts} />
      <main aria-label="Main content" className="min-w-0 overflow-y-auto">
        {children}
      </main>
      <AgentPane axonaAgentId={axona?.id} agentsByModule={agentsByModule} />
    </div>
  );
}
