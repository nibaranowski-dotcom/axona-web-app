"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav";
import { useMounted, useUi } from "@/lib/ui-store";

// A collapsible nav group (CORE / VALUE CHAIN / ROBOTICS / BACK OFFICE) with its
// module rows. Open/closed persists via the UI store; active row gets the lime
// signal (2px left bar + ink-strong). Inactive rows are ink-muted.

export function NavSection({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const open = useUi((s) => s.navOpen[group.group]);
  const toggleNav = useUi((s) => s.toggleNav);

  // Hydration-safe: default to open on first paint, then reflect persisted state.
  const isOpen = mounted ? open !== false : true;

  return (
    <div className="px-2 py-1">
      <button
        type="button"
        onClick={() => toggleNav(group.group)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-btn px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span>{group.label}</span>
        <span aria-hidden className="text-ink-muted">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <ul className="mt-0.5">
          {group.modules.map((m) => {
            const active = pathname === m.href;
            return (
              <li key={m.key}>
                <Link
                  href={m.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-2 rounded-btn border-l-2 px-3 py-1.5 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "border-accent bg-panel-2 text-ink-strong"
                      : "border-transparent text-ink-muted hover:bg-panel-2 hover:text-ink",
                  ].join(" ")}
                >
                  {m.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
