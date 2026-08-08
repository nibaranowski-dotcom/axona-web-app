import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dbForOrg, presignedGetUrl, s3Configured } from "@axona/db";
import { getAxonaAgent } from "@axona/agents";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane, type PaneAgent } from "@/components/shell/AgentPane";
import { CommandPaletteMount } from "@/components/search/CommandPaletteMount";
import { getNavModules } from "@/lib/nav";
import { owningModuleFor } from "@/lib/plm-routes";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getCurrentUser } from "@/lib/session";
import { getOrgOnboarding, isModuleEnabled } from "@/lib/onboarding";
import { getUnreadCount } from "@/lib/notifications";
import { getUiPrefs } from "@/lib/ui-prefs";

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
  // Non-module infra routes (settings, governance, launcher, search) are never
  // gated by module enablement — only actual module screens are (AUTH.6/SET.2).
  const NON_MODULE_ROUTES = new Set([
    "settings",
    "audit",
    "launcher",
    "search",
    "notifications",
  ]);
  // PLM.2–5 / AGT.3 — the PLM screens are Engineering/Quality screens at top-level
  // routes (a unit/config/test/RCA/change is a first-class object, not a module
  // sub-page). They gate WITH their owning module (disabling Engineering takes the
  // unit registry / configs / blast radius / changes with it; Quality takes
  // tests / rca). The owning-module map is shared with the AgentPane (lib/plm-routes).
  const pathname = headers().get("x-pathname") ?? "";
  const seg = pathname.split("/").filter(Boolean)[0] ?? "core";
  const moduleKey = owningModuleFor(pathname);
  const routeDisabled =
    !!user &&
    !NON_MODULE_ROUTES.has(seg) &&
    !isModuleEnabled(enabledModules, moduleKey);

  const [groups, ...rest] = await Promise.all([
    getNavModules(enabledModules),
    user ? getAxonaAgent(user.orgId) : Promise.resolve(null),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
    user
      ? dbForOrg(user.orgId).agent.findMany({
          orderBy: [{ moduleKey: "asc" }, { code: "asc" }],
        })
      : Promise.resolve([]),
    user ? getUnreadCount(user.orgId, user.id) : Promise.resolve(0), // NOTIF.1
  ]);
  const [axona, alerts, allAgents, unreadCount] = rest as [
    Awaited<ReturnType<typeof getAxonaAgent>> | null,
    Record<string, number>,
    Awaited<ReturnType<ReturnType<typeof dbForOrg>["agent"]["findMany"]>>,
    number,
  ];

  // PROSPECT.2 — the workspace's OWN identity for the shell wordmark. Each tenant
  // renders its own brand (logo if set, else its name) — never a hardcoded wordmark.
  let orgLogoUrl: string | null = null;
  if (onboarding?.logoKey && s3Configured()) {
    orgLogoUrl = await presignedGetUrl(onboarding.logoKey).catch(() => null);
  }
  const org = onboarding
    ? { name: onboarding.name, logoUrl: orgLogoUrl }
    : null;

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

  // SIDEBAR.2 — read the user's saved shell shape on the SERVER so the sidebar renders
  // collapsed/expanded on first paint. It used to come from a localStorage store, which
  // meant every navigation painted expanded and then snapped.
  const uiPrefs = user ? await getUiPrefs(user.orgId, user.id) : null;

  return (
    // SIDEBAR.2 — the shell frame follows Sidebar Nav.dc.html: the app background is
    // --panel and the sidebar is a PAPER CARD floating on it (26px padding + gap),
    // rather than a flush full-height rail on a paper page.
    <div // grid-rows + overflow-hidden: with p-[26px] the ROW must be capped at the
      // padded height, or a tall child sizes the row to the full viewport and the
      // cards hang 26px past the bottom edge (the account row + collapse toggle
      // were clipped).
      className="grid h-dvh grid-cols-[auto_1fr_auto] grid-rows-[minmax(0,1fr)] gap-[26px] overflow-hidden bg-panel p-[26px] text-ink"
    >
      <Sidebar
        groups={groups}
        alerts={alerts}
        user={
          user ? { name: user.name, role: user.role, email: user.email } : null
        }
        org={org}
        unreadCount={unreadCount}
        prefs={uiPrefs}
      />
      <main
        id="main"
        aria-label="Main content"
        className="min-w-0 overflow-y-auto rounded-[16px] border border-line bg-paper"
      >
        {routeDisabled ? <ModuleNotEnabled /> : children}
      </main>
      <AgentPane axonaAgentId={axona?.id} agentsByModule={agentsByModule} />
      {/* LOGIN.1 — the global ⌘K palette (SRCH.3) is mounted here (signed-in
          surface), not in the root layout, so public/auth/not-found routes never
          render it. Opened by the sidebar search, ⌘K, and the MC pill. */}
      <CommandPaletteMount />
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
