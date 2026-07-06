import { prisma, type Role } from "@axona/db";
import { listInvites } from "./invites";

// SET.2 — members read model (server-only). getMembers returns the org's Users as
// ACTIVE/DEACTIVATED rows plus PENDING invites (AUTH.5) as INVITED rows, with a
// header rollup. Plus a static role → capability legend from the RBAC rules.

export type MemberStatus = "ACTIVE" | "INVITED" | "DEACTIVATED";

export interface MemberRow {
  kind: "user" | "invite";
  id: string; // userId or inviteId
  name: string; // user name, or the invited email for invites
  email: string;
  role: Role;
  status: MemberStatus;
  lastSeenAt: Date | null;
  invitedByLabel?: string; // invites only
  expiresAt?: Date; // invites only
}

export interface MembersRollup {
  activeMembers: number;
  deactivated: number;
  pending: number;
  byRole: Record<string, number>; // active members by role
}

export interface MembersData {
  members: MemberRow[];
  rollup: MembersRollup;
}

export async function getMembers(orgId: string): Promise<MembersData> {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { orgId },
      orderBy: [{ deactivatedAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        deactivatedAt: true,
        lastSeenAt: true,
      },
    }),
    listInvites(orgId), // PENDING only, org-scoped
  ]);

  const userRows: MemberRow[] = users.map((u) => ({
    kind: "user",
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.deactivatedAt ? "DEACTIVATED" : "ACTIVE",
    lastSeenAt: u.lastSeenAt,
  }));

  const inviteRows: MemberRow[] = invites.map((i) => ({
    kind: "invite",
    id: i.id,
    name: i.email,
    email: i.email,
    role: i.role,
    status: "INVITED",
    lastSeenAt: null,
    invitedByLabel: i.invitedByLabel,
    expiresAt: i.expiresAt,
  }));

  const active = userRows.filter((r) => r.status === "ACTIVE");
  const byRole: Record<string, number> = {};
  for (const r of active) byRole[r.role] = (byRole[r.role] ?? 0) + 1;

  return {
    members: [...userRows, ...inviteRows],
    rollup: {
      activeMembers: active.length,
      deactivated: userRows.filter((r) => r.status === "DEACTIVATED").length,
      pending: inviteRows.length,
      byRole,
    },
  };
}

// Static role → capability legend (from the RBAC rules) for the screen's
// "what each role can do" matrix. Columns: View · Run · Approve · Members · Billing.
export interface RoleCapability {
  role: Role;
  view: boolean;
  run: boolean;
  approve: boolean;
  members: boolean;
  billing: boolean;
}

export const ROLE_CAPABILITIES: RoleCapability[] = [
  {
    role: "ADMIN",
    view: true,
    run: true,
    approve: true,
    members: true,
    billing: true,
  },
  {
    role: "OPS",
    view: true,
    run: true,
    approve: true,
    members: false,
    billing: false,
  },
  {
    role: "ENGINEER",
    view: true,
    run: true,
    approve: true,
    members: false,
    billing: false,
  },
  {
    role: "TECH",
    view: true,
    run: true,
    approve: false,
    members: false,
    billing: false,
  },
  {
    role: "SALES",
    view: true,
    run: true,
    approve: false,
    members: false,
    billing: false,
  },
  {
    role: "FINANCE",
    view: true,
    run: true,
    approve: true,
    members: false,
    billing: true,
  },
  {
    role: "VIEWER",
    view: true,
    run: false,
    approve: false,
    members: false,
    billing: false,
  },
];
