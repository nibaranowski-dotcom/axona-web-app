"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { isNavItemActive, type NavGroup } from "@/lib/nav";
import { useMounted, useUi } from "@/lib/ui-store";
import { NavSection } from "./NavSection";
import { moduleIcon } from "./module-icons";

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
// per-module alert badges. Collapses to a slim rail (persisted in useUi).
// Icons are Lucide (thin stroke); no emoji.
//
// UX.7 — the sidebar nav is MODULES ONLY. Audit trail, Notifications (with the
// unread badge), and Settings no longer live as top-level nav links; they moved
// into the identity block, which is now a button opening an upward contextual
// menu (see UserMenu). Every route + the badge still work.

export function Sidebar({
  groups,
  alerts,
  user,
  org,
  unreadCount = 0,
}: {
  groups: NavGroup[];
  alerts: Record<string, number>;
  user?: SidebarUser | null;
  // PROSPECT.2 — the workspace's OWN identity (each tenant renders its own brand).
  org?: { name: string; logoUrl: string | null } | null;
  unreadCount?: number;
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
  //
  // UX.14 — the collapsed rail keeps ICON-ONLY module nav: every visible module is
  // reachable without expanding (Lucide icon + aria-label + hover tooltip), the
  // active module gets the same panel fill the expanded nav uses, and per-module
  // alert counts collapse to a small accent dot. Search + expand toggle stay at the
  // top; the identity/UX.7 menu stays reachable at the bottom (icon-triggered).
  if (mounted && collapsed) {
    return (
      <nav
        aria-label="Primary"
        className="flex h-dvh w-[60px] flex-none flex-col items-center border-r border-line bg-paper py-[18px]"
      >
        <Link
          href="/launcher"
          aria-label={`${org?.name ?? "Axona"} — Mission Control`}
          className="flex-none rounded-[7px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            aria-hidden
            className="block h-3 w-3 bg-ink-strong"
            style={{ borderRadius: "0 7px 0 7px" }}
          />
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="mt-4 flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </button>
        <button
          type="button"
          onClick={goToSearch}
          aria-label="Search"
          title="Search"
          className="mt-2 flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line-strong text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>

        {/* Icon-only module nav — every visible module reachable (scrolls if tall) */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto border-t border-line pt-3">
          {navGroups.map((g, gi) => (
            <div
              key={g.group}
              className={`flex flex-col items-center gap-1 ${gi > 0 ? "mt-2 border-t border-line pt-2" : ""}`}
            >
              {g.modules.map((m) => {
                const active = isNavItemActive(pathname, m.href);
                const badge = alerts[m.key] ?? 0;
                const Icon = moduleIcon(m.key);
                return (
                  <Link
                    key={m.key}
                    href={m.href}
                    aria-label={
                      badge > 0 ? `${m.name}, ${badge} alerts` : m.name
                    }
                    aria-current={active ? "page" : undefined}
                    title={m.name}
                    className={`relative flex h-9 w-9 flex-none items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active
                        ? "bg-panel text-ink"
                        : "text-ink-muted hover:bg-panel hover:text-ink"
                    }`}
                  >
                    <Icon
                      className="h-[18px] w-[18px]"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    {badge > 0 && (
                      <span
                        aria-hidden
                        className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full border border-paper bg-accent"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Identity/UX.7 menu — reachable from the rail (icon-triggered) */}
        <UserMenu
          user={user}
          unreadCount={unreadCount}
          pathname={pathname}
          collapsed
        />
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
          aria-label={`${org?.name ?? "Axona"} — Mission Control`}
          className="flex min-w-0 items-center gap-2 rounded-[7px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/* Workspace identity: the org's logo if set, else its name. The Axona
              square mark stays as the product marker. */}
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={org.name}
              className="h-[22px] w-auto max-w-[150px] flex-none object-contain"
            />
          ) : (
            <span className="min-w-0 truncate text-[19px] font-bold tracking-[-0.03em] text-ink-strong">
              {org?.name ?? "Axona"}
            </span>
          )}
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
      </div>

      {/* Identity block → upward contextual menu (UX.7): audit / notifications
          (with the unread badge) / settings + the user & sign-out. */}
      <UserMenu user={user} unreadCount={unreadCount} pathname={pathname} />
    </nav>
  );
}

// UX.7 — the identity block is a BUTTON that opens an upward contextual menu:
// Audit trail · Notifications (carries the unread badge) · Settings · divider ·
// the user (name + role) + Sign out. aria-haspopup/expanded; Esc + click-outside
// close with focus returned to the button; first item focused on open. Lucide
// icons, v2 tokens, no emoji. These three routes used to be top-level nav links.
function UserMenu({
  user,
  unreadCount,
  pathname,
  collapsed = false,
}: {
  user?: SidebarUser | null;
  unreadCount: number;
  pathname: string;
  // UX.14 — collapsed rail: an avatar-only trigger + a fixed-width upward popover
  // (the same UX.7 menu items) so audit/notifications/settings/sign-out stay reachable.
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click + Escape; focus the first item on open, restore focus
  // to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    // focus the first menu item
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemBase =
    "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const itemFor = (active: boolean) =>
    `${itemBase} ${
      active
        ? "bg-panel-2 font-semibold text-ink"
        : "text-ink-muted hover:bg-panel hover:text-ink"
    }`;
  const close = () => setOpen(false);

  return (
    <div
      ref={containerRef}
      className={collapsed ? "relative mt-2 flex-none" : "relative mt-2"}
    >
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className={`absolute bottom-[calc(100%+8px)] left-0 z-30 flex flex-col gap-0.5 rounded-card border border-line-strong bg-paper p-2 shadow-[0_-8px_28px_-12px_rgba(10,10,10,0.28)] ${
            collapsed ? "w-[236px]" : "right-0"
          }`}
        >
          <Link
            href="/audit"
            role="menuitem"
            onClick={close}
            className={itemFor(pathname === "/audit")}
          >
            <ShieldCheck
              className="h-[15px] w-[15px] flex-none"
              strokeWidth={1.7}
              aria-hidden
            />
            Audit trail
          </Link>
          <Link
            href="/notifications"
            role="menuitem"
            onClick={close}
            className={itemFor(pathname === "/notifications")}
          >
            <Bell
              className="h-[15px] w-[15px] flex-none"
              strokeWidth={1.7}
              aria-hidden
            />
            <span className="flex-1">Notifications</span>
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread`}
                className="min-w-[18px] rounded-pill bg-accent px-1.5 text-center font-mono text-[10px] font-bold text-accent-ink"
              >
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/settings/members"
            role="menuitem"
            onClick={close}
            className={itemFor(pathname.startsWith("/settings"))}
          >
            <Settings
              className="h-[15px] w-[15px] flex-none"
              strokeWidth={1.7}
              aria-hidden
            />
            Settings
          </Link>

          <div className="my-1.5 h-px bg-line" aria-hidden />

          <div className="flex items-center gap-[10px] px-1.5 py-1">
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
              <div className="truncate text-ink-muted">
                {roleLabel(user?.role)}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <LogOut
                className="h-[15px] w-[15px]"
                strokeWidth={1.7}
                aria-hidden
              />
            </button>
          </div>
        </div>
      )}

      {collapsed ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label="Account menu"
          title={user?.name ?? "Account"}
          className="mt-3 flex h-9 w-9 flex-none items-center justify-center rounded-full border-t border-line bg-accent text-[11px] font-bold text-accent-ink transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {initials(user?.name)}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          className="flex w-full items-center gap-[10px] border-t border-line px-2 pb-0.5 pt-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink"
          >
            {initials(user?.name)}
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.3]">
            <span className="block truncate font-semibold text-ink">
              {user?.name ?? "Signed in"}
            </span>
            <span className="block truncate text-ink-muted">
              {roleLabel(user?.role)}
            </span>
          </span>
          {open ? (
            <ChevronDown
              className="h-4 w-4 flex-none text-ink-muted"
              strokeWidth={1.7}
              aria-hidden
            />
          ) : (
            <ChevronUp
              className="h-4 w-4 flex-none text-ink-muted"
              strokeWidth={1.7}
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
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
