"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Plus,
  RotateCcw,
  Search,
  UserMinus,
  X,
} from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type { MembersData, MemberRow, RoleCapability } from "@/lib/members";
import {
  inviteMembers,
  changeRole,
  setActive,
  revokeInvite,
  type MembersActionResult,
} from "@/app/(shell)/settings/members/actions";
import type { InviteResult } from "@/lib/invites";

// SET.2 — Members & roles (1:1 with Settings - Members.dc.html): a toolbar (search
// · role filter · Invite people), the members roster (Person · Role · Status ·
// Last active · actions), and the role → capability legend. ADMIN sees the editable
// role select + row actions; non-ADMIN sees a read-only roster (server also gates).
// Ink for deactivated, functional green for active, no invented reds; v2 tokens.
const ROLES = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
] as const;

// One grid template shared by the roster header AND every member row. The actions
// column is a FIXED 44px slot reserved on all rows (empty when a row has no icon —
// e.g. the last admin / self) so Person · Role · Status · Last active align
// vertically regardless of the deactivate/revoke button (UX.6, same fix as UX.5's
// PoRow). Never `auto` — that sizes to content and misaligns the fr columns.
const MEMBER_COLS = "grid grid-cols-[2.2fr_1.1fr_1fr_1fr_44px] gap-3 px-5";

