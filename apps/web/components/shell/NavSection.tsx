"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavGroup } from "@/lib/nav";

// A collapsible nav group (Core / Value chain / Robotics / Back office) — a
// native <details> (v2 shell). Mono uppercase eyebrow + a light-grey chevron
// that rotates when closed (globals.css). Each module row: a 6px square marker
// (ink when active, else line) + name; the active row gets a panel fill.
export function NavSection({ group }: { group: NavGroup }) {
  const pathname = usePathname();

  return (
    <details open className="navgroup">
      <summary className="flex cursor-pointer list-none items-center gap-[7px] rounded-btn px-[10px] pb-[6px] pt-[14px] font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{group.label}</span>
        <ChevronDown
          className="navchev h-[11px] w-[11px] flex-none text-line-strong transition-transform duration-150"
          strokeWidth={2.4}
          aria-hidden
        />
      </summary>
      <ul>
        {group.modules.map((m) => {
          const active = pathname === m.href;
          return (
            <li key={m.key}>
              <Link
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-[11px] rounded-btn px-[10px] py-2 text-[14px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "bg-panel font-semibold text-ink"
                    : "font-normal text-ink-muted hover:bg-panel",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={`h-[6px] w-[6px] flex-none rounded-[2px] ${
                    active ? "bg-ink-strong" : "bg-line-strong"
                  }`}
                />
                <span className="flex-1">{m.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
