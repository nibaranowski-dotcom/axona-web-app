"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isNavItemActive, type NavGroup } from "@/lib/nav";
import { MODULE_ICON } from "@/components/shell/module-icons";
import { PLM_ROUTE_MODULE } from "@/lib/plm-routes";

// SIDEBAR.2 — a nav group on the Cloudflare-style side nav (Sidebar Nav.dc.html).
//
// Row anatomy is the design's: Lucide line icon · label · optional lime count badge ·
// a chevron on EXPANDABLE rows only. The expanded nav used to render a 6px square
// marker and no per-module icon (the icons existed but only the collapsed rail used
// them); the design puts the same icon in both states, so the rail is now a narrowing
// of the nav rather than a different language.
//
// THE CHEVRON IS NOT AN ACCORDION. It marks a module that owns child screens and
// drills in to that module's landing — the row and the chevron go to the same place.
// The GROUP header is the accordion, and its open/closed state persists per user.
//
// "Expandable" is derived, not hand-listed: a module is expandable when it owns at
// least one child route in PLM_ROUTE_MODULE (engineering owns units/configurations/
// blast-radius/changes; quality owns tests/rca). Deriving it means a chevron can never
// point at a module that has nothing to drill into.
const EXPANDABLE_MODULES = new Set(Object.values(PLM_ROUTE_MODULE));

export function NavSection({
  group,
  alerts,
  open = true,
  onToggle,
}: {
  group: NavGroup;
  alerts: Record<string, number>;
  /** SIDEBAR.2 — controlled by the user's persisted prefs, not local <details> state. */
  open?: boolean;
  onToggle?: (label: string) => void;
}) {
  const pathname = usePathname();

  return (
    <div className="navgroup">
      {/* The design leaves the FIRST group unlabelled; a group with no label renders
          its rows directly and has nothing to collapse. */}
      {group.label ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onToggle?.(group.label)}
          className="flex w-full cursor-pointer list-none items-center gap-[7px] rounded-btn px-[8px] pb-[6px] pt-[16px] font-mono text-[9.5px] uppercase tracking-[0.07em] text-mono-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={`h-[11px] w-[11px] flex-none text-line-strong transition-transform duration-150 ${
              open ? "" : "-rotate-90"
            }`}
            strokeWidth={2.4}
            aria-hidden
          />
        </button>
      ) : null}

      {open && (
        <ul>
          {group.modules.map((m) => {
            const active = isNavItemActive(pathname, m.href);
            const badge = alerts[m.key] ?? 0;
            const Icon = MODULE_ICON[m.key];
            const expandable = EXPANDABLE_MODULES.has(m.key);
            return (
              <li key={m.key}>
                <Link
                  href={m.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-[12px] rounded-[9px] px-[9px] py-[9px] text-[14px] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "bg-panel font-semibold text-ink"
                      : "font-normal text-ink-muted hover:bg-panel hover:text-ink",
                  ].join(" ")}
                >
                  {Icon ? (
                    // currentColor so the icon tracks the row's own state (ink when
                    // active, muted otherwise) instead of needing a parallel colour map.
                    <Icon
                      className={`h-[16px] w-[16px] flex-none ${
                        active ? "text-ink" : "text-ink-faint"
                      }`}
                      strokeWidth={1.7}
                      aria-hidden
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`h-[6px] w-[6px] flex-none rounded-[2px] ${
                        active ? "bg-ink-strong" : "bg-line-strong"
                      }`}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {badge > 0 && (
                    <span className="flex-none rounded-full bg-accent px-[7px] py-px font-mono text-[10px] font-semibold text-accent-ink">
                      {badge}
                    </span>
                  )}
                  {expandable && (
                    <ChevronRight
                      className="h-[15px] w-[15px] flex-none text-line-strong"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
