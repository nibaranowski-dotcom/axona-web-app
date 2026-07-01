import type { Role } from "@axona/db";

// Minimal role guard — the RBAC.2/3 seam. `requireRole` throws on an
// insufficient role (defense-in-depth for server actions/mutations); `hasRole`
// is the boolean for gating UI. The full policy engine + per-tool guardrails are
// RBAC.2/3; this is the enforcement point every mutation calls first.

type MaybeUser = { role: Role } | null | undefined;

export function hasRole(user: MaybeUser, roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}

export function requireRole(
  user: MaybeUser,
  roles: Role[],
): asserts user is { role: Role } {
  if (!user || !roles.includes(user.role)) {
    throw new Error("forbidden: insufficient role");
  }
}
