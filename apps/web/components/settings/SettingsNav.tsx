"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  Plug,
  User as UserIcon,
  Users,
} from "lucide-react";

// SET.2 — the reusable Settings sub-nav (the six sections). Members is built;
// the others link to their route (a "coming soon" placeholder until SET.1/3/4/5).
// Reused by every SET.* screen. Active item derived from the pathname.
const ITEMS = [
  {
    key: "organization",
    label: "Organization",
    href: "/settings/org",
    Icon: Building2,
  },
  { key: "members", label: "Members", href: "/settings/members", Icon: Users },
  {
    key: "profile",
    label: "Your profile",
    href: "/settings/profile",
    Icon: UserIcon,
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/settings/notifications",
    Icon: Bell,
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/settings/integrations",
    Icon: Plug,
  },
  {
    key: "billing",
    label: "Billing",
    href: "/settings/billing",
    Icon: CreditCard,
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="w-[210px] flex-none border-r border-line bg-paper px-3 py-5"
    >
      <div className="px-2.5 pb-2 pt-1 font-mono text-[9px] uppercase tracking-[0.07em] text-ink-muted">
        Settings
      </div>
      {ITEMS.map(({ key, label, href, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`mb-0.5 flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? "bg-panel font-semibold text-ink"
                : "font-normal text-ink-muted hover:bg-panel hover:text-ink"
            }`}
          >
            <Icon
              className={`h-4 w-4 flex-none ${active ? "text-ink" : "text-ink-faint"}`}
              strokeWidth={1.8}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
