"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AtSign,
  BellRing,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { StatStrip } from "@/components/shell/StatStrip";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";
import type { NotificationFeed, NotificationRow } from "@/lib/notifications";
import { markRead, markAllRead } from "@/app/(shell)/notifications/actions";

// NOTIF.1 — the in-app notification center (1:1 with Notifications.dc.html): a
// grouped Today/Earlier feed of what needs the user (approvals, exceptions, run
// failures, mentions), unread state (lime dot), deep-links, tabs (All · Unread ·
// Approvals) + "Mark all read". A scannable feed, not a table. Attention in ink.
type Tab = "all" | "unread" | "approvals";

const TYPE_ICON = {
  APPROVAL: ShieldCheck,
  EXCEPTION: TriangleAlert,
  RUN: Zap,
  MENTION: AtSign,
  SYSTEM: BellRing,
} as const;

// Exception = ink glyph; approval = lime; others neutral.
const TYPE_STYLE: Record<string, string> = {
  APPROVAL: "bg-accent text-accent-ink",
  EXCEPTION: "bg-ink-strong text-on-dark",
  RUN: "bg-panel-2 text-ink-muted",
  MENTION: "bg-panel-2 text-ink-muted",
  SYSTEM: "bg-panel-2 text-ink-muted",
};

export function NotificationsView({ feed }: { feed: NotificationFeed }) {
  const [tab, setTab] = useState<Tab>("all");
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const keep = (r: NotificationRow) =>
      tab === "unread"
        ? r.unread
        : tab === "approvals"
          ? r.type === "APPROVAL"
          : true;
    return feed.groups
      .map((g) => ({ ...g, items: g.items.filter(keep) }))
      .filter((g) => g.items.length > 0);
  }, [feed.groups, tab]);

  const stats = [
    { v: String(feed.total), l: "Notifications" },
    { v: String(feed.unreadCount), l: "Unread" },
    { v: String(feed.approvalCount), l: "Approvals · unread" },
  ];

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: feed.unreadCount },
    { key: "approvals", label: "Approvals", count: feed.approvalCount },
  ];

  return (
    <ScreenShell
      bodyClassName="gap-3"
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Core · activity
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Notifications
            </h1>
          </div>
          <button
            type="button"
            disabled={pending || feed.unreadCount === 0}
            onClick={() =>
              startTransition(async () => void (await markAllRead()))
            }
            className="rounded-btn border border-line-strong bg-paper px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Mark all read
          </button>
        </>
      }
    >
      {feed.total === 0 ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            You’re all caught up — no notifications yet.
          </p>
        </ScreenMessage>
      ) : (
        <>
          <StatStrip stats={stats} />

          {/* tabs */}
          <div className="flex items-center gap-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active
                      ? "border-ink-strong bg-ink-strong text-on-dark"
                      : "border-line-strong bg-paper text-ink-muted hover:border-ink-strong hover:text-ink"
                  }`}
                >
                  {t.label}
                  {t.count ? (
                    <span
                      className={`rounded-pill px-1.5 font-mono text-[10px] ${
                        active
                          ? "bg-paper text-ink"
                          : "bg-panel-2 text-ink-muted"
                      }`}
                    >
                      {t.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* grouped feed */}
          {groups.length === 0 ? (
            <p className="rounded-card border border-line bg-paper px-5 py-8 text-center text-[13px] text-ink-muted">
              Nothing here.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    {g.label}
                  </div>
                  <div className="overflow-hidden rounded-card border border-line bg-paper">
                    {g.items.map((n, i) => (
                      <NotificationItem
                        key={n.id}
                        n={n}
                        first={i === 0}
                        pending={pending}
                        onRead={() =>
                          startTransition(
                            async () => void (await markRead(n.id)),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function NotificationItem({
  n,
  first,
  pending,
  onRead,
}: {
  n: NotificationRow;
  first: boolean;
  pending: boolean;
  onRead: () => void;
}) {
  const Icon = TYPE_ICON[n.type];
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-start gap-3.5 py-3.5 pr-5 ${
        first ? "" : "border-t border-line"
      } ${n.unread ? "border-l-2 border-l-accent pl-[18px]" : "pl-5"}`}
    >
      <span
        className={`mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-[9px] ${TYPE_STYLE[n.type]}`}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden />
      </span>
      <Link
        href={n.url}
        onClick={n.unread ? onRead : undefined}
        className="min-w-0 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {n.title}
          </span>
          {n.unread && (
            <span
              aria-label="Unread"
              className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
            />
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-muted">
          {n.body}
        </p>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          <span>{n.source}</span>
          <span aria-hidden>·</span>
          <span>{n.object}</span>
          <span aria-hidden>·</span>
          <span>{relTime(n.createdAt)}</span>
        </div>
      </Link>
      {n.unread && (
        <button
          type="button"
          disabled={pending}
          onClick={onRead}
          className="rounded-btn border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Mark read
        </button>
      )}
    </div>
  );
}

function relTime(d: Date): string {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
