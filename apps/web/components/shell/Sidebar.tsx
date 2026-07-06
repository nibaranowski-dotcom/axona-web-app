"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import { useMounted, useUi } from "@/lib/ui-store";
import { NavSection } from "./NavSection";

export interface SidebarUser {
  name: string;
  role: string;
}

// Modules that live only on Mission Control / as the palette — not in the left
// nav (Command Center.dc.html's Core is exactly CC · Agents · Workflows ·
// Projects · Machines). Scoped to the sidebar; the launcher keeps its tiles.
const HIDDEN_FROM_NAV = new Set(["mission-control", "search"]);

// Left sidebar (Axona v2 shell) — 240px, paper surface, hairline right border,
// 1:1 with Command Center.dc.html's <aside>. axona wordmark + asymmetric square
// mark + a collapse-menu button; a search bar that routes to Mission Control
// (the navsearch links there per the design — its pill lands autofocused; ⌘K
// keeps the dark Search overlay); collapsible <details> nav sections with
// per-module alert badges; the AUTH.1 identity-stub footer. Collapses to a slim
// rail (persisted in useUi). Icons are Lucide (thin stroke); no emoji.

export function Sidebar({
  groups,
  alerts,
  user,
}: {
  groups: NavGroup[];
  alerts: Record<string, number>;
  user?: SidebarUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const mounted = useMounted();

  // Clicking the search bar lands on Mission Control (pill autofocused there).
  const goToSearch = () => router.push("/launcher");

  const navGroups = groups
    .map((g) => ({
      ...g,
      modules: g.modules.filter((m) => !HIDDEN_FROM_NAV.has(m.key)),
    }))
    .filter((g) => g.modules.length > 0);

  // Hydration-safe: first paint = expanded (matches the server), then reflect
  // the persisted collapse state.
  if (mounted && collapsed) {
    return (
      <nav
        aria-label="Primary"
        className="flex h-dvh w-[60px] flex-none flex-col items-center border-r border-line bg-paper py-[18px]"
      >
        <span
          aria-hidden
          className="h-3 w-3 flex-none bg-ink-strong"
          style={{ borderRadius: "0 7px 0 7px" }}
        />
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          className="mt-4 flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </button>
        <button
          type="button"
          onClick={goToSearch}
          aria-label="Search"
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-[7px] border border-line-strong text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="flex h-dvh w-[240px] flex-none flex-col border-r border-line bg-paper px-[14px] py-[18px]"
    >
      {/* Wordmark + asymmetric square mark · collapse-menu button */}
      <div className="flex items-center justify-between gap-2 px-2 pb-[18px] pt-1">
        <Link
          href="/launcher"
          aria-label="axona — Mission Control"
          className="flex items-center gap-2 rounded-[7px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="text-[21px] font-bold tracking-[-0.04em] text-ink-strong">
            axona
          </span>
          <span
            aria-hidden
            className="h-3 w-3 flex-none bg-ink-strong"
            style={{ borderRadius: "0 7px 0 7px" }}
          />
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line bg-paper text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftClose
            className="h-[15px] w-[15px]"
            strokeWidth={1.7}
            aria-hidden
          />
        </button>
      </div>

      {/* Search bar → Mission Control (search ready). ⌘K palette = SRCH.3. */}
      <button
        type="button"
        onClick={goToSearch}
        className="mx-1 mb-[10px] flex items-center gap-[9px] rounded-[9px] border border-line-strong bg-panel px-[11px] py-2 transition-colors hover:border-ink-strong hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Search
          className="h-3.5 w-3.5 flex-none text-ink-muted"
          strokeWidth={2}
          aria-hidden
        />
        <span className="flex-1 text-left text-[13px] text-ink-muted">
          Search
        </span>
        <span className="rounded-[4px] border border-line-strong px-[5px] py-px font-mono text-[9.5px] text-ink-muted">
          ⌘K
        </span>
      </button>

      {/* Grouped nav (empty state if the seed hasn't run) */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto px-1">
        {navGroups.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-muted">
            No modules — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        ) : (
          navGroups.map((g) => (
            <NavSection key={g.group} group={g} alerts={alerts} />
          ))
        )}

        {/* Governance — the cross-cutting audit trail (AUDIT.2). A static link, not
            a value-chain module; the immutable record of every gated decision. */}
        <Link
          href="/audit"
          className={`mt-1.5 flex items-center gap-2 rounded-[7px] px-3 py-[7px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            pathname === "/audit"
              ? "bg-panel-2 font-semibold text-ink"
              : "text-ink-muted hover:bg-panel hover:text-ink"
          }`}
        >
          <ShieldCheck
            className="h-[15px] w-[15px] flex-none"
            strokeWidth={1.7}
            aria-hidden
          />
          Audit trail
        </Link>
      </div>

      {/* Identity + sign-out (AUTH.1) — the logged-in user + role. */}
      <div className="mt-2 flex items-center gap-[10px] border-t border-line px-2 pb-0.5 pt-3">
        <span
          aria-hidden
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink"
        >
          {initials(user?.name)}
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] leading-[1.3]">
          <div className="truncate font-semibold text-ink">
            {user?.name ?? "Signed in"}
          </div>
          <div className="truncate text-ink-muted">{roleLabel(user?.role)}</div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LogOut className="h-[15px] w-[15px]" strokeWidth={1.7} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

// AUTH.1 — display helpers for the identity footer.
function initials(name?: string): string {
  if (!name) return "AX";
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AX"
  );
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OPS: "Operations",
  ENGINEER: "Engineering",
  SALES: "Sales",
  FINANCE: "Finance",
  TECH: "Autonomy",
  VIEWER: "Viewer",
};
function roleLabel(role?: string): string {
  return role ? (ROLE_LABEL[role] ?? role) : "Member";
}
