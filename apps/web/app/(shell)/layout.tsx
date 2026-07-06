import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dbForOrg } from "@axona/db";
import { getAxonaAgent } from "@axona/agents";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane, type PaneAgent } from "@/components/shell/AgentPane";
import { getNavModules } from "@/lib/nav";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getCurrentUser } from "@/lib/session";
import { getOrgOnboarding, isModuleEnabled } from "@/lib/onboarding";

// The app shell — left sidebar, content <main>, right agent pane. Every screen
// from MC.1 onward renders into <main>.
//
// AUTH.3/6: a not-yet-onboarded org's ADMIN is routed to /onboarding (server-side).
// The nav is filtered to the org's enabled modules (null/empty ⇒ all); a direct hit
// to a DISABLED module's route renders a graceful "not enabled" state (no 500) —
// gated here via the middleware-injected x-pathname header.
export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  // Resolve onboarding + enablement once. AUTH.3: fresh ADMIN → the wizard.
  const onboarding = user ? await getOrgOnboarding(user.orgId) : null;
  if (user && user.role === "ADMIN" && onboarding && !onboarding.onboardedAt) {
    redirect("/onboarding");
  }
  const enabledModules = onboarding?.enabledModules ?? null;

  // The current top-level module segment (from middleware's x-pathname header).
  const pathname = headers().get("x-pathname") ?? "";
  const seg = pathname.split("/").filter(Boolean)[0] ?? "core";
  const routeDisabled =
    !!user && !isModuleEnabled(enabledModules, seg === "" ? "core" : seg);

  const [groups, ...rest] = await Promise.all([
    getNavModules(enabledModules),
    user ? getAxonaAgent(user.orgId) : Promise.resolve(null),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
    user
      ? dbForOrg(user.orgId).agent.findMany({
          orderBy: [{ moduleKey: "asc" }, { code: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const [axona, alerts, allAgents] = rest as [
    Awaited<ReturnType<typeof getAxonaAgent>> | null,
    Record<string, number>,
    Awaited<ReturnType<ReturnType<typeof dbForOrg>["agent"]["findMany"]>>,
  ];

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
      <Sidebar
        groups={groups}
        alerts={alerts}
        user={user ? { name: user.name, role: user.role } : null}
      />
      <main aria-label="Main content" className="min-w-0 overflow-y-auto">
        {routeDisabled ? <ModuleNotEnabled /> : children}
      </main>
      <AgentPane axonaAgentId={axona?.id} agentsByModule={agentsByModule} />
    </div>
  );
}

// AUTH.6 — the graceful state for a disabled module's route (never a 500). The
// module exists but this org hasn't enabled it; enablement lives in settings (SET.1).
function ModuleNotEnabled() {
  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center border-b border-line bg-paper px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
          Module not enabled
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-[380px] text-center">
          <h1 className="text-[17px] font-semibold text-ink">
            This module isn’t enabled for your workspace.
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
            An admin can turn it on from workspace settings. Meanwhile, head
            back to the Command Center.
          </p>
          <Link
            href="/core"
            className="mt-5 inline-flex items-center rounded-btn border border-line-strong bg-paper px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Go to Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}