export function MembersView({
  data,
  capabilities,
  isAdmin,
  currentUserId,
  defaultRole = "OPS",
}: {
  data: MembersData;
  capabilities: RoleCapability[];
  isAdmin: boolean;
  currentUserId: string;
  defaultRole?: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<MembersActionResult>) =>
    startTransition(async () => {
      const res = await fn();
      setNotice(res.ok ? null : (res.message ?? "Something went wrong."));
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.members.filter(
      (m) =>
        (!roleFilter || m.role === roleFilter) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)),
    );
  }, [data.members, query, roleFilter]);

  return (
    <SettingsShell
      eyebrow="Settings"
      title="Members & roles"
      adminOnly={isAdmin}
    >
      <div className="mx-auto flex max-w-[940px] flex-col gap-[18px] px-8 py-7">
        {notice && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-card border border-line-strong bg-ink-strong px-3.5 py-2.5"
          >
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">
              Action blocked
            </span>
            <span className="text-[12.5px] font-medium text-on-dark">
              {notice}
            </span>
          </div>
        )}

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-line-strong bg-paper px-3">
            <Search
              className="h-3.5 w-3.5 flex-none text-ink-faint"
              strokeWidth={2}
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              aria-label="Search members"
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="cursor-pointer rounded-[9px] border border-line-strong bg-paper px-3 py-2.5 text-[13px] text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setInviteOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-[9px] bg-ink-strong px-4 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              Invite people
            </button>
          )}
        </div>

        {isAdmin && inviteOpen && (
          <InvitePanel
            onClose={() => setInviteOpen(false)}
            onNotice={setNotice}
            defaultRole={defaultRole}
          />
        )}

        {/* members table */}
        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <h2 className="text-[15px] font-semibold text-ink">Members</h2>
            <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
              {data.rollup.activeMembers} ACTIVE · {data.rollup.pending} INVITED
              {data.rollup.deactivated > 0 &&
                ` · ${data.rollup.deactivated} DEACTIVATED`}
            </span>
          </div>
          <div
            className={`${MEMBER_COLS} border-t border-line py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
          >
            <span>Person</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last active</span>
            <span className="sr-only">Actions</span>
          </div>
          {filtered.length === 0 ? (
            <p className="border-t border-line px-5 py-8 text-center text-[13px] text-ink-muted">
              No members match.
            </p>
          ) : (
            filtered.map((m) => (
              <MemberRowView
                key={`${m.kind}-${m.id}`}
                m={m}
                isAdmin={isAdmin}
                isSelf={m.id === currentUserId}
                pending={pending}
                run={run}
              />
            ))
          )}
        </section>

        {/* role → capability legend */}
        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="px-5 pb-3.5 pt-[18px]">
            <h2 className="text-[15px] font-semibold text-ink">
              What each role can do
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Roles gate actions across every module.
            </p>
          </div>
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            role="region"
            aria-label="Role capabilities"
            tabIndex={0}
          >
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 border-t border-line px-5 py-2 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                <span>Role</span>
                <span className="text-center">View</span>
                <span className="text-center">Run</span>
                <span className="text-center">Approve</span>
                <span className="text-center">Members</span>
                <span className="text-center">Billing</span>
              </div>
              {capabilities.map((c) => (
                <div
                  key={c.role}
                  className="grid grid-cols-[1.4fr_repeat(5,1fr)] items-center gap-2 border-t border-line px-5 py-2.5"
                >
                  <span className="font-mono text-[10.5px] font-bold tracking-[0.05em] text-ink">
                    {c.role}
                  </span>
                  {[c.view, c.run, c.approve, c.members, c.billing].map(
                    (on, i) => (
                      <span
                        key={i}
                        role="img"
                        aria-label={on ? "yes" : "no"}
                        className="flex justify-center"
                      >
                        {on ? (
                          <Check
                            className="h-[15px] w-[15px] text-ink-strong"
                            strokeWidth={2.6}
                            aria-hidden
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="inline-block h-0.5 w-2.5 rounded-full bg-line-strong"
                          />
                        )}
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SettingsShell>
  );
}

const STATUS_STYLE: Record<
  MemberRow["status"],
  { label: string; dot: string; fg: string }
> = {
  ACTIVE: { label: "Active", dot: "bg-success", fg: "text-ink" },
  INVITED: { label: "Invited", dot: "bg-accent", fg: "text-ink-muted" },
  DEACTIVATED: {
    label: "Deactivated",
    dot: "bg-line-strong",
    fg: "text-ink-faint",
  },
};

function initialsOf(name: string): string {
  return (
    name
      .split(/[ @.]/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function relTime(d: Date | null): string {
  if (!d) return "—";
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MemberRowView({
  m,
  isAdmin,
  isSelf,
  pending,
  run,
}: {
  m: MemberRow;
  isAdmin: boolean;
  isSelf: boolean;
  pending: boolean;
  run: (fn: () => Promise<MembersActionResult>) => void;
}) {
  const s = STATUS_STYLE[m.status];
  const deactivated = m.status === "DEACTIVATED";
  const isUser = m.kind === "user";
  const avBg =
    m.role === "ADMIN"
      ? "bg-ink-strong text-on-dark"
      : m.status === "INVITED"
        ? "bg-panel-2 text-ink-faint"
        : "bg-accent text-accent-ink";

  return (
    <div
      className={`${MEMBER_COLS} items-center border-t border-line py-3 ${
        deactivated ? "opacity-55" : ""
      }`}
    >
      {/* person */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${avBg}`}
        >
          {initialsOf(m.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-ink">
            {m.name}
          </div>
          <div className="truncate font-mono text-[10px] text-ink-faint">
            {m.status === "INVITED"
              ? `Invited · ${m.invitedByLabel ?? "admin"}`
              : m.email}
          </div>
        </div>
      </div>

      {/* role — editable select for ADMIN on active/deactivated users; pill otherwise */}
      {isAdmin && isUser ? (
        <select
          value={m.role}
          disabled={pending}
          onChange={(e) => run(() => changeRole(m.id, e.target.value))}
          aria-label={`Role for ${m.name}`}
          className="w-fit cursor-pointer rounded-pill border border-line-panel bg-panel py-1 pl-2.5 pr-6 font-mono text-[10px] font-bold tracking-[0.05em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ) : (
        <span className="w-fit rounded-pill border border-line-panel bg-panel px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.05em] text-ink">
          {m.role}
        </span>
      )}

      {/* status */}
      <span
        className={`inline-flex items-center gap-1.5 text-[12.5px] ${s.fg}`}
      >
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>

      {/* last active */}
      <span className="font-mono text-[11px] text-ink-faint">
        {m.status === "INVITED" ? "—" : relTime(m.lastSeenAt)}
      </span>

      {/* actions */}
      <div className="flex items-center justify-end gap-1">
        {isAdmin && isUser && !isSelf && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setActive(m.id, deactivated))}
            title={deactivated ? "Reactivate" : "Deactivate"}
            aria-label={
              deactivated ? `Reactivate ${m.name}` : `Deactivate ${m.name}`
            }
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-faint transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {deactivated ? (
              <RotateCcw
                className="h-[15px] w-[15px]"
                strokeWidth={1.8}
                aria-hidden
              />
            ) : (
              <UserMinus
                className="h-[15px] w-[15px]"
                strokeWidth={1.8}
                aria-hidden
              />
            )}
          </button>
        )}
        {isAdmin && m.kind === "invite" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => revokeInvite(m.id))}
            title="Revoke invite"
            aria-label={`Revoke invite for ${m.email}`}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-faint transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function InvitePanel({
  onClose,
  onNotice,
  defaultRole,
}: {
  onClose: () => void;
  onNotice: (m: string | null) => void;
  defaultRole: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>(
    (ROLES.includes(defaultRole as (typeof ROLES)[number])
      ? defaultRole
      : "OPS") as (typeof ROLES)[number],
  );
  const [results, setResults] = useState<InviteResult[]>([]);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await inviteMembers([{ email: email.trim(), role }]);
      if (!res.ok) onNotice(res.message ?? "Couldn’t invite.");
      setResults(res.invites ?? []);
      setEmail("");
    });
  };

  return (
    <section className="rounded-card border border-line-strong bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-ink">Invite people</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close invite"
          className="text-ink-faint transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          aria-label="Invite email"
          className="min-w-[220px] flex-1 rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-muted focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
          aria-label="Invite role"
          className="cursor-pointer rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-[9px] bg-ink-strong px-4 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {pending ? "Inviting…" : "Send invite"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[11.5px] text-ink-muted">
            Email delivery lands soon (EMAIL.1) — copy the link to share.
          </p>
          {results.map((r, i) => (
            <InviteResultRow key={i} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function InviteResultRow({ r }: { r: InviteResult }) {
  const [copied, setCopied] = useState(false);
  if (r.status !== "created") {
    return (
      <div className="rounded-[9px] border border-line bg-panel px-3 py-2 text-[12px] text-ink-muted">
        {r.email || "Invalid row"} —{" "}
        {r.status === "skipped-existing-user"
          ? "already a member"
          : r.status === "skipped-already-invited"
            ? "already invited"
            : "invalid email"}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
        {r.email}
      </span>
      <span className="flex-none rounded-pill bg-ink-strong px-2 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-on-dark">
        {r.role}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(r.link ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copied ? (
          <Check className="h-[13px] w-[13px]" strokeWidth={2.4} aria-hidden />
        ) : (
          <Copy className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
