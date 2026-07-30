import { prisma, type Role } from "@axona/db";

// ADMIN.1 — provision a REAL (non-demo) user into an EXISTING org. Extracted (like
// provisionWorkspace / verifyCredentials) so the `db:add-user` CLI and the verify
// share ONE implementation.
//
// SSO-ready: no password is set — User.passwordHash stays null, so credentials
// login is disabled (verifyCredentials returns null) and the user signs in via
// AUTH.SSO, which links by their Google-verified email. No known password is
// invented. Idempotent by email (@unique): re-running updates org/role/name rather
// than erroring or duplicating. Uses the SAME User write the signup/seed paths use
// (orgId · email · name · role) — no fork. Org-scoped; CLI/admin only.

export const ADD_USER_ROLES = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
] as const;

export interface AddUserInput {
  email: string;
  /** org id OR slug. */
  org: string;
  role: string;
  name: string;
}

export type AddUserResult =
  | {
      ok: true;
      action: "created" | "updated";
      email: string;
      role: Role;
      orgId: string;
      orgName: string;
    }
  | { ok: false; error: string };

export async function addUserToOrg(
  input: AddUserInput,
): Promise<AddUserResult> {
  const email = String(input.email ?? "")
    .toLowerCase()
    .trim();
  const orgRef = String(input.org ?? "").trim();
  const role = String(input.role ?? "")
    .toUpperCase()
    .trim();
  const name = String(input.name ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "--email must be a valid email address" };
  if (!orgRef)
    return { ok: false, error: "--org (org id or slug) is required" };
  if (!(ADD_USER_ROLES as readonly string[]).includes(role))
    return {
      ok: false,
      error: `--role must be one of ${ADD_USER_ROLES.join("|")}`,
    };
  if (!name) return { ok: false, error: "--name is required" };

  // Resolve the org by id OR slug; a clear error if neither matches.
  const org = await prisma.org.findFirst({
    where: { OR: [{ id: orgRef }, { slug: orgRef }] },
    select: { id: true, name: true },
  });
  if (!org)
    return { ok: false, error: `no org matches "${orgRef}" (by id or slug)` };

  // Idempotent by unique email: update in place if it exists, else create.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { orgId: org.id, name, role: role as Role },
    });
    return {
      ok: true,
      action: "updated",
      email,
      role: role as Role,
      orgId: org.id,
      orgName: org.name,
    };
  }

  // SSO-ready: passwordHash is omitted (stays null) → credentials login disabled;
  // AUTH.SSO links this user by their verified email. Same write as signup/seed.
  await prisma.user.create({
    data: { orgId: org.id, email, name, role: role as Role },
  });
  return {
    ok: true,
    action: "created",
    email,
    role: role as Role,
    orgId: org.id,
    orgName: org.name,
  };
}
